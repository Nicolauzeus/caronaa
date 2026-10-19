import type { ResearchTemplate, SurveySchema } from "./research-templates";
import type { Answers } from "./research-schema";
import { newResearchConfiguration, type ResearchConfiguration, type ResearchJourney } from "./research-configuration";

export const CORPORATE_INTERNAL_KEY = "EMPRESA_CARONA_INTERNA";

export const corporateInternalTemplate: ResearchTemplate = {
  key: CORPORATE_INTERNAL_KEY,
  nature: "EMPRESA",
  label: "Empresa · Caronas internas entre colaboradores",
  description: "Mobilidade por turno, caronas recorrentes e adesão restrita a funcionários autorizados",
  estimatedMinutes: 4,
  schema: { sections: [
    { title: "Seu deslocamento para o trabalho", description: "Somente colaboradores autorizados participam. Não informe endereço residencial completo.", questions: [
      { id: "corp_shift", label: "Qual turno você costuma cumprir?", type: "single_choice", required: true,
        options: ["MANHA","TARDE","NOITE","MADRUGADA","ESCALA","OUTRO"], semanticCode: "WORK_SHIFT" },
      { id: "corp_transport", label: "Quais meios utiliza para ir ou voltar da empresa?", type: "multiple_choice", required: true,
        options: ["ONIBUS","APLICATIVO","CARRO","MOTO","CARONA","BICICLETA","A_PE","OUTRO"], semanticCode: "TRANSPORT_MODE", maxValue: 3 },
      { id: "corp_pain", label: "Qual sua maior dificuldade nesse deslocamento?", type: "single_choice", required: true,
        options: ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"], semanticCode: "MOBILITY_PAINS" },
      { id: "corp_cost", label: "Quanto costuma gastar por trecho em R$?", type: "number", required: false, options: [],
        minValue: 0, maxValue: 10000, semanticCode: "COST_PER_TRIP", helpText: "O valor é por viagem, não por mês. Pode ser zero." },
      { id: "corp_frequency", label: "Com que frequência você vai à unidade?", type: "single_choice", required: true,
        options: ["TODOS_DIAS","ALGUNS_DIAS","ESCALA","EVENTUALMENTE"], semanticCode: "TRAVEL_FREQUENCY" },
    ]},
    { title: "Caronas entre colegas", description: "Queremos estudar viagens compatíveis, sem presumir que existe vaga, preço ou carona confirmada.", questions: [
      { id: "corp_drives", label: "Você costuma dirigir carro para trabalhar?", type: "single_choice", required: true,
        options: ["SIM","NAO"], semanticCode: "CORP_DRIVES_CAR" },
      { id: "corp_seats", label: "Quantos lugares livres costuma ter no carro?", type: "number", required: true,
        options: [], minValue: 0, maxValue: 4, integerOnly: true, semanticCode: "SEATS_AVAILABLE",
        showWhen: { questionId: "corp_drives", equals: "SIM" }, helpText: "Pode informar zero. São lugares declarados, não ofertas publicadas." },
      { id: "corp_offer", label: "Consideraria oferecer carona a colegas do seu turno?", type: "yes_no", required: true, options: [],
        semanticCode: "RIDE_OFFER_INTENT", showWhen: { questionId: "corp_drives", equals: "SIM" },
        helpText: "Resposta de pesquisa. A criação de oferta exigirá confirmação e verificação de elegibilidade." },
      { id: "corp_use", label: "Se houvesse uma carona com horário, percurso, regras e valor claros, consideraria participar?", type: "single_choice", required: true,
        options: ["CERTEZA","PROVAVELMENTE","TALVEZ","PROVAVELMENTE_NAO","NAO"], semanticCode: "ADOPTION_INTENT" },
      { id: "corp_trust", label: "O que mais influenciaria sua decisão?", type: "single_choice", required: true,
        options: ["IDENTIFICACAO","HORARIO","PONTO","PRECO","CONFIANCA","PREVISIBILIDADE","OUTRO"], semanticCode: "TRUST_FACTORS" },
      { id: "corp_schedule", label: "Deseja preparar um trajeto recorrente para sua rotina?", type: "yes_no", required: true,
        options: [], semanticCode: "BOOKING_INTENT",
        helpText: "Não cria automaticamente viagem, reserva, oferta ou pagamento." },
      { id: "corp_launch", label: "Gostaria de receber informações sobre o início da iniciativa?", type: "yes_no", required: true,
        options: [], semanticCode: "LAUNCH_PARTICIPATION_INTENT",
        helpText: "O consentimento para comunicação será solicitado separadamente." },
    ]},
  ] },
};

export function corporateInternalPreset(): ResearchConfiguration {
  const original = newResearchConfiguration(CORPORATE_INTERNAL_KEY);
  return {
    ...original,
    campaignType: "INSTITUCIONAL",
    accessPolicy: "COLABORADORES_DA_EMPRESA",
    modes: ["CARONA"],
    profiles: ["PASSAGEIRO","MOTORISTA","AMBOS"],
    serviceState: "PLANEJADO",
    partnershipConfirmed: false,
    days: [1,2,3,4,5],
    outboundTimes: ["05:00","06:00","07:00","08:00","14:00","15:00","17:00","18:00","21:00","22:00"],
    returnTimes: ["06:00","14:00","15:00","17:00","18:00","21:00","22:00","23:00"],
    pricing: {currency:"BRL",referencePerTrip:null,referenceSource:""},
    usagePolicy: "Pesquisa restrita a colaboradores da empresa com acesso explicitamente verificado. A participação e os trajetos serão utilizados para estudos agregados de mobilidade. Nenhuma resposta autoriza a empresa a acompanhar trajetos individuais. Caronas, preços, pagamentos e reservas não são criados por esta pesquisa.",
  };
}

export function validateCorporateInternalConfiguration(config: ResearchConfiguration): string[] {
  if (config.templateKey!==CORPORATE_INTERNAL_KEY) return [];
  const errors:string[]=[];
  if (config.accessPolicy!=="COLABORADORES_DA_EMPRESA")
    errors.push("O modelo corporativo exige acesso restrito a colaboradores da empresa.");
  if (!config.institutionName.trim() || !config.institutionId.trim() || !config.campus.trim())
    errors.push("Informe empresa, identificador e unidade.");
  if (config.address.trim().length<5 || config.region.trim().length<2)
    errors.push("Informe endereço institucional e região da unidade.");
  if (config.modes.length!==1 || config.modes[0]!=="CARONA")
    errors.push("Caronas corporativas utilizam somente a modalidade de carona compartilhada.");
  if (!config.profiles.includes("PASSAGEIRO") || !config.profiles.includes("MOTORISTA"))
    errors.push("Disponibilize perfis de passageiro e motorista para pesquisar o interesse.");
  return errors;
}

export function corporateInternalIntro(config: Pick<ResearchConfiguration,"institutionName"|"campus"|"launchDate"|"serviceState">): string {
  const company=config.institutionName.trim()||"sua empresa";
  const unit=config.campus.trim()||"esta unidade";
  const date=config.launchDate
    ? new Date(config.launchDate+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC"})
    : "";
  const start=config.serviceState==="EM_OPERACAO"?"A iniciativa está indicada como ativa nesta unidade."
    : config.serviceState==="ADIADO"?"O início da iniciativa está adiado."
    : config.serviceState==="CONFIRMADO"&&date?"O início está confirmado para "+date+"."
    : date?"O início está previsto para "+date+", sujeito a confirmação.":"A data de início ainda não foi confirmada.";
  return "Sua rotina pode combinar com a de outros colegas. Estamos estudando caronas compartilhadas entre colaboradores de "+
    company+" ("+unit+"), considerando seus turnos, horários e trajetos habituais. "+
    start+" Esta pesquisa é reservada a colaboradores autorizados e não cria corridas nem divulga seu trajeto à empresa.";
}

export function validateCorporateInternalAnswers(schema: SurveySchema, answers: Answers): string[] {
  const qs=schema.sections.flatMap(s=>s.questions);
  const pick=(semantic:string)=>answers[qs.find(q=>q.semanticCode===semantic)?.id??""];
  const seats=pick("SEATS_AVAILABLE");
  const drives=pick("CORP_DRIVES_CAR");
  const offer=pick("RIDE_OFFER_INTENT");
  if (drives==="SIM"&&offer==="SIM"&&(!Number.isInteger(Number(seats))||Number(seats)<1))
    return ["Para oferecer carona, informe pelo menos um lugar livre."];
  return [];
}

export function corporateCanOffer(schema: SurveySchema, answers: Answers): boolean {
  const qs=schema.sections.flatMap(s=>s.questions);
  const pick=(semantic:string)=>answers[qs.find(q=>q.semanticCode===semantic)?.id??""];
  return pick("CORP_DRIVES_CAR")==="SIM"
    && pick("RIDE_OFFER_INTENT")==="SIM"
    && Number.isInteger(Number(pick("SEATS_AVAILABLE")))
    && Number(pick("SEATS_AVAILABLE"))>=1;
}

export function validateCorporateInternalJourney(schema: SurveySchema, answers: Answers, journey: ResearchJourney|null): string[] {
  if (!journey) return ["Preencha seu trajeto habitual."];
  if (journey.mode!=="CARONA") return ["Apenas caronas compartilhadas são previstas neste modelo."];
  if ((journey.profile==="MOTORISTA"||journey.profile==="AMBOS")&&!corporateCanOffer(schema,answers))
    return ["O perfil motorista exige declaração de carro, lugar livre e interesse em oferecer carona."];
  return [];
}
