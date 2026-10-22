import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, MapPin, ShieldCheck } from "lucide-react";
import type { SurveySchema, SurveyQuestion } from "@/lib/formulario/research-templates";
import type { PublicResearchConfiguration, ResearchJourney } from "@/lib/formulario/research-configuration";
import { validateJourney } from "@/lib/formulario/research-configuration";
import { academicExpressSteps, type AcademicRole } from "@/lib/formulario/academic-express-schema";
import { cleanAnswers, validatePage, type Answers } from "@/lib/formulario/research-schema";
import { validResearchEmail, captureResearchLead } from "@/lib/formulario/research-lead";
import { submitConfiguredResearch, registerResearchInterest } from "@/lib/formulario/research-configuration-service";
import { storePendingParticipation, claimResearchParticipation } from "@/lib/formulario/research-participation";
import { initialResearchJourney } from "./ResearchJourneyFields";
import { displaySurveyDate } from "@/lib/formulario/research-window";

type AcademicForm = {
  id: string; version: string; title: string; schema: SurveySchema;
  brandImagePath: string | null; brandAlt: string | null; brandName: string | null;
  caronaaPresenceOn: string | null;
  configuration?: PublicResearchConfiguration | null;
};

type Stage = ReturnType<typeof academicExpressSteps>[number];
const roleNames: Record<AcademicRole, string> = {
  PASSAGEIRO: "Quero pegar carona",
  MOTORISTA: "Quero oferecer carona",
  AMBOS: "Quero pegar e oferecer",
};
const textChoices: Record<string,string> = {
  ESTUDANTE:"Estudante", ESTUDANTE_TRABALHADOR:"Estudante e profissional",
  PROFESSOR:"Professor(a)", COLABORADOR:"Colaborador(a)", TERCEIRIZADO:"Terceirizado(a)", OUTRO:"Outro",
  ONIBUS:"Ônibus", APLICATIVO:"Uber / 99", CARONA:"Carona com conhecidos",
  CARRO:"Carro", MOTO:"Moto", BICICLETA:"Bicicleta", A_PE:"A pé", 
  PREFERENCIA_MULHERES:"Prefiro viajar com mulheres",
  PONTO_NO_CAMPUS:"Ponto de encontro dentro do campus",
  PERFIL_VERIFICADO:"Identidade e vínculo verificados",
  ECONOMIA:"Economia no trajeto",
  SEM_DESVIOS:"Sem desvio relevante da minha rota",
  PAGAMENTO_VERIFICADO:"Pagamento confirmado antes de considerar recebido",
  MESMA_UNIVERSIDADE:"Pessoas da mesma universidade",
};
const shell = "flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]";
const field = "min-h-12 w-full min-w-0 rounded-xl border border-white/20 bg-[#202020] px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-[#FFBB00] focus:ring-2 focus:ring-[#FFBB00]/30";
const label = "block text-xs font-semibold tracking-wide text-white/75";

export function AcademicExpressForm({ form, captureEnabled, user }:{
  form: AcademicForm; captureEnabled: boolean;
  user?: { email?: string | null; email_confirmed_at?: string | null } | null;
}) {
  const config = form.configuration!;
  const schema = form.schema;
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const allQuestions = useMemo(()=>schema.sections.flatMap(s=>s.questions),[schema]);
  const bySemantic = (semantic:string) => allQuestions.find(q=>q.semanticCode===semantic);
  const roleQuestion = bySemantic("RESEARCH_PARTICIPANT_ROLE");
  const nameQuestion = bySemantic("ACADEMIC_PARTICIPANT_NAME");
  const affiliationQuestion = bySemantic("ACADEMIC_ROLE");
  const transportQuestion = bySemantic("TRANSPORT_MODE");
  const costQuestion = bySemantic("COST_PER_TRIP");
  const passengerPriority = bySemantic("ACADEMIC_PASSENGER_PRIORITY");
  const vehicleQuestion = bySemantic("URBAN_OFFER_VEHICLE");
  const seatsQuestion = bySemantic("SEATS_AVAILABLE");
  const driverPriority = bySemantic("ACADEMIC_DRIVER_PRIORITY");

  const [answers,setAnswers] = useState<Answers>({});
  const [email,setEmail] = useState(user?.email ?? "");
  const [journey,setJourney] = useState<ResearchJourney>(()=>({
    ...initialResearchJourney(config.settings), days:[], outboundTime:"", returnTime:"",
    direction: config.settings.returnTimes.length ? "IDA_E_VOLTA" : "IDA",
  }));
  const [index,setIndex] = useState(0);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [complete,setComplete] = useState(false);
  const [interestRegistered,setInterestRegistered] = useState<boolean|null>(null);
  const [consent,setConsent] = useState(false);
  const [linkageConsent,setLinkageConsent] = useState(false);
  const [marketingConsent,setMarketingConsent] = useState(false);
  const [prepareInterest,setPrepareInterest] = useState(false);
  const [interestRole,setInterestRole] = useState<"PASSAGEIRO"|"MOTORISTA">("PASSAGEIRO");
  const [customSeats,setCustomSeats] = useState(false);
  const [submissionKey] = useState(()=>crypto.randomUUID());

  const candidateRole=roleQuestion?answers[roleQuestion.id]:null;
  const role: AcademicRole|null = candidateRole==="PASSAGEIRO" || candidateRole==="MOTORISTA" || candidateRole==="AMBOS" ? candidateRole : null;
  const steps=academicExpressSteps(role);
  const stage=steps[Math.min(index,steps.length-1)] as Stage;
  const hasVerifiedEmail=Boolean(user?.email_confirmed_at && user.email?.toLowerCase()===email.trim().toLowerCase());
  const allowedDomains=((config.settings as typeof config.settings & {institutionalEmailDomains?:string[]}).institutionalEmailDomains??[]);
  // Backward-compatible hint for the existing UNIFOR campaign; not authorization.
  if(!allowedDomains.length && config.settings.institutionName.trim().toUpperCase()==="UNIFOR") allowedDomains.push("unifor.br");
  const domain=email.trim().split("@")[1]?.toLowerCase();
  const hasRecognizedDomain=Boolean(domain&&allowedDomains.some(allowed=>allowed.toLowerCase()===domain));
  const institution=config.settings.institutionName||form.title;
  const plannedLaunch=form.caronaaPresenceOn || config.settings.launchDate;

  useEffect(()=>{
    titleRef.current?.focus({preventScroll:true});
  },[index]);

  function updateAnswer(q:SurveyQuestion|undefined,value:string|string[]) {
    if(!q) return;
    setAnswers(previous=>{
      const next={...previous,[q.id]:value};
      const roleValue=roleQuestion?next[roleQuestion.id]:null;
      return cleanAnswers(schema,next,typeof roleValue==="string"?roleValue:null);
    });
    setError("");
  }

  function selected(q:SurveyQuestion|undefined):string {
    if(!q)return "";
    const value=answers[q.id];
    return Array.isArray(value)?value[0]??"":typeof value==="string"?value:"";
  }

  function choice(q:SurveyQuestion|undefined, value:string, auto=false) {
    if(!q)return;
    updateAnswer(q,q.type==="multiple_choice"?[value]:value);
    if(auto && identityReady(value)){
      setJourney(previous=>({...previous,profile:value as AcademicRole,mode:"CARONA"}));
      setIndex(1);
    }
  }

  function identityReady(nextRole?:string):boolean {
    const name=selected(nameQuestion).trim();
    return name.length>=2 && name.length<=80 && Boolean(selected(affiliationQuestion)) &&
      (!captureEnabled || validResearchEmail(email.trim())) &&
      Boolean(nextRole||role);
  }

  function verifyCurrent():string|null {
    if(stage==="identity") {
      if(!identityReady()) return "Informe seu nome, vínculo acadêmico, perfil e um e-mail válido.";
    } else if(stage==="route") {
      if(journey.originArea.trim().length<2 || journey.destinationArea.trim().length<2)
        return "Informe uma região de origem e o campus de destino.";
      if(!journey.days.length) return "Selecione os dias em que costuma se deslocar.";
      if(!journey.outboundTime) return "Escolha o horário habitual de saída.";
      if(journey.direction==="IDA_E_VOLTA" && !journey.returnTime)
        return "Escolha também o horário habitual de retorno.";
    } else if(stage==="driver" || stage==="passenger") {
      const questions=stage==="driver"
        ?[vehicleQuestion,seatsQuestion,driverPriority]
        :[transportQuestion,costQuestion,passengerPriority];
      const section={title:"Sua preferência",questions:questions.filter((q):q is SurveyQuestion=>Boolean(q))};
      const issues=validatePage(section,answers,allQuestions,schema,role);
      if(issues.length) return issues[0];
      if(stage==="driver" && selected(vehicleQuestion)==="MOTO" && Number(selected(seatsQuestion))!==1)
        return "Em uma moto, informe no máximo um passageiro, quando permitido.";
    }
    return null;
  }

  function next() {
    const issue=verifyCurrent();
    if(issue){setError(issue);return;}
    if(stage==="identity" && role) setJourney(previous=>({...previous,profile:role,mode:"CARONA"}));
    setError("");setIndex(i=>Math.min(i+1,steps.length-1));
  }
  function back(){setIndex(i=>Math.max(0,i-1));setError("");}

  async function submit() {
    if(stage!=="activation"){next();return;}
    if(busy||!role)return;
    const cleaned=cleanAnswers(schema,answers,role);
    const problems=schema.sections.flatMap(section=>validatePage(section,cleaned,allQuestions,schema,role));
    if(problems.length){setError(problems[0]);return;}
    if(!consent){setError("Confirme sua participação na pesquisa.");return;}
    if(captureEnabled && (!validResearchEmail(email.trim())||!linkageConsent)){
      setError("Confirme seu e-mail e a autorização de reconhecimento.");return;
    }
    let validJourney:ResearchJourney;
    try{validJourney=validateJourney({...journey,profile:role,mode:"CARONA"},config.settings);}
    catch(reason){setError(reason instanceof Error?reason.message:"Revise seu trajeto.");setIndex(1);return;}
    setBusy(true);setError("");
    try {
      await submitConfiguredResearch({
        formId:form.id,versionId:form.version,submissionKey,answers:cleaned,
        config,journey:validJourney,researchConsent:true,
      });
      if(captureEnabled){
        await captureResearchLead({formId:form.id,receipt:submissionKey,email:email.trim(),
          linkageConsent:true,marketingConsent});
      }
      try{storePendingParticipation(submissionKey,Boolean(plannedLaunch));}catch{/* Can be recovered with receipt. */}
      if(user?.email_confirmed_at && (!captureEnabled ||
        user.email?.trim().toLowerCase()===email.trim().toLowerCase())){
        try{await claimResearchParticipation(submissionKey);}catch{/* Recoverable later. */}
      }
      if(prepareInterest){
        try{
          await registerResearchInterest(form.id,submissionKey,role==="AMBOS"?interestRole:role,true,validJourney);
          setInterestRegistered(true);
        }catch{setInterestRegistered(false);}
      }
      setComplete(true);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Não foi possível registrar sua pesquisa.");
    }finally{setBusy(false);}
  }

  const selectable=(q:SurveyQuestion|undefined,columns=false)=>(
    <div role="group" aria-label={q?.label} className={columns?"grid grid-cols-2 gap-2":"grid gap-2"}>
      {(q?.options??[]).map(option=>{
        const active=selected(q)===option;
        return <button key={option} type="button" aria-pressed={active}
          className={shell+" "+(active?"border-[#FFBB00] bg-[#FFBB00]/10 text-white":"border-white/15 bg-white/[.04] text-white hover:border-white/40")}
          onClick={()=>choice(q,option)}>
          <span>{textChoices[option]??option}</span>
          {active&&<CheckCircle2 size={18} className="shrink-0 text-[#FFBB00]"/>}
        </button>;
      })}
    </div>
  );

  const heading={identity:"Sua universidade, seu caminho",route:"Qual é seu trajeto?",driver:"Quando você oferece carona",passenger:"Como você prefere viajar",activation:"Tudo pronto para participar"}[stage];
  return (
    <main className="relative isolate flex h-[100dvh] min-h-[440px] w-full flex-col overflow-hidden bg-[#121212] font-sans text-white">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-5">
        <span className="font-bold tracking-tight text-[#FFBB00]">CARONAA <span className="font-normal text-white/75">· {institution}</span></span>
        <span className="text-xs text-white/60">Passo {index+1} de {steps.length}</span>
      </div>
      <div className="h-[3px] w-full shrink-0 bg-white/10" role="progressbar"
        aria-label="Progresso da pesquisa" aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={steps.length}>
        <div className="h-full bg-[#FFBB00] transition-[width] duration-300 motion-reduce:transition-none"
          style={{width:(index+1)/steps.length*100+"%"}}/>
      </div>

      <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-5 pt-5 sm:px-8 sm:pt-9" aria-label="Etapa do questionário">
        {complete?(
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
            <CheckCircle2 size={48} className="text-emerald-400" aria-hidden="true"/>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Sua resposta foi registrada</h1>
            <p className="max-w-sm text-sm leading-6 text-white/70">
              Seu trajeto de interesse foi salvo para análise. Isso ainda não cria pedido,
              oferta ou reserva de carona.
            </p>
            {interestRegistered===true&&<p className="text-sm text-emerald-300">Interesse no trajeto registrado separadamente.</p>}
            {interestRegistered===false&&<p role="status" className="text-sm text-amber-300">A pesquisa foi salva, mas o interesse adicional não pôde ser registrado. Você poderá fazê-lo depois.</p>}
            {plannedLaunch&&<p className="text-sm text-white/75">Presença prevista do CARONAA: {displaySurveyDate(plannedLaunch)}. Sujeita a confirmação.</p>}
            <a href={user?"/perfil":"/auth"} className="mt-4 flex min-h-13 w-full items-center justify-center rounded-2xl bg-[#FFBB00] px-5 font-semibold text-[#121212]">
              {user?"Personalizar meu perfil":"Criar conta para acompanhar"}
            </a>
            <p className="text-xs text-white/50">O cadastro e a verificação institucional são etapas independentes.</p>
          </div>
        ):(
          <div key={stage} className="mx-auto flex w-full max-w-xl flex-col justify-center gap-5 py-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 sm:my-auto">
            <div className="space-y-2">
              <h1 tabIndex={-1} ref={titleRef} className="font-display text-[clamp(1.4rem,4.5vw,2.25rem)] font-bold leading-tight tracking-tight outline-none">{heading}</h1>
              <p className="text-sm leading-5 text-white/60">
                {stage==="identity"?"Em poucos toques, conhecemos seu perfil acadêmico.":
                  stage==="route"?"Informe somente a região aproximada e seus horários habituais.":
                  stage==="driver"?"Vagas livres e condições reais, sem promessas de ganhos.":
                  stage==="passenger"?"Uma escolha por campo; sem repetir as perguntas de motorista.":
                  "Confira suas autorizações antes de registrar o interesse."}
              </p>
            </div>

            {stage==="identity"&&<>
              <label className={label} htmlFor={id+"-name"}>Seu nome
                <input id={id+"-name"} autoComplete="name" value={selected(nameQuestion)}
                  onChange={event=>updateAnswer(nameQuestion,event.target.value)}
                  placeholder="Como prefere ser chamado(a)" maxLength={80}
                  className={field+" mt-2"} />
              </label>
              <div className="space-y-2">
                <p className={label}>Seu vínculo</p>
                <select className={field} aria-label="Vínculo com a universidade"
                  value={selected(affiliationQuestion)} onChange={event=>updateAnswer(affiliationQuestion,event.target.value)}>
                  <option value="">Selecione</option>
                  {affiliationQuestion?.options.map(v=><option key={v} value={v}>{textChoices[v]??v}</option>)}
                </select>
              </div>
              {captureEnabled&&<label className={label} htmlFor={id+"-email"}>E-mail para reconhecer sua participação
                <input id={id+"-email"} type="email" inputMode="email" autoComplete="email"
                  value={email} onChange={event=>{setEmail(event.target.value);setError("");}}
                  placeholder="voce@universidade.br" className={field+" mt-2"}/>
              </label>}
              {captureEnabled&&validResearchEmail(email)&&<p role="status" className="text-xs leading-5 text-white/65">
                {hasRecognizedDomain
                  ? hasVerifiedEmail
                    ? "E-mail da conta confirmado. O vínculo institucional ainda depende das regras da instituição."
                    : "Domínio institucional reconhecido. Confirme a titularidade para validar seu acesso."
                  : hasVerifiedEmail
                    ? "E-mail confirmado na sua conta; vínculo acadêmico ainda não verificado."
                    : "E-mail válido. Informá-lo não verifica vínculo nem libera acesso."}
              </p>}
              <fieldset className="space-y-2">
                <legend className={label+" mb-2"}>Como pretende usar o CARONAA?</legend>
                {(["PASSAGEIRO","MOTORISTA","AMBOS"] as const).map(value=>{
                  const active=role===value;
                  return <button type="button" key={value} aria-pressed={active}
                    className={shell+" mb-2 "+(active?"border-[#FFBB00] bg-[#FFBB00]/10":"border-white/15 bg-white/[.04]")}
                    onClick={()=>{
                      choice(roleQuestion,value,false);
                      if(identityReady(value)){
                        setJourney(previous=>({...previous,profile:value,mode:"CARONA"}));
                        setIndex(1);setError("");
                      }else{
                        setError("Complete nome, vínculo e e-mail antes de avançar.");
                      }
                    }}>
                    <span>{roleNames[value]}</span><ChevronRight size={18} className="text-[#FFBB00]"/>
                  </button>;
                })}
              </fieldset>
            </>}

            {stage==="route"&&<>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Bairro ou região de origem
                  <input autoComplete="off" value={journey.originArea} maxLength={120}
                    onChange={e=>setJourney(p=>({...p,originArea:e.target.value,originLat:null,originLng:null}))}
                    placeholder="Ex.: Maracanaú" className={field+" mt-2"}/>
                </label>
                <label className={label}>Campus ou destino
                  <input autoComplete="off" value={journey.destinationArea} maxLength={120}
                    onChange={e=>setJourney(p=>({...p,destinationArea:e.target.value,destinationLat:null,destinationLng:null}))}
                    placeholder={institution} className={field+" mt-2"}/>
                </label>
              </div>
              <div className="space-y-2">
                <p className={label}>Dias habituais</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={"min-h-11 rounded-xl border px-3 text-xs font-semibold "+([1,2,3,4,5].every(d=>journey.days.includes(d))?"border-[#FFBB00] text-[#FFBB00]":"border-white/20")}
                    onClick={()=>setJourney(p=>({...p,days:[1,2,3,4,5].filter(d=>config.settings.days.includes(d))}))}>Seg–Sex</button>
                  {config.settings.days.map(day=><button type="button" key={day}
                    aria-pressed={journey.days.includes(day)}
                    className={"min-h-11 min-w-11 rounded-xl border px-2 text-xs font-semibold "+(journey.days.includes(day)?"border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]":"border-white/20 text-white/70")}
                    onClick={()=>setJourney(p=>({...p,days:p.days.includes(day)?p.days.filter(d=>d!==day):[...p.days,day].sort()}))}>
                    {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][day-1]}</button>)}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Horário de ida
                  <select className={field+" mt-2"} aria-label="Horário habitual de saída"
                    value={journey.otherOutboundTime?"OUTRO":journey.outboundTime}
                    onChange={e=>setJourney(p=>({...p,outboundTime:e.target.value==="OUTRO"?"":e.target.value,otherOutboundTime:e.target.value==="OUTRO"}))}>
                    <option value="">Selecione</option>
                    {config.settings.outboundTimes.map(t=><option key={t}>{t}</option>)}
                    <option value="OUTRO">Outro horário</option>
                  </select>
                  {journey.otherOutboundTime&&<input aria-label="Outro horário de ida" type="time" value={journey.outboundTime}
                    className={field+" mt-2"} onChange={e=>setJourney(p=>({...p,outboundTime:e.target.value}))}/>}
                </label>
                <label className={label}>Horário de retorno
                  <select className={field+" mt-2"} aria-label="Horário habitual de retorno"
                    value={journey.otherReturnTime?"OUTRO":journey.returnTime}
                    onChange={e=>setJourney(p=>({...p,returnTime:e.target.value==="OUTRO"?"":e.target.value,otherReturnTime:e.target.value==="OUTRO",direction:e.target.value?"IDA_E_VOLTA":"IDA"}))}>
                    <option value="">Sem retorno fixo</option>
                    {config.settings.returnTimes.map(t=><option key={t}>{t}</option>)}
                    <option value="OUTRO">Outro horário</option>
                  </select>
                  {journey.otherReturnTime&&<input aria-label="Outro horário de retorno" type="time" value={journey.returnTime}
                    className={field+" mt-2"} onChange={e=>setJourney(p=>({...p,returnTime:e.target.value}))}/>}
                </label>
              </div>
              <p className="flex items-start gap-2 text-xs leading-5 text-white/50"><MapPin size={15} className="shrink-0"/>Não pedimos endereço residencial; esta é uma intenção de trajeto, não uma reserva.</p>
            </>}

            {stage==="passenger"&&<>
              <div className="space-y-2"><p className={label}>Como você vai hoje?</p>{selectable(transportQuestion,true)}</div>
              <div className="space-y-2"><p className={label}>Sua prioridade ao pegar carona</p>{selectable(passengerPriority)}</div>
              <label className={label}>Gasto atual por trecho (opcional)
                <input type="number" min={0} max={10000} step="0.01" inputMode="decimal"
                  aria-label="Gasto atual por trecho" className={field+" mt-2"}
                  value={selected(costQuestion)} onChange={e=>updateAnswer(costQuestion,e.target.value)} placeholder="R$ 0,00"/>
              </label>
            </>}

            {stage==="driver"&&<>
              <div className="space-y-2"><p className={label}>Qual veículo usaria?</p>{selectable(vehicleQuestion,true)}</div>
              <div className="space-y-2"><p className={label}>Vagas livres, sem contar o motorista</p>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4].map(n=><button key={n} type="button"
                    className={"min-h-13 rounded-xl border text-base font-semibold "+(selected(seatsQuestion)===String(n)?"border-[#FFBB00] bg-[#FFBB00]/15":"border-white/20")}
                    onClick={()=>{updateAnswer(seatsQuestion,String(n));setCustomSeats(false);}}>{n}</button>)}
                  <button type="button" aria-label="Informar outra quantidade de vagas" aria-pressed={customSeats}
                    onClick={()=>setCustomSeats(true)}
                    className={"min-h-13 rounded-xl border text-base "+(customSeats?"border-[#FFBB00]":"border-white/20")}>5–7</button>
                </div>
                {customSeats&&<input aria-label="Quantidade personalizada de vagas" type="number" min={1} max={7} step={1}
                  value={selected(seatsQuestion)} onChange={e=>updateAnswer(seatsQuestion,e.target.value)}
                  className={field+" mt-2"}/>}
              </div>
              <div className="space-y-2"><p className={label}>O que é mais importante para você?</p>{selectable(driverPriority)}</div>
              <p className="text-xs leading-5 text-white/50">O CARONAA calculará valores pelo trajeto real; não há promessa de ganhos, Pix ou passageiro confirmado.</p>
            </>}

            {stage==="activation"&&<>
              {plannedLaunch&&<div className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/[.06] p-4">
                <p className="text-sm font-semibold">Previsão de presença: {displaySurveyDate(plannedLaunch)}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">Data informada pela organização, sujeita a confirmação. Nenhuma viagem será agendada automaticamente.</p>
              </div>}
              <label className="flex min-h-13 items-start gap-3 text-sm leading-6">
                <input type="checkbox" className="mt-1.5 accent-[#FFBB00]" checked={prepareInterest} onChange={e=>setPrepareInterest(e.target.checked)}/>
                <span>Quero registrar interesse no meu trajeto quando houver disponibilidade (opcional). Não é uma reserva.</span>
              </label>
              {prepareInterest&&role==="AMBOS"&&<div className="flex gap-2" role="group" aria-label="Tipo de interesse inicial">
                {(["PASSAGEIRO","MOTORISTA"] as const).map(r=><button key={r} type="button" aria-pressed={interestRole===r}
                  onClick={()=>setInterestRole(r)}
                  className={"min-h-12 flex-1 rounded-xl border px-3 text-sm "+(interestRole===r?"border-[#FFBB00]":"border-white/20")}>
                  {r==="PASSAGEIRO"?"Encontrar":"Oferecer"}</button>)}
              </div>}
              <label className="flex items-start gap-3 text-xs leading-5"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-[#FFBB00]"/>
                <span>Concordo em participar da pesquisa e com o tratamento das respostas conforme o aviso de privacidade.</span>
              </label>
              {captureEnabled&&<label className="flex items-start gap-3 text-xs leading-5"><input type="checkbox" required checked={linkageConsent} onChange={e=>setLinkageConsent(e.target.checked)} className="mt-1 accent-[#FFBB00]"/>
                <span>Autorizo vincular minha participação ao e-mail informado. Não é necessário criar uma conta.</span>
              </label>}
              {captureEnabled&&<label className="flex items-start gap-3 text-xs leading-5 text-white/65"><input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)} className="mt-1 accent-[#FFBB00]"/>
                <span>Quero receber novidades do CARONAA por e-mail (opcional).</span>
              </label>}
              <p className="flex items-start gap-2 text-xs leading-5 text-white/55">
                <ShieldCheck size={16} className="shrink-0 text-[#FFBB00]"/>
                Responder à pesquisa não comprova matrícula, não cria conta, nem libera acesso antecipado à plataforma.
              </p>
            </>}
            {error&&<p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>}
          </div>
        )}
      </section>

      {!complete&&<div className="z-10 mx-auto flex w-full max-w-3xl shrink-0 gap-3 border-t border-white/10 bg-[#121212] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:px-8">
        <button type="button" onClick={back} disabled={index===0||busy} aria-label="Voltar etapa"
          className="flex min-h-13 min-w-13 items-center justify-center rounded-xl border border-white/20 disabled:opacity-30">
          <ArrowLeft size={20}/>
        </button>
        <button type="button" disabled={busy||(stage==="activation"&&(!consent||(captureEnabled&&!linkageConsent)))}
          onClick={stage==="activation"?()=>{void submit();}:next}
          className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-bold text-[#121212] disabled:opacity-50">
          {busy?"Registrando…":stage==="activation"?"Registrar participação":"Continuar"}
          {stage!=="activation"&&<ArrowRight size={18}/>}
        </button>
      </div>}
    </main>
  );
}
