import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/cadastro-motorista")({
  ssr: false,
  component: SimpleMotorcycleRegistration,
  head: () => ({ meta: [{ title: "Cadastro de mototaxista — CARONAA" }] }),
});

const detailsSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu primeiro nome.").max(70).regex(/^\S+$/, "Use apenas o primeiro nome."),
  lastName: z.string().trim().min(2, "Informe seu último sobrenome.").max(70).regex(/^\S+$/, "Use apenas o último sobrenome."),
  whatsapp: z.string().transform(v => v.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, ""))
    .refine(v => /^[1-9][0-9]9[0-9]{8}$/.test(v), "Informe WhatsApp com DDD."),
  region: z.enum(["MACICO_BATURITE", "FORTALEZA"]),
  registrationNumber: z.string().trim().min(2, "Informe sua matrícula/registro.").max(80),
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
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.email_confirmed_at) return;
    let active = true;
    void Promise.all([
      (supabase as any).from("professional_mototaxi_profiles").select("first_name,last_name,whatsapp_e164,region_code,registration_number").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
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
      setPhotoUrl(profile.data?.avatar_url ?? "");
      setRequest(access.data?.request ?? null);
      setAuthorized(access.data?.authorized === true);
      if (details.error || profile.error || access.error) {
        toast.error("Não foi possível carregar todos os dados do cadastro.");
      }
    }).catch(() => { if (active) toast.error("Falha ao consultar o cadastro."); });
    return () => { active = false; };
  }, [user?.id, user?.email_confirmed_at]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" && (password !== confirm || password.length < 8)) {
      toast.error(password !== confirm ? "As senhas não conferem." : "Use pelo menos oito caracteres.");
      return;
    }
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
          toast.success("Confira o e-mail para confirmar sua conta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
      setPassword(""); setConfirm("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na autenticação.");
    } finally { setBusy(false); }
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
    <main className="min-h-[100dvh] bg-[#121212] px-4 py-8 text-white">
      <section className="mx-auto max-w-md space-y-5 rounded-3xl border border-white/15 bg-white/[0.04] p-5 sm:p-7">
        <Link to="/" className="font-display text-xl font-extrabold tracking-wide">CARONAA<span className="text-[#FFBB00]">.</span></Link>
        <div>
          <h1 className="mt-2 font-display text-2xl font-bold">Quero ser mototaxista</h1>
          <p className="mt-2 text-sm text-white/65">Cadastro simplificado. Envie os dados e peça aprovação ao administrativo, sem aguardar o lançamento.</p>
        </div>
        {authLoading ? <p>Verificando sua conta...</p> : !user?.email_confirmed_at ? confirmationSent ? (
          <div className="space-y-3" role="status">
            <p>Enviamos um link de confirmação para {email}. Após confirmar, retorne a esta página para concluir seu cadastro.</p>
            <button type="button" className="rounded-xl border border-white/30 p-3" onClick={() => { setConfirmationSent(false); setMode("login"); }}>Já confirmei — entrar</button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={authenticate}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={mode === "signup" ? "rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212]" : "rounded-xl border border-white/20 p-3"} onClick={() => setMode("signup")}>Criar conta</button>
              <button type="button" className={mode === "login" ? "rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212]" : "rounded-xl border border-white/20 p-3"} onClick={() => setMode("login")}>Já tenho conta</button>
            </div>
            <label className="block text-sm">E-mail (login)<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
            <label className="block text-sm">Senha<input type="password" minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
            {mode === "signup" && <label className="block text-sm">Confirmar senha<input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>}
            <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#FFBB00] p-3 font-bold text-[#121212] disabled:opacity-50">{busy ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : "Entrar e continuar"}</button>
            <Link to="/auth" className="block text-center text-xs text-white/70 underline">Voltar ao login convencional</Link>
          </form>
        ) : (
          <>
            {request && <div role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
              Solicitação: <strong>{request.status === "PENDING" ? "Em análise" : request.status === "APPROVED" ? "Aprovada" : request.status === "REJECTED" ? "Rejeitada" : "Correções solicitadas"}</strong>
              {request.review_reason && <p>Observação: {request.review_reason}</p>}
            </div>}
            {authorized && <p className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm">Seu acesso foi aprovado. <Link to="/disponibilidade-profissional" className="font-bold text-[#FFBB00] underline">Abrir disponibilidade profissional</Link></p>}
            <form className="space-y-3" onSubmit={sendRequest}>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">Primeiro nome<input required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
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
            <button type="button" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="text-sm text-white/65 underline">Sair da conta</button>
          </>
        )}
      </section>
    </main>
  );
}
