import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPinned,
  ShieldCheck,
  UserRound,
  UsersRound,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import desktopBackground from "@/assets/brand/caronaa-background-desktop.png.asset.json";
import mobileBackground from "@/assets/brand/caronaa-background-mobile.png.asset.json";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { getFormConversionDraft, clearFormConversionDraft } from "@/lib/formulario/conversion";
import { normalizeStsSource, trackFunnelEvent } from "@/lib/funnel-events";
import {
  checkCearaAccess,
  regionalAccessMessage,
  type RegionalAccessResult,
} from "@/lib/location/regional-access";

const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  mode: z.enum(["entrar", "cadastro"]).optional().catch(undefined),
  submissionId: z.string().optional().catch(undefined),
  source: z.string().optional().catch(undefined),
  regionCheck: z.enum(["1"]).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — CARONAA" },
      {
        name: "description",
        content: "Entre ou crie sua conta na CARONAA para compartilhar caminhos e trajetos.",
      },
      { property: "og:title", content: "Entrar ou criar conta — CARONAA" },
      { property: "og:description", content: "Acesse a CARONAA e compartilhe seus caminhos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading } = useAuth();
  const [conversionDraft] = useState(() => getFormConversionDraft());
  const effectiveSubmissionId = search.submissionId || conversionDraft?.submissionId || null;

  // Detecta se o usuário chegou pelo formulário (via query param ou sessionStorage)
  const isFromForm = Boolean(
    search.submissionId ||
    search.source === "sts-2026" ||
    search.source === "sts2026" ||
    search.source === "sts_2026" ||
    search.source === "formulario" ||
    conversionDraft?.submissionId,
  );

  const canRegister = Boolean(effectiveSubmissionId);
  const [mode, setMode] = useState<"entrar" | "cadastro">(() =>
    canRegister && search.mode === "cadastro" ? "cadastro" : "entrar",
  );
  const effectiveMode = canRegister ? mode : "entrar";
  const [name, setName] = useState(() => conversionDraft?.name ?? "");
  const [gender, setGender] = useState<"FEMININO" | "MASCULINO" | "">("");
  const [email, setEmail] = useState(() => conversionDraft?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [hasTrackedSignupStart, setHasTrackedSignupStart] = useState(false);
  const [regionNotice, setRegionNotice] = useState("");
  const [regionStatus, setRegionStatus] = useState<"idle" | "checking" | "allowed" | "blocked">(
    search.regionCheck === "1" ? "checking" : "idle",
  );
  const isGoogleCallback = search.regionCheck === "1";

  const destination =
    search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
      ? search.redirect
      : "/home";

  useEffect(() => {
    if (!loading && user && (!isGoogleCallback || regionStatus === "allowed")) {
      void navigate({ to: destination });
    }
  }, [destination, isGoogleCallback, loading, navigate, regionStatus, user]);

  useEffect(() => {
    if (!isGoogleCallback || loading || !user || regionStatus !== "checking") return;
    let active = true;
    void checkCearaAccess().then(async (result: RegionalAccessResult) => {
      if (!active) return;
      if (!result.allowed) {
        setRegionNotice(regionalAccessMessage(result.reason));
        setRegionStatus("blocked");
        await supabase.auth.signOut();
        return;
      }
      setRegionStatus("allowed");
    });
    return () => {
      active = false;
    };
  }, [isGoogleCallback, loading, regionStatus, user]);

  useEffect(() => {
    if (effectiveSubmissionId && mode === "cadastro" && !hasTrackedSignupStart) {
      setHasTrackedSignupStart(true);
      void trackFunnelEvent({
        eventName: "signup_started_from_form",
        submissionId: effectiveSubmissionId,
        source: normalizeStsSource(conversionDraft?.source),
        campaign: conversionDraft?.campaign ?? null,
        campaignEvent: conversionDraft?.campaignEvent || "Siará Tech Summit 2026",
        metadata: {
          intent: conversionDraft?.intent ?? null,
          hasPreFilledData: Boolean(conversionDraft?.name || conversionDraft?.email),
        },
      });
    }
  }, [conversionDraft, effectiveSubmissionId, hasTrackedSignupStart, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "cadastro") {
        const access = await checkCearaAccess();
        if (!access.allowed) {
          const message = regionalAccessMessage(access.reason);
          setRegionNotice(message);
          toast.error(message);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: name.trim(),
              gender,
              whatsapp: conversionDraft?.whatsapp,
              submission_id: effectiveSubmissionId,
              initial_intent: conversionDraft?.intent,
              origin_neighborhood: conversionDraft?.originNeighborhood,
              destination_neighborhood: conversionDraft?.destinationNeighborhood,
              departure_window: conversionDraft?.departureWindow,
            },
          },
        });
        if (error) throw error;

        if (effectiveSubmissionId) {
          void trackFunnelEvent({
            eventName: "signup_completed_from_form",
            userId: data.user?.id ?? null,
            submissionId: effectiveSubmissionId,
            source: normalizeStsSource(conversionDraft?.source),
            campaign: conversionDraft?.campaign ?? null,
            campaignEvent: conversionDraft?.campaignEvent || "Siará Tech Summit 2026",
            metadata: {
              intent: conversionDraft?.intent ?? null,
              hasSession: Boolean(data.session),
            },
          });

          void trackFunnelEvent({
            eventName: "form_to_account_conversion",
            userId: data.user?.id ?? null,
            submissionId: effectiveSubmissionId,
            source: normalizeStsSource(conversionDraft?.source),
            campaign: conversionDraft?.campaign ?? null,
            campaignEvent: conversionDraft?.campaignEvent || "Siará Tech Summit 2026",
            metadata: {
              conversionType: "signup",
              intent: conversionDraft?.intent ?? null,
            },
          });
        }

        clearFormConversionDraft();

        if (!data.session) {
          setConfirmationSent(true);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (effectiveSubmissionId) {
          void trackFunnelEvent({
            eventName: "form_to_account_conversion",
            userId: data.user?.id ?? null,
            submissionId: effectiveSubmissionId,
            source: normalizeStsSource(conversionDraft?.source),
            campaign: conversionDraft?.campaign ?? null,
            campaignEvent: conversionDraft?.campaignEvent || "Siará Tech Summit 2026",
            metadata: {
              conversionType: "login",
              intent: conversionDraft?.intent ?? null,
            },
          });
        }

        clearFormConversionDraft();
      }
      await navigate({ to: destination });
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setBusy(true);
    setRegionNotice("");
    try {
      const access = await checkCearaAccess();
      if (!access.allowed) {
        const message = regionalAccessMessage(access.reason);
        setRegionNotice(message);
        toast.error(message);
        return;
      }
      const callback = new URL("/auth", window.location.origin);
      callback.searchParams.set("redirect", destination);
      callback.searchParams.set("regionCheck", "1");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: callback.href,
      });
      if (result.error) throw result.error;
      // AuthProvider navigates only after the returned session is available.
    } catch {
      toast.error("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  function openForgotPassword() {
    setForgotEmail(email || "");
    setForgotSuccess(false);
    setForgotOpen(true);
  }

  async function handleSendReset(e?: FormEvent) {
    if (e) e.preventDefault();
    const targetEmail = (forgotEmail || email).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      toast.error("Informe um endereço de e-mail válido.");
      return;
    }

    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error && error.message.toLowerCase().includes("rate limit")) {
        toast.error("Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.");
        return;
      }

      // Resposta neutra estrita conforme especificação de segurança (não confirmar se o email existe)
      setForgotSuccess(true);
      toast.success("Se existir uma conta com este e-mail, enviaremos as instruções.");
    } catch {
      setForgotSuccess(true);
      toast.success("Se existir uma conta com este e-mail, enviaremos as instruções.");
    } finally {
      setForgotBusy(false);
    }
  }

  if (confirmationSent) {
    return (
      <AuthFrame>
        <div className="text-center py-4">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-caronaa-primary/20 text-caronaa-primary">
            <Mail size={28} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-foreground">
            Confirme seu e-mail
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Enviamos um link de ativação para <strong className="text-foreground">{email}</strong>.
            Abra o e-mail para ativar sua conta na CARONAA.
          </p>
          <Button
            variant="outline"
            className="mt-6 w-full rounded-xl"
            onClick={() => {
              setConfirmationSent(false);
              setMode("entrar");
            }}
          >
            Voltar para entrar
          </Button>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      {/* Header oficial da experiência CARONAA */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-block transition hover:opacity-90">
            <img src={logoAsset.url} alt="CARONAA" className="h-10 sm:h-12 w-auto object-contain" />
          </Link>
          <ThemeToggle className="shrink-0 border-border/70 bg-background/70" />
        </div>

        <div className="pt-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Seu caminho continua aqui.
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Tenha seu perfil pronto para encontrar ou oferecer caronas.
          </p>
        </div>
      </div>

      {/* Contexto do Siará Tech Summit quando o usuário veio do formulário */}
      {isFromForm && (
        <div className="mb-5 rounded-2xl border border-caronaa-primary/30 bg-caronaa-primary/10 p-3.5 sm:p-4 text-xs sm:text-sm text-foreground flex items-start gap-3 shadow-sm">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-caronaa-primary/20 text-caronaa-primary font-bold">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-bold text-foreground">
              Você acabou de participar da validação da CARONAA no Siará Tech Summit.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seus dados de trajeto foram registrados. Conclua seu cadastro para vincular sua conta.
            </p>
          </div>
        </div>
      )}

      {regionNotice && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-caronaa-primary/40 bg-caronaa-primary/10 p-4 text-sm text-foreground"
        >
          <MapPinned className="mt-0.5 shrink-0 text-caronaa-primary" size={20} />
          <p>{regionNotice}</p>
        </div>
      )}

      {isGoogleCallback && user && regionStatus === "checking" && (
        <div role="status" className="mb-5 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Confirmando sua localização para continuar...
        </div>
      )}

      {/* Seletor de Modo (Tabs acessíveis) */}
      <div
        className="grid grid-cols-2 p-1 bg-muted/60 rounded-2xl mb-6 border border-border/60"
        role="tablist"
        aria-label="Opções de acesso"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "entrar"}
          onClick={() => setMode("entrar")}
          className={`py-2.5 px-3 text-sm font-bold rounded-xl transition ${
            mode === "entrar"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Entrar na CARONAA
        </button>
        {canRegister && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveMode === "cadastro"}
            onClick={() => setMode("cadastro")}
            className={`py-2.5 px-3 text-sm font-bold rounded-xl transition ${
              effectiveMode === "cadastro"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Criar minha conta
          </button>
        )}
      </div>

      {/* Formulário - Somente o necessário */}
      <form onSubmit={submit} className="space-y-4">
        {effectiveMode === "cadastro" && (
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground">
              Nome completo
            </Label>
            <div className="relative">
              <UserRound
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl border-border bg-auth-field pl-10 text-sm font-medium shadow-inner"
                placeholder="Como prefere ser chamado"
                autoComplete="name"
                required
              />
            </div>
          </div>
        )}
        {effectiveMode === "cadastro" && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-foreground">Gênero</legend>
            <div className="grid grid-cols-2 gap-2">
              {[['FEMININO', 'Feminino'], ['MASCULINO', 'Masculino']].map(([value, label]) => <button key={value} type="button" onClick={() => setGender(value as "FEMININO" | "MASCULINO")} className={`h-11 rounded-xl border text-sm font-bold ${gender === value ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card"}`}>{label}</button>)}
            </div>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-foreground">
            E-mail
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-border bg-auth-field pl-10 text-sm font-medium shadow-inner"
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Senha
            </Label>
            {effectiveMode === "entrar" && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs font-medium text-caronaa-primary-strong hover:text-caronaa-primary"
                onClick={openForgotPassword}
              >
                Esqueci minha senha
              </Button>
            )}
          </div>
          <div className="relative">
            <LockKeyhole
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-border bg-auth-field px-10 text-sm font-medium shadow-inner"
              placeholder={effectiveMode === "cadastro" ? "Mínimo de 6 caracteres" : "Sua senha"}
              autoComplete={effectiveMode === "cadastro" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-10"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-caronaa-primary text-sm font-bold text-caronaa-dark shadow-md hover:bg-caronaa-primary-strong transition mt-2"
          disabled={busy || (effectiveMode === "cadastro" && !gender)}
        >
          {busy ? (
            "Aguarde..."
          ) : effectiveMode === "cadastro" ? (
            "Criar minha conta"
          ) : (
            <>
              Entrar na CARONAA <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>

      {/* Autenticação social configurada */}
      {(
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou continue com
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-border bg-card text-sm font-bold shadow-sm hover:bg-muted"
            onClick={continueWithGoogle}
            disabled={busy}
          >
            <span className="text-base font-extrabold text-caronaa-primary mr-1">G</span> Continuar com
            Google
          </Button>
        </>
      )}

      {/* Alternância secundária */}
      {canRegister && (
        <div className="mt-6 border-t border-border pt-4 text-center text-xs font-medium text-muted-foreground">
          {mode === "entrar" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
          <button
            type="button"
            className="font-bold text-foreground underline underline-offset-4 hover:text-caronaa-primary-strong transition ml-1"
            onClick={() => setMode(mode === "entrar" ? "cadastro" : "entrar")}
          >
            {mode === "entrar" ? "Criar minha conta" : "Entrar na CARONAA"}
          </button>
        </div>
      )}

      {/* Links obrigatórios: Termos, Privacidade, Segurança */}
      <div className="mt-6 border-t border-border/70 pt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <Link
          to="/termos"
          className="hover:text-foreground underline underline-offset-4 transition"
        >
          Termos de Uso
        </Link>
        <span className="text-border" aria-hidden="true">
          •
        </span>
        <Link
          to="/privacidade"
          className="hover:text-foreground underline underline-offset-4 transition"
        >
          Privacidade
        </Link>
        <span className="text-border" aria-hidden="true">
          •
        </span>
        <Link
          to="/seguranca"
          className="hover:text-foreground underline underline-offset-4 transition"
        >
          Segurança
        </Link>
      </div>

      {/* Modal discreto: Esqueci minha senha */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card p-6 shadow-2xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="font-display text-xl font-extrabold text-foreground">
              Esqueci minha senha
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Digite o e-mail associado à sua conta CARONAA para receber as orientações de redefinição.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="mt-4 space-y-4 text-left">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-foreground">
                <p className="font-semibold text-foreground">Instruções enviadas</p>
                <p className="text-muted-foreground mt-0.5">
                  Se existir uma conta com este e-mail, enviaremos as instruções para definir uma nova senha.
                </p>
              </div>
              <Button
                type="button"
                className="w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground"
                onClick={() => setForgotOpen(false)}
              >
                Entendido
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSendReset} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-semibold text-foreground">
                  Seu e-mail
                </Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={17}
                  />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="h-11 rounded-xl border-border bg-auth-field pl-10 text-sm font-medium shadow-inner"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotBusy}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
                  disabled={forgotBusy}
                >
                  {forgotBusy ? "Enviando..." : "Enviar instruções"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  const features = [
    { icon: UsersRound, text: "Encontre caronas" },
    { icon: MapPinned, text: "Compartilhe trajetos" },
    { icon: ShieldCheck, text: "Viaje com segurança" },
  ];
  return (
    <main className="relative grid min-h-screen bg-background lg:grid-cols-[1.14fr_.86fr]">
      {/* Coluna visual esquerda para desktop */}
      <section className="relative hidden min-h-screen overflow-hidden px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
        <img
          src={desktopBackground.url}
          alt="Cidade conectada pelos trajetos da CARONAA"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_44%,oklch(0.79_0.17_76_/_0.28),transparent_23%),linear-gradient(180deg,oklch(0.12_0.03_249_/_0.08),oklch(0.12_0.03_249_/_0.42))]" />
        <div className="relative z-10 [&_img]:h-14">
          <Brand light />
        </div>
        <div className="relative z-10 max-w-2xl">
          <p className="text-base font-extrabold uppercase text-primary drop-shadow-[0_2px_10px_oklch(0.08_0.02_249_/_0.6)]">
            SUA CIDADE, SEU CAMINHO
          </p>
          <h2 className="mt-5 max-w-[680px] font-display text-[4.5rem] font-extrabold leading-[0.98] text-white drop-shadow-[0_8px_28px_oklch(0.08_0.02_249_/_0.55)] xl:text-[5.6rem]">
            Seu caminho
            <br />
            pode levar
            <br />
            <span className="text-primary drop-shadow-[0_4px_18px_oklch(0.79_0.17_76_/_0.35)]">
              alguém junto.
            </span>
          </h2>
          <p className="mt-7 max-w-xl text-[1.35rem] font-medium leading-relaxed text-white/82 drop-shadow-[0_4px_18px_oklch(0.08_0.02_249_/_0.45)]">
            Encontre pessoas indo para a mesma direção, compartilhe o trajeto e transforme
            deslocamentos em conexões.
          </p>
          <div className="mt-12 grid max-w-[760px] grid-cols-3 gap-5">
            {features.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex min-h-24 items-center gap-4 rounded-xl border border-white/20 bg-white/[0.06] px-5 shadow-[0_18px_40px_-28px_oklch(0.02_0.02_249_/_0.9)] backdrop-blur-sm"
              >
                <Icon className="shrink-0 text-primary" size={29} strokeWidth={2.4} />
                <span className="text-base font-bold leading-tight text-white">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 flex items-center gap-5 text-base font-medium text-white/68">
          <span className="h-px w-14 bg-white/70" />
          Juntos chegamos mais longe.
        </p>
      </section>

      {/* Coluna de formulário responsiva */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfaf6] dark:bg-background px-4 py-8 sm:px-8 md:px-10">
        <picture className="absolute inset-0 lg:hidden">
          <img src={mobileBackground.url} alt="" className="size-full object-cover" />
        </picture>
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm lg:hidden" />
        <div className="relative z-10 w-full max-w-[540px] rounded-3xl border border-white/70 dark:border-border/70 bg-card/95 p-6 shadow-xl md:p-10">
          {children}
        </div>
      </section>
    </main>
  );
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered"))
    return "Este e-mail já possui uma conta. Entre com sua senha.";
  if (message.includes("password"))
    return "Use uma senha mais segura, com pelo menos 6 caracteres.";
  if (message.includes("rate limit"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (message.includes("database error"))
    return "Não foi possível criar a conta agora. Tente novamente em instantes.";
  return "Não foi possível continuar. Verifique os dados e tente novamente.";
}
