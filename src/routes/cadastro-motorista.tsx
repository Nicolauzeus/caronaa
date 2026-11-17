import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/caronaa/BrandElements";
import { generateProfessionalPassword, passwordGuidance, registrationPasswordError, professionalAuthErrorMessage, professionalAuthErrorCode } from "@/lib/professional-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { detailsSchema } from "@/lib/mototaxi-registration";

export const Route = createFileRoute("/cadastro-motorista")({
  ssr: false,
  component: SimpleMotorcycleRegistration,
  head: () => ({ meta: [{ title: "Cadastro de mototaxista — CARONAA" }] }),
});

const photoTypes = ["image/jpeg", "image/png", "image/webp"];

function SimpleMotorcycleRegistration() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [region, setRegion] = useState<"MACICO_BATURITE" | "FORTALEZA">("MACICO_BATURITE");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [request, setRequest] = useState<{ status: string; review_reason?: string | null } | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [reviewState, setReviewState] = useState<"loading" | "ready" | "error">("loading");
  const [reviewRetry, setReviewRetry] = useState(0);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const strength = passwordGuidance(password);

  useEffect(() => {
    if (!user?.email_confirmed_at) return;
    let active = true;
    setReviewState("loading");
    void Promise.all([
      (supabase as any).from("professional_mototaxi_profiles").select("first_name,last_name,whatsapp_e164,region_code,registration_number").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("avatar_url,vehicle_plate").eq("id", user.id).maybeSingle(),
      (supabase as any).rpc("get_my_professional_access"),
    ]).then(([details, profile, access]) => {
      if (!active) return;
      if (details.data) {
        setFirstName(details.data.first_name ?? "");
        setLastName(details.data.last_name ?? "");
        setWhatsapp(details.data.whatsapp_e164 ?? "");
        setRegion(details.data.region_code === "FORTALEZA" ? "FORTALEZA" : "MACICO_BATURITE");
        setRegistrationNumber(details.data.registration_number ?? "");
      }
      if (access.error) {
        setReviewState("error");
        toast.error("Não foi possível confirmar a situação do seu acesso profissional.");
        return;
      }
      setPhotoUrl(profile.data?.avatar_url ?? "");
      setVehiclePlate(profile.data?.vehicle_plate ?? "");
      setRequest(access.data?.request ?? null);
      setAuthorized(access.data?.authorized === true);
      setReviewState("ready");
      if (details.error || profile.error) {
        toast.error("Alguns dados cadastrais não puderam ser carregados.");
      }
    }).catch(() => {
      if (active) {
        setReviewState("error");
        toast.error("Falha ao consultar a situação do cadastro.");
      }
    });
    return () => { active = false; };
  }, [user?.id, user?.email_confirmed_at, reviewRetry]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" && registrationPasswordError(password, confirm)) {
      setFeedback(registrationPasswordError(password, confirm) ?? "Confira sua senha.");
      return;
    }
    setFeedback("");
    setAuthErrorCode(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { emailRedirectTo: window.location.origin + "/cadastro-motorista" },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationSent(true);
          setPassword("");
          setConfirm("");
          toast.success("Confira o e-mail para confirmar sua conta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
      setPassword(""); setConfirm("");
    } catch (error) {
      setAuthErrorCode(professionalAuthErrorCode(error));
      setFeedback(professionalAuthErrorMessage(error));
    } finally { setBusy(false); }
  }

  function changeMode(next: "signup" | "login") {
    setMode(next);
    setPassword("");
    setConfirm("");
    setFeedback("");
    setAuthErrorCode(null);
    setResetMode(false);
    setShowPassword(false);
    setShowConfirm(false);
  }

  function suggestPassword() {
    try {
      const generated = generateProfessionalPassword();
      setPassword(generated);
      setConfirm(generated);
      setShowPassword(true);
      setFeedback("Senha forte preenchida. Guarde-a em um gerenciador de senhas.");
    } catch {
      setFeedback("Não foi possível gerar uma senha. Escolha uma senha segura.");
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error && /rate limit|too many requests/i.test(error.message)) {
        setFeedback("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setResetSent(true);
      }
    } catch {
      setResetSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(event: FormEvent) {
    event.preventDefault();
    const parsed = detailsSchema.safeParse({ firstName, lastName, whatsapp, region, registrationNumber });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira o cadastro."); return; }
    if (!user?.email_confirmed_at) { toast.error("Confirme seu e-mail para continuar."); return; }
    if (!photo && !photoUrl) { toast.error("Adicione uma foto pessoal."); return; }
    if (photo && (photo.size > 5 * 1024 * 1024 || !photoTypes.includes(photo.type))) {
      toast.error("Use foto JPG, PNG ou WebP de até 5 MB."); return;
    }
    setBusy(true);
    try {
      if (photo) {
        // The existing avatars bucket restricts uploads to the authenticated user's folder.
        // A fixed filename is avoided so an old photograph does not remain cached.
        const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = user.id + "/" + crypto.randomUUID() + "." + ext;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, photo, {
          upsert: false, contentType: photo.type,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
        const { error: profileError } = await supabase.from("profiles")
          .update({ avatar_url: publicData.publicUrl, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (profileError) throw profileError;
        setPhotoUrl(publicData.publicUrl);
        setPhoto(null);
      }
      const { error } = await (supabase as any).rpc("submit_simple_mototaxi_access", {
        p_first_name: parsed.data.firstName, p_last_name: parsed.data.lastName,
        p_whatsapp: parsed.data.whatsapp, p_region: parsed.data.region,
        p_registration_number: parsed.data.registrationNumber,
      });
      if (error) throw error;
      const { data: refreshed, error: refreshError } = await (supabase as any).rpc("get_my_professional_access");
      if (refreshError) throw refreshError;
      setRequest(refreshed?.request ?? null);
      setAuthorized(refreshed?.authorized === true);
      toast.success("Solicitação enviada ao administrativo. Não há período de carência.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar sua solicitação.");
    } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-[#121212] px-3 py-5 text-white sm:items-center sm:px-5 sm:py-10">
      <section className="w-full max-w-[460px] space-y-5 rounded-3xl border border-white/15 bg-[#1b1b1b] p-4 shadow-xl sm:p-7">
        <Link to="/" aria-label="CARONAA — página inicial" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]"><BrandLogo size="lg" className="max-w-[205px]" /></Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#FFBB00]">Acesso profissional</p>
          <h1 className="mt-2 font-display text-2xl font-bold">{user?.email_confirmed_at ? authorized && reviewState === "ready" ? "Cadastro aprovado" : "Seu cadastro de mototaxista" : resetMode ? "Recuperar acesso" : confirmationSent ? "Confirme seu e-mail" : mode === "login" ? "Bem-vindo de volta" : "Quero ser mototaxista"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{user?.email_confirmed_at ? authorized && reviewState === "ready" ? "Seu acesso está liberado. Abra o cockpit para trabalhar." : "Revise seus dados profissionais e acompanhe sua solicitação." : resetMode ? "Enviaremos instruções para redefinir sua senha." : mode === "login" ? "Entre para continuar seu cadastro ou consultar sua aprovação." : "Crie sua conta para enviar seus dados profissionais e solicitar aprovação."}</p>
        </div>
        {authLoading ? <p>Verificando sua conta...</p> : !user?.email_confirmed_at ? confirmationSent ? (
          <div className="space-y-3" role="status">
            <p>Enviamos um link de confirmação para {email}. Após confirmar, retorne a esta página para concluir seu cadastro.</p>
            <button type="button" className="rounded-xl border border-white/30 p-3" onClick={() => { setConfirmationSent(false); setMode("login"); }}>Já confirmei — entrar</button>
          </div>
        ) : resetMode ? (
          <form className="space-y-4" onSubmit={resetPassword}>
            {resetSent ? <p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.</p> : (
              <>
                <label className="block text-sm">E-mail
                  <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 text-base focus-visible:border-[#FFBB00]" />
                </label>
                {feedback && <p role="alert" className="rounded-xl border border-red-400/40 p-3 text-sm text-red-200">{feedback}</p>}
                <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212] disabled:opacity-50">{busy ? "Enviando..." : "Enviar instruções"}</button>
              </>
            )}
            <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setFeedback(""); }} className="min-h-11 w-full text-sm text-white/75 underline">Voltar ao login</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={authenticate}>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Opções de acesso">
              <button type="button" disabled={busy} aria-pressed={mode === "signup"} className={mode === "signup" ? "min-h-12 rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212]" : "min-h-12 rounded-xl border border-white/20 p-3"} onClick={() => changeMode("signup")}>Criar conta</button>
              <button type="button" disabled={busy} aria-pressed={mode === "login"} className={mode === "login" ? "min-h-12 rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212]" : "min-h-12 rounded-xl border border-white/20 p-3"} onClick={() => changeMode("login")}>Já tenho conta</button>
            </div>
            <label className="block text-sm">E-mail (login)<input type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" /></label>
            <div>
              <label htmlFor="professional-password" className="block text-sm">Senha</label>
              <div className="relative">
                <input id="professional-password" type={showPassword ? "text" : "password"} minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={e => { setPassword(e.target.value); setFeedback(""); }} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 pr-14 text-base outline-none focus-visible:border-[#FFBB00]" />
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} className="absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-lg text-white/70 focus-visible:ring-2 focus-visible:ring-[#FFBB00]">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
              </div>
              {mode === "signup" ? <div className="mt-2 space-y-2">
                <div className="flex gap-1" aria-hidden="true">{[1,2,3,4].map(n => <span key={n} className={"h-1 flex-1 rounded-full " + (strength.score >= n ? "bg-[#FFBB00]" : "bg-white/15")} />)}</div>
                <div className="flex items-center justify-between gap-2 text-xs">{password && <span aria-live="polite" className="text-white/70">Força: {strength.label}</span>}<button type="button" onClick={suggestPassword} className="ml-auto inline-flex min-h-10 items-center gap-1.5 font-semibold text-[#FFBB00] underline"><KeyRound size={15} /> Sugerir senha forte</button></div>
              </div> : <button type="button" onClick={() => { setResetMode(true); setFeedback(""); }} className="mt-1 min-h-10 text-sm font-semibold text-[#FFBB00] underline">Esqueci minha senha</button>}
            </div>
            {mode === "signup" && <div>
              <label htmlFor="professional-confirm" className="block text-sm">Confirmar senha</label>
              <div className="relative">
                <input id="professional-confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" required value={confirm} aria-invalid={Boolean(confirm && confirm !== password)} onChange={e => { setConfirm(e.target.value); setFeedback(""); }} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 pr-14 text-base outline-none focus-visible:border-[#FFBB00]" />
                <button type="button" aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"} aria-pressed={showConfirm} onClick={() => setShowConfirm(v => !v)} className="absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-lg text-white/70 focus-visible:ring-2 focus-visible:ring-[#FFBB00]">{showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}</button>
              </div>
              {confirm && <p aria-live="polite" className={"mt-1 text-xs " + (confirm !== password ? "text-red-300" : "text-white/65")}>{confirm === password ? "As senhas coincidem." : "As senhas não coincidem."}</p>}
            </div>}
            {feedback && <div role="alert" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm"><p>{feedback}</p>{authErrorCode && <p className="mt-2 text-xs text-white/65">Referência técnica: {authErrorCode}</p>}</div>}
            <button disabled={busy} aria-busy={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212] disabled:opacity-50">{busy && <LoaderCircle size={18} className="animate-spin" />}{busy ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : "Entrar e continuar"}</button>
            <Link to="/auth" className="block min-h-10 pt-2 text-center text-xs text-white/70 underline">Voltar ao login convencional</Link>
          </form>
        ) : reviewState !== "ready" ? (
          <div className="space-y-4" role="status" aria-live="polite">
            {reviewState === "loading" ? (
              <div className="space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10"/>
                <div className="h-20 animate-pulse rounded-2xl bg-white/10"/>
                <p className="text-sm text-white/70">Consultando sua aprovação profissional...</p>
              </div>
            ) : (
              <>
                <p role="alert" className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 p-4 text-sm">
                  Não foi possível confirmar sua aprovação. Para evitar um novo pedido indevido, o formulário está temporariamente oculto.
                </p>
                <button type="button" onClick={() => setReviewRetry(value => value + 1)}
                  className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">
                  Tentar novamente
                </button>
              </>
            )}
          </div>
        ) : authorized || request?.status === "APPROVED" ? (
          <section className="space-y-5 rounded-2xl border border-[#FFBB00]/25 bg-[#121212] p-4 sm:p-5" aria-label="Credencial profissional">
            <div className="flex justify-center">
              <span className="relative flex size-16 items-center justify-center rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/15">
                <ShieldCheck className="size-9 text-[#FFBB00]" aria-hidden="true"/>
                <CheckCircle2 className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#121212] text-emerald-400" aria-hidden="true"/>
              </span>
            </div>
            <div className="space-y-2 text-center">
              <h2 className="font-[Sora] text-xl font-extrabold">
                {authorized ? "Você é um Mototaxista Verificado CARONAA" : "Seu cadastro foi aprovado"}
              </h2>
              <p className="text-xs leading-relaxed text-white/65">
                {authorized ? "Acesso profissional autorizado pelo CARONAA." : "A liberação operacional ainda precisa ser confirmada."}
                {" "}A aprovação administrativa não substitui a validação documental ou exigências legais.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-[11px] text-white/55">Região cadastrada</p>
                <p className="mt-1 break-words text-xs font-bold">{region === "FORTALEZA" ? "Fortaleza" : "Maciço de Baturité"}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-[11px] text-white/55">Matrícula</p>
                <p className="mt-1 break-words text-xs font-bold">{registrationNumber || "Não informada"}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-[11px] text-white/55">Placa</p>
                <p className="mt-1 break-words text-xs font-bold">{vehiclePlate || "Não informada"}</p>
              </div>
            </div>
            {authorized && <Link to="/disponibilidade-profissional"
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#FFBB00] px-4 text-center font-[Sora] text-sm font-black text-[#121212]">
              IR PARA O COCKPIT DO MOTORISTA
            </Link>}
            <p className="text-center text-xs text-white/55">
              Precisa atualizar seus dados cadastrais? Fale com o suporte.
            </p>
            <button type="button" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}
              className="min-h-11 w-full text-sm text-white/65 underline">Sair da conta</button>
          </section>
        ) : (
          <>
            {request && <div role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
              Solicitação: <strong>{request.status === "PENDING" ? "Em análise" : request.status === "APPROVED" ? "Aprovada" : request.status === "REJECTED" ? "Rejeitada" : "Correções solicitadas"}</strong>
              {request.review_reason && <p>Observação: {request.review_reason}</p>}
            </div>}
            <form className="space-y-3" onSubmit={sendRequest}>
              <div className="grid gap-3 min-[390px]:grid-cols-2">
                <label className="block text-sm">Primeiro nome<input required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" /></label>
                <label className="block text-sm">Último sobrenome<input required value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
              </div>
              <label className="block text-sm">E-mail (login)<input disabled value={user.email ?? ""} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3 opacity-70" /></label>
              <label className="block text-sm">WhatsApp com DDD<input type="tel" required inputMode="tel" value={whatsapp} placeholder="(85) 99999-9999" onChange={e => setWhatsapp(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
              <label className="block text-sm">Região<select value={region} onChange={e => setRegion(e.target.value as typeof region)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3">
                <option value="MACICO_BATURITE">Maciço de Baturité</option><option value="FORTALEZA">Fortaleza e região metropolitana</option>
              </select></label>
              <label className="block text-sm">Matrícula / registro de mototaxista<input required value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
              <label className="block text-sm">Foto pessoal
                {photoUrl && <img src={photoUrl} alt="Sua foto atual" className="my-2 size-20 rounded-full object-cover" />}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPhoto(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
              </label>
              <p className="text-xs text-white/55">A matrícula é declaratória. A aprovação administrativa não substitui licenças ou exigências legais para operação.</p>
              <button disabled={busy || request?.status === "PENDING" || (authorized && request?.status === "APPROVED")} className="min-h-12 w-full rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212] disabled:opacity-50">
                {busy ? "Enviando..." : request?.status === "PENDING" ? "Aguardando análise administrativa" : authorized ? "Acesso aprovado" : "Solicitar acesso ao radar"}
              </button>
            </form>
            <button type="button" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="min-h-11 text-sm text-white/65 underline">Sair da conta</button>
          </>
        )}
      </section>
    </main>
  );
}
