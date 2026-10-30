import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, GraduationCap, CarFront, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { claimPendingParticipations, readPendingParticipations, getMyResearchParticipationBadges } from "@/lib/formulario/research-participation";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import {
  readOnboarding, saveOnboarding, completeOnboarding, institutionForRegion,
  type Progress, type RegionCode, type Affiliation, type UsageRole,
} from "@/lib/onboarding/progressive-onboarding";

export const Route = createFileRoute("/onboarding")({ ssr: false, component: OnboardingPage });

const regions: { value: RegionCode; label: string; detail: string }[] = [
  {value:"FORTALEZA",label:"Fortaleza e região metropolitana",detail:"Comunidade UNIFOR"},
  {value:"MACICO_BATURITE",label:"Maciço de Baturité",detail:"Comunidade UNILAB"},
  {value:"OTHER",label:"Outra região",detail:"Acompanhe futuras expansões"},
];
const affiliations: {value:Affiliation;label:string}[] = [
  {value:"ESTUDANTE",label:"Estudante"},
  {value:"PROFESSOR",label:"Professor(a)"},
  {value:"COLABORADOR",label:"Colaborador(a) / profissional"},
  {value:"COMUNIDADE",label:"Comunidade / sem vínculo"},
];
const roles: {value:UsageRole;label:string;description:string}[] = [
  {value:"PASSAGEIRO",label:"Passageiro",description:"Quero encontrar caronas"},
  {value:"MOTORISTA",label:"Motorista",description:"Quero oferecer caronas"},
  {value:"AMBOS",label:"Ambos",description:"Quero encontrar e oferecer"},
];

function OnboardingPage() {
  const {user,loading:authLoading} = useAuth();
  const navigate = useNavigate();
  const [progress,setProgress] = useState<Progress|null>(null);
  const [step,setStep] = useState(0);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState(false);
  const [region,setRegion] = useState<RegionCode|null>(null);
  const [affiliation,setAffiliation] = useState<Affiliation|null>(null);
  const [role,setRole] = useState<UsageRole|null>(null);
  const [researchCount,setResearchCount] = useState(0);
  useEffect(()=>{
    if(authLoading)return;
    if(!user){void navigate({to:"/auth",search:{mode:"entrar",redirect:"/onboarding"}});return;}
    if(!user.email_confirmed_at){void navigate({to:"/auth",search:{mode:"entrar"}});return;}
    let active=true;
    if(readPendingParticipations().length) void claimPendingParticipations().then(()=>getMyResearchParticipationBadges()).then(badges=>{if(active)setResearchCount(badges.length);}).catch(()=>undefined);
    else void getMyResearchParticipationBadges().then(badges=>{if(active)setResearchCount(badges.length);}).catch(()=>undefined);
    readOnboarding().then(p=>{
      if(!active)return;
      if(p?.status==="BASIC_COMPLETED"){void getMyResearchLaunchState().then(launch=>navigate({to:launch.locked?"/aguardando":"/home"})).catch(()=>setLoadError(true));return;}
      setProgress(p);setRegion(p?.region_code??null);setAffiliation(p?.affiliation_type??null);setRole(p?.usage_role??null);
      setStep(p?.current_step==="AFFILIATION"?1:p?.current_step==="ROLE"?2:p?.current_step==="REVIEW"?3:0);
    }).catch(()=>{if(active){setLoadError(true);toast.error("Não foi possível carregar seu perfil.");}}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[authLoading,user?.id,user?.email_confirmed_at,navigate]);
  async function advance(){
    if(busy)return;
    setBusy(true);
    try{
      if(step===0&&region){const p=await saveOnboarding({region_code:region,current_step:"AFFILIATION"});setProgress(p);setStep(1);}
      else if(step===1&&affiliation){const p=await saveOnboarding({affiliation_type:affiliation,current_step:"ROLE"});setProgress(p);setStep(2);}
      else if(step===2&&role){const p=await saveOnboarding({usage_role:role,current_step:"REVIEW"});setProgress(p);setStep(3);}
      else if(step===3&&progress){
        // Resolve access before completion to avoid masking launch gate failures.
        const launch=await getMyResearchLaunchState();
        await completeOnboarding(progress);
        await navigate({to:launch.locked?"/aguardando":"/home"});
      }
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível continuar.");}
    finally{setBusy(false);}
  }
  if(authLoading||loading)return <main className="min-h-[100dvh] grid place-items-center bg-[#111111] text-white">Preparando seu cadastro…</main>;
  if(loadError)return <main className="grid min-h-[100dvh] place-items-center bg-[#111111] p-6 text-center text-white"><div><p>Não foi possível carregar seu perfil.</p><button type="button" onClick={()=>window.location.reload()} className="mt-4 rounded-xl bg-[#FFBB00] px-6 py-3 font-bold text-[#121212]">Tentar novamente</button></div></main>;
  const optionClass=(selected:boolean)=>"flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition backdrop-blur-2xl "+(selected?"border-[#FFBB00]/80 bg-[#FFBB00]/15 shadow-[0_0_20px_rgba(255,187,0,0.08)]":"border-white/15 bg-white/[0.06] hover:bg-white/[0.10]");
  return <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#111111] text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[-160px] mx-auto h-[380px] w-[380px] rounded-full bg-[#FFBB00]/[0.08] blur-[110px]"/>
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg font-black tracking-[.13em]">CARONAA<span className="text-[#FFBB00]">.</span></span>
        <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/65">Etapa {step+1} de 4</span>
      </header>
      <div className="mt-7 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#FFBB00] transition-all" style={{width:`${(step+1)*25}%`}}/></div>
      <section className="flex min-h-0 flex-1 flex-col justify-center py-8">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-[#FFBB00]/25 bg-[#FFBB00]/10 text-[#FFBB00]">
          {step===0?<MapPin/>:step===1?<GraduationCap/>:step===2?<CarFront/>:<Sparkles/>}
        </div>
        <h1 className="font-display text-[clamp(1.7rem,6vw,2.1rem)] font-bold leading-tight">{["Onde você está?","Qual é seu vínculo?","Como vai usar o CARONAA?","Tudo pronto para começar."][step]}</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">{["Escolha sua região. Mostraremos sua comunidade e instituições próximas.","Escolha a opção que melhor representa você. Isso pode mudar depois.","Você poderá alternar entre os papéis a qualquer momento.","Você pode adicionar seu trajeto mais tarde, ao buscar ou oferecer uma carona."][step]}</p>
        {researchCount>0&&step===0&&<p className="mt-4 rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 px-4 py-3 text-xs text-[#FFE09A]">Encontramos {researchCount} participação(ões) vinculada(s) à sua conta. Seus lançamentos permanecem preservados.</p>}
        <div className="mt-7 space-y-3">
          {step===0&&regions.map(item=><button key={item.value} type="button" className={optionClass(region===item.value)} onClick={()=>setRegion(item.value)}><MapPin size={19} className="shrink-0 text-[#FFBB00]"/><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-white/50">{item.detail}</span></span>{region===item.value&&<Check size={19} className="text-[#FFBB00]"/>}</button>)}
          {step===1&&<><p className="mb-2 text-xs text-white/50">Instituição sugerida: {region?institutionForRegion(region)??"Sem instituição obrigatória":"Escolha sua região"}</p>{affiliations.map(item=><button key={item.value} type="button" className={optionClass(affiliation===item.value)} onClick={()=>setAffiliation(item.value)}><Users size={18} className="text-[#FFBB00]"/><span className="flex-1 text-sm font-semibold">{item.label}</span>{affiliation===item.value&&<Check size={19} className="text-[#FFBB00]"/>}</button>)}</>}
          {step===2&&roles.map(item=><button key={item.value} type="button" className={optionClass(role===item.value)} onClick={()=>setRole(item.value)}><CarFront size={19} className="text-[#FFBB00]"/><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-white/50">{item.description}</span></span>{role===item.value&&<Check size={19} className="text-[#FFBB00]"/>}</button>)}
          {step===3&&<div className="space-y-3 rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-2xl"><p className="text-sm">Região: <b>{regions.find(x=>x.value===region)?.label}</b></p><p className="text-sm">Instituição: <b>{region?institutionForRegion(region)??"Não vinculada":"Não vinculada"}</b></p><p className="text-sm">Vínculo: <b>{affiliations.find(x=>x.value===affiliation)?.label}</b></p><p className="text-sm">Perfil: <b>{roles.find(x=>x.value===role)?.label}</b></p><p className="pt-2 text-xs text-white/55">A conclusão do cadastro não libera campanhas em pré-lançamento.</p></div>}
        </div>
      </section>
      <footer className="sticky bottom-0 z-10 flex gap-3 bg-[#111111]/90 py-3 backdrop-blur-2xl">
        {step>0&&<button type="button" disabled={busy} onClick={()=>setStep(x=>x-1)} className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.06]" aria-label="Voltar"><ArrowLeft/></button>}
        <button type="button" disabled={busy||(step===0&&!region)||(step===1&&!affiliation)||(step===2&&!role)} onClick={()=>void advance()} className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-40">{busy?"Salvando…":step===3?"Entrar no CARONAA":"Continuar"}<ArrowRight size={19}/></button>
      </footer>
    </div>
  </main>;
}
