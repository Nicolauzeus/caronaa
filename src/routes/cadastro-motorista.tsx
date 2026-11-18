import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/caronaa/BrandElements";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { getVehicleStatus } from "@/lib/role/use-active-role";
import { ProfessionalAccessRequest } from "@/components/caronaa/ProfessionalAccessRequest";
import { parseMissingError, MISSING_LABELS, type MissingCode } from "@/lib/professional-access";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  professionalFormCorrections,
  professionalServerCorrections,
  professionalFieldLabels,
  professionalPhotoTypes,
  type ProfessionalCorrections,
  type ProfessionalField,
} from "@/lib/mototaxi-registration";

export const Route = createFileRoute("/cadastro-motorista")({
  ssr: false,
  component: ProfessionalMotorcycleRegistration,
  head: () => ({ meta: [{ title: "Dados profissionais — CARONAA" }] }),
});

function ProfessionalMotorcycleRegistration() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [region, setRegion] = useState<"" | "MACICO_BATURITE" | "FORTALEZA">("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [request, setRequest] = useState<{ status: string; review_reason?: string | null } | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [reviewState, setReviewState] = useState<"loading" | "ready" | "error">("loading");
  const [reviewError,setReviewError]=useState("");
  const [reviewRetry, setReviewRetry] = useState(0);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [registeredVehicle,setRegisteredVehicle]=useState<"CAR"|"MOTO"|null>(null);
  const [carSeats,setCarSeats]=useState(1);
  const [carMunicipality,setCarMunicipality]=useState("");
  const [vehicleCorrections,setVehicleCorrections]=useState<MissingCode[]>([]);
  const [sessionExpired,setSessionExpired]=useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverCorrections, setServerCorrections] = useState<ProfessionalCorrections>({});
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [onboardingState, setOnboardingState] = useState<"checking" | "ready" | "error">("checking");
  const [onboardingRetry, setOnboardingRetry] = useState(0);
  const onCarAuthorized=useCallback((value:boolean)=>{
    if(value)void navigate({to:"/disponibilidade-profissional",replace:true});
  },[navigate]);

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
      if (progress?.status !== "BASIC_COMPLETED") {
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
    setReviewError("");
    void Promise.all([
      (supabase as any).from("professional_mototaxi_profiles").select("first_name,last_name,whatsapp_e164,region_code,registration_number").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("avatar_url,vehicle_plate,full_name,vehicle_brand,vehicle_description,vehicle_color,vehicle_type,vehicle_seats,city").eq("id", user.id).maybeSingle(),
      (supabase as any).rpc("get_my_professional_access"),
    ]).then(([details, profile, access]) => {
      if (!active) return;
      if(profile.error || !profile.data){
        const detail=String(profile.error?.message??"");
        if(/refresh_token|jwt|token.*expired|invalid.*session/i.test(detail)){
          setSessionExpired(true);
          setReviewError("Sua sessão expirou. Entre novamente para verificar o cadastro.");
        }else setReviewError("Não foi possível verificar os dados obrigatórios do veículo.");
        setReviewState("error");
        return;
      }
      // No one may finish professional registration by bypassing the
      // universal vehicle/photo completion. Applies to historical applicants.
      const validVehicle=getVehicleStatus(profile.data).isComplete;
      const hasPhoto=Boolean(profile.data.avatar_url?.trim());
      if(!validVehicle || !hasPhoto || !["car","moto"].includes(String(profile.data.vehicle_type))){
        void navigate({to:"/cadastro-veiculo",
          search:{redirect:"/cadastro-motorista"},replace:true});
        return;
      }
      setRegisteredVehicle(profile.data.vehicle_type==="moto"?"MOTO":"CAR");
      setCarSeats(Number(profile.data.vehicle_seats)||1);
      setCarMunicipality(typeof profile.data.city==="string"?profile.data.city:"");
      if (details.data) {
        setFirstName(details.data.first_name ?? "");
        setLastName(details.data.last_name ?? "");
        setWhatsapp(details.data.whatsapp_e164 ?? "");
        setRegion(details.data.region_code === "FORTALEZA" ? "FORTALEZA" : details.data.region_code === "MACICO_BATURITE" ? "MACICO_BATURITE" : "");
        setRegistrationNumber(details.data.registration_number ?? "");
      } else {
        const fullName = String(profile.data?.full_name || user.user_metadata?.full_name || "").trim();
        const parts = fullName.split(/\s+/).filter(Boolean);
        setFirstName(parts[0] ?? "");
        setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
      }
      if(access.error){
        const code=String(access.error.code??"");
        const detail=String(access.error.message??"");
        if(code==="22P02")setReviewError("Erro interno 22P02 ao verificar cadastro. Aplicar a correção SQL 0211.");
        else if(/refresh_token|jwt|token.*expired|invalid.*session/i.test(detail)||code==="PGRST301"){
          setSessionExpired(true);
          setReviewError("Sessão expirada. Entre novamente.");
        }else setReviewError("Não foi possível confirmar a situação do seu acesso profissional.");
        setReviewState("error");
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
        setReviewError("Falha temporária ao consultar o cadastro.");
      }
    });
    return () => { active = false; };
  }, [user?.id, user?.email_confirmed_at, onboardingState, reviewRetry]);



  const localCorrections = professionalFormCorrections({
    firstName, lastName, whatsapp, region, registrationNumber, photo, photoUrl,
    userId: user?.id ?? "",
  });
  const corrections: ProfessionalCorrections = attempted
    ? { ...localCorrections, ...serverCorrections } : {};
  const missingFields = (Object.keys(professionalFieldLabels) as ProfessionalField[])
    .filter(field => Boolean(corrections[field]));
  const clearCorrection = (field: ProfessionalField) => {
    setServerCorrections(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setSubmissionMessage("");
  };
  const focusMissing = (fields: ProfessionalField[]) => {
    if (!fields.length) return;
    const focus = () => document.getElementById("prof-" + fields[0])?.focus();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focus);
    } else {
      focus();
    }
  };

  async function confirmData(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setServerCorrections({});
    setVehicleCorrections([]);
    setSubmissionMessage("");
    if(registeredVehicle!=="MOTO"){
      setSubmissionMessage("O veículo registrado é um carro. Utilize a habilitação de carro, sem preencher novamente os dados de mototáxi.");
      return;
    }
    if (Object.keys(localCorrections).length) {
      focusMissing(Object.keys(localCorrections) as ProfessionalField[]);
      return;
    }
    if (!user?.email_confirmed_at || reviewState !== "ready") {
      setSubmissionMessage("Verifique sua sessão e tente novamente.");
      return;
    }
    setBusy(true);
    try {
      // Refresh-token 400 is an authentication problem, not missing fields.
      // Verify the session BEFORE performing image uploads or SQL writes.
      const {data:authenticated,error:authError}=await supabase.auth.getUser();
      if(authError || authenticated.user?.id!==user.id){
        setSessionExpired(true);
        setSubmissionMessage("A sessão expirou. Entre novamente para concluir com segurança; os dados já salvos permanecem no CARONAA.");
        return;
      }
      setSessionExpired(false);
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = user.id + "/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, photo, {
          upsert: false, contentType: photo.type,
        });
        if (uploadError) {
          setServerCorrections({photo: "Não foi possível salvar sua foto. Escolha outra imagem e tente novamente."});
          focusMissing(["photo"]);
          return;
        }
        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
        const { error: profileError } = await supabase.from("profiles")
          .update({ avatar_url: publicData.publicUrl, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (profileError) {
          setServerCorrections({photo: "Não foi possível confirmar a foto no seu perfil. Tente novamente."});
          focusMissing(["photo"]);
          return;
        }
        setPhotoUrl(publicData.publicUrl);
        setPhoto(null);
      }

      // The server checks completeness and enables the professional vehicle atomically.
      // GPS and online presence still require explicit consent.
      const { error } = await (supabase as any).rpc("submit_simple_mototaxi_access", {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_whatsapp: whatsapp,
        p_region: region,
        p_registration_number: registrationNumber.trim(),
      });
      if (error) {
        const code=String(error.code??"");
        const message=String(error.message??"");
        const allMissing=parseMissingError(message);
        const vehicleMissing=allMissing.filter(value=>
          ["VEHICLE_MODEL","VEHICLE_COLOR","PLATE","VEHICLE_TYPE","SEATS"].includes(value));
        if(vehicleMissing.length){
          setVehicleCorrections(vehicleMissing);
          setSubmissionMessage("O veículo cadastrado possui uma inconsistência. Corrija apenas os itens abaixo.");
          return;
        }
        const missing=professionalServerCorrections(error);
        if(Object.keys(missing).length){
          setServerCorrections(missing);
          focusMissing(Object.keys(missing) as ProfessionalField[]);
          return;
        }
        if(code==="22P02"){
          setSubmissionMessage("Falha interna na validação de dados (22P02). A correção SQL 0211 precisa ser aplicada; os campos preenchidos não são necessariamente inválidos.");
        }else if(/session|jwt|token|sessao|autentica/i.test(message)||code==="PGRST301"){
          setSessionExpired(true);
          setSubmissionMessage("A sessão expirou. Entre novamente para continuar.");
        }else if(code==="42501"){
          setSubmissionMessage("Existe uma restrição administrativa anterior. Consulte o suporte CARONAA.");
        }else{
          setSubmissionMessage("Não foi possível verificar a habilitação no servidor. Seus dados foram preservados. Código: "+(code||"INDEFINIDO"));
        }
        return;
      }
      const { data: refreshed, error: refreshError } =
        await (supabase as any).rpc("get_my_professional_access");
      if (refreshError || !refreshed || refreshed.authorized !== true) {
        setSubmissionMessage("Dados recebidos, mas a habilitação não foi confirmada pelo servidor. Tente novamente.");
        return;
      }
      setRequest(refreshed.request ?? null);
      setAuthorized(refreshed.authorized === true);
      toast.success("Cadastro concluído! Ative sua disponibilidade para receber corridas.");
      await navigate({to: "/disponibilidade-profissional", replace: true});
    } catch {
      setSubmissionMessage("Não foi possível concluir a confirmação. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user?.email_confirmed_at || onboardingState !== "ready") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#121212] px-4 text-white">
        <section className="w-full max-w-sm space-y-4 rounded-3xl border border-white/15 bg-[#1b1b1b] p-6">
          <BrandLogo size="lg" className="max-w-[185px]" />
          {onboardingState === "error" && user?.email_confirmed_at ? (
            <>
              <h1 className="font-display text-lg font-bold">Não foi possível conferir seu cadastro universal</h1>
              <p role="alert" className="text-sm text-white/70">Confirme os dados da sua conta para continuar.</p>
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
        <Link to={user ? "/home" : "/"} aria-label="CARONAA — página inicial" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]"><BrandLogo size="lg" className="max-w-[205px]" /></Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#FFBB00]">Dados do motorista</p>
          <h1 className="mt-2 font-display text-2xl font-bold">{authorized ? "Cadastro concluído" : "Confirme seus dados"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{authorized ? "Seu cadastro está habilitado. Ative sua disponibilidade quando estiver pronto." : "Complete os dados obrigatórios para habilitar seu acesso sem esperar aprovação."}</p>
        </div>
        {reviewState !== "ready" ? (
          <div className="space-y-4" role="status" aria-live="polite">
            {reviewState === "loading" ? (
              <div className="space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10"/>
                <div className="h-20 animate-pulse rounded-2xl bg-white/10"/>
                <p className="text-sm text-white/70">Conferindo o cadastro profissional...</p>
              </div>
            ) : (
              <>
                <p role="alert" className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 p-4 text-sm">
                  {reviewError||"Não foi possível conferir seu cadastro. Para evitar alterações duplicadas, tente novamente."}
                </p>
                {sessionExpired&&<Link to="/auth"
                  search={{mode:"entrar",redirect:"/cadastro-motorista"}}
                  className="inline-flex min-h-11 items-center text-[#FFBB00] underline">Entrar novamente</Link>}
                <button type="button" onClick={() => setReviewRetry(value => value + 1)}
                  className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">
                  Tentar novamente
                </button>
              </>
            )}
          </div>
        ) : authorized ? (
          <section className="space-y-5 rounded-2xl border border-[#FFBB00]/25 bg-[#121212] p-4 sm:p-5" aria-label="Credencial profissional">
            <div className="flex justify-center">
              <span className="relative flex size-16 items-center justify-center rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/15">
                <ShieldCheck className="size-9 text-[#FFBB00]" aria-hidden="true"/>
                <CheckCircle2 className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#121212] text-emerald-400" aria-hidden="true"/>
              </span>
            </div>
            <div className="space-y-2 text-center">
              <h2 className="font-[Sora] text-xl font-extrabold">
                Cadastro profissional habilitado
              </h2>
              <p className="text-xs leading-relaxed text-white/65">
                O acesso está ativo no CARONAA. Ative sua disponibilidade numa região atendida para começar a receber corridas. A plataforma não substitui licenças legais.
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
            <Link to="/disponibilidade-profissional"
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#FFBB00] px-4 text-center font-[Sora] text-sm font-black text-[#121212]">
              IR PARA MINHAS CORRIDAS
            </Link>
            <p className="text-center text-xs text-white/55">
              Precisa atualizar seus dados cadastrais? Fale com o suporte.
            </p>
            <button type="button" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}
              className="min-h-11 w-full text-sm text-white/65 underline">Sair da conta</button>
          </section>
        ) : registeredVehicle==="CAR" ? (
          <section className="space-y-4" aria-label="Habilitação do motorista de carro">
            <div className="rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/5 p-4 text-sm text-white/85">
              <h2 className="font-bold text-[#FFBB00]">Veículo já cadastrado: carro</h2>
              <p className="mt-2">Nome, foto, marca, modelo, cor e placa já foram reaproveitados.
                Para receber corridas de carro, confirme apenas a categoria e o município.</p>
              <p className="mt-2 text-xs text-white/60">
                Não é necessário informar matrícula de mototáxi nem enviar outra foto.</p>
            </div>
            <ProfessionalAccessRequest
              initialVehicle={{type:"CAR",seats:carSeats,municipality:carMunicipality}}
              onAuthorized={onCarAuthorized}/>
            <Link to="/cadastro-veiculo" search={{redirect:"/cadastro-motorista"}}
              className="inline-flex min-h-11 items-center font-semibold text-[#FFBB00] underline">
              Meu veículo é moto — corrigir tipo de veículo
            </Link>
          </section>
        ) : (
          <>
            {request && <div role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
              Situação: <strong>{request.status === "PENDING" ? "Conclua a confirmação" : request.status === "APPROVED" ? "Sincronizando habilitação" : request.status === "REJECTED" ? "Cadastro bloqueado" : "Correções necessárias"}</strong>
              {request.review_reason && <p>Observação: {request.review_reason}</p>}
            </div>}
            <form className="space-y-3" noValidate onSubmit={confirmData}>
              {missingFields.length > 0 && (
                <div role="alert" className="rounded-2xl border border-amber-400/55 bg-amber-400/10 p-3 text-sm">
                  <p className="font-extrabold text-[#FFBB00]">Faltam {missingFields.length} {missingFields.length === 1 ? "dado obrigatório" : "dados obrigatórios"}:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-white/85">
                    {missingFields.map(field => <li key={field}>{professionalFieldLabels[field]} — {corrections[field]}</li>)}
                  </ul>
                </div>
              )}
              {submissionMessage && <div role="alert" className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
                <p>{submissionMessage}</p>
                {sessionExpired&&<Link to="/auth" search={{mode:"entrar",redirect:"/cadastro-motorista"}}
                  className="inline-flex min-h-11 items-center font-semibold underline">Entrar novamente</Link>}
              </div>}
              {vehicleCorrections.length>0&&<div role="alert" className="rounded-xl border border-amber-400/40 p-3 text-sm">
                <p className="font-semibold">Dados do veículo que precisam ser ajustados:</p>
                <ul className="ml-5 list-disc">{vehicleCorrections.map(code=><li key={code}>{MISSING_LABELS[code]}</li>)}</ul>
                <Link to="/cadastro-veiculo" search={{redirect:"/cadastro-motorista"}}
                  className="inline-flex min-h-11 items-center font-semibold text-[#FFBB00] underline">
                  Corrigir somente o veículo
                </Link>
              </div>}
              <div className="grid gap-3 min-[390px]:grid-cols-2">
                <label className="block text-sm" htmlFor="prof-firstName">Primeiro nome
                    <input id="prof-firstName" aria-required="true" aria-invalid={Boolean(corrections.firstName)} aria-describedby={corrections.firstName ? "prof-firstName-error" : undefined} value={firstName} onChange={e => {setFirstName(e.target.value);clearCorrection("firstName");}} autoComplete="given-name" className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" />
                    {corrections.firstName && <span id="prof-firstName-error" className="mt-1 block text-xs text-amber-300">{corrections.firstName}</span>}
                  </label>
                <label className="block text-sm" htmlFor="prof-lastName">Último sobrenome
                    <input id="prof-lastName" aria-required="true" aria-invalid={Boolean(corrections.lastName)} aria-describedby={corrections.lastName ? "prof-lastName-error" : undefined} value={lastName} onChange={e => {setLastName(e.target.value);clearCorrection("lastName");}} autoComplete="family-name" className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" />
                    {corrections.lastName && <span id="prof-lastName-error" className="mt-1 block text-xs text-amber-300">{corrections.lastName}</span>}
                  </label>
              </div>
              
              <label className="block text-sm" htmlFor="prof-whatsapp">WhatsApp com DDD
                <input id="prof-whatsapp" type="tel" inputMode="tel" autoComplete="tel" aria-required="true" aria-invalid={Boolean(corrections.whatsapp)} aria-describedby={corrections.whatsapp ? "prof-whatsapp-error" : undefined} value={whatsapp} placeholder="(85) 99999-9999" onChange={e => {setWhatsapp(e.target.value);clearCorrection("whatsapp");}} className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" />
                {corrections.whatsapp && <span id="prof-whatsapp-error" className="mt-1 block text-xs text-amber-300">{corrections.whatsapp}</span>}
              </label>
              <label className="block text-sm" htmlFor="prof-region">Região de atuação
                <select id="prof-region" aria-required="true" aria-invalid={Boolean(corrections.region)} aria-describedby={corrections.region ? "prof-region-error" : undefined} value={region} onChange={e => {setRegion(e.target.value as typeof region);clearCorrection("region");}} className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]">
                  <option value="">Selecione a região</option>
                  <option value="MACICO_BATURITE">Maciço de Baturité</option>
                  <option value="FORTALEZA">Fortaleza e região metropolitana</option>
                </select>
                {corrections.region && <span id="prof-region-error" className="mt-1 block text-xs text-amber-300">{corrections.region}</span>}
              </label>
              <label className="block text-sm" htmlFor="prof-registrationNumber">Matrícula / registro de mototaxista
                <input id="prof-registrationNumber" aria-required="true" aria-invalid={Boolean(corrections.registrationNumber)} aria-describedby={corrections.registrationNumber ? "prof-registrationNumber-error" : undefined} value={registrationNumber} onChange={e => {setRegistrationNumber(e.target.value);clearCorrection("registrationNumber");}} className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-3 text-base outline-none focus-visible:border-[#FFBB00]" />
                {corrections.registrationNumber && <span id="prof-registrationNumber-error" className="mt-1 block text-xs text-amber-300">{corrections.registrationNumber}</span>}
              </label>
              <label className="block text-sm" htmlFor="prof-photo">Foto pessoal
                {photoUrl && <img src={photoUrl} alt="Foto atual do perfil" className="my-2 size-16 rounded-full object-cover" />}
                <input id="prof-photo" type="file" accept={professionalPhotoTypes.join(",")} aria-required={!photoUrl && !photo} aria-invalid={Boolean(corrections.photo)} aria-describedby={corrections.photo ? "prof-photo-error" : undefined} onChange={e => {setPhoto(e.target.files?.[0] ?? null);clearCorrection("photo");}} className="mt-2 block min-h-12 w-full rounded-xl border border-white/25 bg-[#232323] p-2 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#FFBB00] file:px-3 file:py-2 file:font-bold file:text-[#121212] focus-visible:outline focus-visible:border-[#FFBB00]" />
                {photo && <span className="mt-1 block break-all text-xs text-white/70">Selecionada: {photo.name}</span>}
                {corrections.photo && <span id="prof-photo-error" className="mt-1 block text-xs text-amber-300">{corrections.photo}</span>}
              </label>
              <p className="text-xs text-white/55">A matrícula é declaratória. A aprovação administrativa não substitui licenças ou exigências legais para operação.</p>
              <button type="submit" disabled={busy} aria-busy={busy} className="min-h-14 w-full rounded-2xl bg-[#FFBB00] px-4 py-3 text-base font-extrabold text-[#121212] shadow-md transition-colors hover:bg-[#ffe35c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00] disabled:opacity-60">
                {busy ? "Confirmando dados..." : "Confirmar dados e ver corridas"}
              </button>
            </form>
            <button type="button" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="min-h-11 text-sm text-white/65 underline">Sair da conta</button>
          </>
        )}
      </section>
    </main>
  );
}
