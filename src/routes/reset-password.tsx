import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LockKeyhole, Eye, EyeOff, ShieldAlert, Check } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — CARONAA" },
      { name: "description", content: "Crie uma nova senha para sua conta CARONAA." },
      { property: "og:title", content: "Redefinir senha — CARONAA" },
      { property: "og:description", content: "Crie uma nova senha para sua conta CARONAA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const isRecoveryLink =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery") ||
      window.location.hash.includes("access_token");

    void supabase.auth
      .getSession()
      .then(({ data }) => setReady(Boolean(data.session) || isRecoveryLink));

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const hasMinLength = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);

    if (!hasMinLength) {
      setFieldError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setFieldError("As senhas não coincidem. Digite a mesma senha em ambos os campos.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFieldError(error.message);
        toast.error(error.message);
      } else {
        setDone(true);
        toast.success("Senha atualizada com sucesso.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível atualizar a senha.";
      setFieldError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl md:p-8">
        <Brand />
        {done ? (
          <div className="mt-8 text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-foreground">
                Senha atualizada com sucesso
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sua nova senha foi salva. Você já pode continuar navegando na CARONAA.
              </p>
            </div>
            <Button
              className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-sm hover:opacity-90"
              onClick={() => navigate({ to: "/home" })}
            >
              Continuar para o aplicativo
            </Button>
          </div>
        ) : ready ? (
          <>
            <div className="mt-8 space-y-1">
              <h1 className="font-display text-2xl font-extrabold text-foreground">
                Defina uma nova senha
              </h1>
              <p className="text-xs text-muted-foreground">
                Escolha uma senha segura para proteger sua conta CARONAA.
              </p>
            </div>

            {fieldError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{fieldError}</span>
              </div>
            )}

            <form onSubmit={updatePassword} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold text-foreground">
                  Nova senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    className="h-12 rounded-xl border-border bg-background px-10 text-sm font-medium shadow-inner"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    minLength={6}
                    required
                    placeholder="Mínimo de 6 caracteres"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 size-10"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold text-foreground">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="h-12 rounded-xl border-border bg-background px-10 text-sm font-medium shadow-inner"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    minLength={6}
                    required
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 size-10"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>

              {/* Indicadores visuais dos requisitos */}
              <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
                <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                  Requisitos de segurança
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`flex size-4 items-center justify-center rounded-full ${hasMinLength ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span className={hasMinLength ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Pelo menos 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`flex size-4 items-center justify-center rounded-full ${passwordsMatch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span className={passwordsMatch ? "text-foreground font-medium" : "text-muted-foreground"}>
                    As senhas são idênticas
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md hover:opacity-90"
                disabled={busy || !hasMinLength || !passwordsMatch}
              >
                {busy ? "Atualizando..." : "Salvar nova senha"}
              </Button>
            </form>
          </>
        ) : (
          <div className="mt-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-extrabold text-foreground">
              Link inválido ou expirado
            </h1>
            <p className="text-xs text-muted-foreground">
              O link de redefinição expirou ou já foi utilizado. Solicite um novo link na tela de login.
            </p>
            <Button asChild variant="outline" className="mt-4 h-12 w-full rounded-xl">
              <Link to="/auth">Voltar para entrar</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
