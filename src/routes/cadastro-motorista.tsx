import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/caronaa/BrandElements";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { detailsSchema } from "@/lib/mototaxi-registration";

export const Route = createFileRoute("/cadastro-motorista")({
  ssr: false,
  component: ProfessionalMotorcycleRegistration,
  head: () => ({ meta: [{ title: "Dados profissionais — CARONAA" }] }),
});

const photoTypes = ["image/jpeg", "image/png", "image/webp"];

function ProfessionalMotorcycleRegistration() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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
  const [busy, setBusy] = useState(false);
  const [onboardingState, setOnboardingState] = useState<"checking" | "ready" | "error">("checking");
  const [onboardingRetry, setOnboardingRetry] = useState(0);

  // A professional application is not a second sign-up.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.email_confirmed_at) {
      void navigate({
        to: "/auth",
        search: { mode: user ? "entrar" : "cadastro", redirect: "/cadastro-motorista" },
        replace: true,
      });
      return;
    }
    let alive = true;
    setOnboardingState("checking");
    void readOnboarding().then(progress => {
      if (!alive) return;
      if (progress?.status !== "BASIC_COMPLETED" || progress.current_step !== "DONE") {
        void navigate({ to: "/onboarding", search: { redirect: "/cadastro-motorista" }, replace: true });
        return;
      }
      setOnboardingState("ready");
    }).catch(() => { if (alive) setOnboardingState("error"); });
    return () => { alive = false; };
  }, [authLoading, user?.id, user?.email_confirmed_at, navigate, onboardingRetry]);

  useEffect(() => {
    if (!user?.email_confirmed_at || onboardingState !== "ready") return;
    let active = true;
    setReviewState("loading");
    void Promise.all([
      (supabase as any).from("professional_mototaxi_profiles").select("first_name,last_name,whatsapp_e164,region_code,registration_number").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("avatar_url,vehicle_plate,full_name").eq("id", user.id).maybeSingle(),
      (supabase as any).rpc("get_my_professional_access"),
    ]).then(([details, profile, access]) => {
      if (!active) return;
      if (details.data) {
        setFirstName(details.data.first_name ?? "");
        setLastName(details.data.last_name ?? "");
        setWhatsapp(details.data.whatsapp_e164 ?? "");
        setRegion(details.data.region_code === "FORTALEZA" ? "FORTALEZA" : "MACICO_BATURITE");
        setRegistrationNumber(details.data.registration_number ?? "");
      } else {
        const fullName = String(profile.data?.full_name || user.user_metadata?.full_name || "").trim();
        const parts = fullName.split(/\s+/).filter(Boolean);
        setFirstName(parts[0] ?? "");
        setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
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
  }, [user?.id, user?.email_confirmed_at, onboardingState, reviewRetry]);


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
      toast.success("Cadastro salvo. Você já pode usar caronas comuns; o acesso profissional requer habilitação.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar sua solicitação.");
    } finally { setBusy(false); }
  }


  if (authLoading || !user?.email_confirmed_at || onboardingState !== "ready") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#121212] px-4 text-white">
        <section className="w-full max-w-sm space-y-4 rounded-3xl border border-white/15 bg-[#1b1b1b] p-6">
          <BrandLogo size="lg" className="max-w-[185px]" />
          {onboardingState === "error" && user?.email_confirmed_at ? (
            <>
              <h1 className="font-display text-lg font-bold">Não foi possível conferir seu cadastro universal</h1>
              <p role="alert" className="text-sm text-white/70">Aguarde a verificação antes de enviar uma solicitação profissional.</p>
              <button type="button" onClick={() => setOnboardingRetry(current => current + 1)}
                className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">
                Tentar novamente
              </button>
            </>
          ) : <p role="status" className="text-sm text-white/70">Abrindo seu cadastro universal…</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-[#121212] px-3 py-5 text-white sm:items-center sm:px-5 sm:py-10">
      <section className="w-full max-w-[460px] space-y-5 rounded-3xl border border-white/15 bg-[#1b1b1b] p-4 shadow-xl sm:p-7">
        <Link to="/" aria-label="CARONAA — página inicial" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]"><BrandLogo size="lg" className="max-w-[205px]" /></Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#FFBB00]">Complemento profissional</p>
          <h1 className="mt-2 font-display text-2xl font-bold">{authorized && reviewState === "ready" ? "Cadastro aprovado" : "Seus dados profissionais"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{authorized && reviewState === "ready" ? "Seu acesso está liberado. Abra o cockpit para trabalhar." : "Sua conta universal já está criada. Complete apenas os dados da atividade e acompanhe a aprovação profissional."}</p>
        </div>
        {reviewState !== "ready" ? (
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
            {request?.status === "PENDING" && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm">
                <p className="font-bold text-white">Você já pode utilizar as caronas comuns</p>
                <p className="mt-1 text-white/75">O cadastro profissional segue uma habilitação separada. Enquanto isso, você pode buscar e oferecer caronas compartilhadas na mesma conta.</p>
                <Link to="/home" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">
                  Abrir CARONAA
                </Link>
              </div>
            )}
            {request && <div role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
              Solicitação: <strong>{request.status === "PENDING" ? "Em análise" : request.status === "APPROVED" ? "Aprovada" : request.status === "REJECTED" ? "Rejeitada" : "Correções solicitadas"}</strong>
              {request.review_reason && <p>Observação: {request.review_reason}</p>}
            </div>}
            <form className="space-y-3" onSubmit={sendRequest}>
              <div className="grid gap-3 min-[390px]:grid-cols-2">
                <label className="block text-sm">Primeiro nome<input required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" /></label>
                <label className="block text-sm">Último sobrenome<input required value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-[#232323] p-3" /></label>
              </div>
              <p className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/70">Conta universal: <strong className="break-all text-white">{user.email}</strong></p>
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
