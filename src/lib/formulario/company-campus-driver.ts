import type { ResearchTemplate, SurveySchema } from "./research-templates";
import type { Answers } from "./research-schema";
import {
  newResearchConfiguration,
  type ResearchConfiguration,
  type ResearchJourney,
} from "./research-configuration";

export const COMPANY_CAMPUS_DRIVER_KEY = "EMPRESA_CARONA_CAMPUS";

/** Corporate employees with spare car seats who MAY share part of a commute
 * with students of a nearby institution. This is market research, not employer
 * approval, university accreditation or an actual published ride.
 */
export const companyCampusDriverTemplate: ResearchTemplate = {
  key: COMPANY_CAMPUS_DRIVER_KEY,
  nature: "EMPRESA",
  label: "Empresa próxima à universidade · motoristas",
  description: "Validação rápida de motoristas, vagas, trajetos, desvios e confiança para caronas com estudantes",
  estimatedMinutes: 4,
  schema: {
    sections: [
      {
        title: "Sua rotina de deslocamento",
        description: "Conte como se desloca atualmente. Não pedimos endereço residencial.",
        questions: [
          {
            id: "company_transport",
            label: "Como você costuma ir e voltar do trabalho?",
            type: "single_choice", required: true,
            options: ["CARRO","MOTO","ONIBUS","APLICATIVO","CARONA","BICICLETA","A_PE","OUTRO"],
            semanticCode: "TRANSPORT_MODE",
          },
          {
            id: "company_drives",
            label: "Você costuma dirigir um carro até a empresa?",
            type: "single_choice", required: true, options: ["SIM","NAO"],
            semanticCode: "COMPANY_DRIVES_CAR",
          },
          {
            id: "company_frequency",
            label: "Com que frequência você dirige até o trabalho?",
            type: "single_choice", required: true,
            options: ["TODOS_DIAS","ALGUNS_DIAS","RARAMENTE"],
            semanticCode: "COMPANY_DRIVING_FREQUENCY",
            showWhen: { questionId: "company_drives", equals: "SIM" },
          },
          {
            id: "company_main_pain",
            label: "Qual a principal dificuldade do seu deslocamento?",
            type: "single_choice", required: true,
            options: ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"],
            semanticCode: "MOBILITY_PAINS",
          },
        ],
      },
      {
        title: "Poderia compartilhar seu trajeto?",
        description: "As perguntas de motorista só aparecem para quem dirige carro.",
        questions: [
          {
            id: "company_seats",
            label: "Quantos lugares para passageiros costumam ficar livres em seu carro?",
            type: "number", required: true, options: [], minValue: 0, maxValue: 4, integerOnly: true,
            semanticCode: "SEATS_AVAILABLE",
            showWhen: { questionId: "company_drives", equals: "SIM" },
            helpText: "Pode informar zero. Lugares declarados não são vagas publicadas.",
          },
          {
            id: "company_offer",
            label: "Você aceitaria oferecer carona a estudantes que seguem na sua direção?",
            type: "yes_no", required: true, options: [],
            semanticCode: "RIDE_OFFER_INTENT",
            showWhen: { questionId: "company_drives", equals: "SIM" },
            helpText: "A oferta não será publicada automaticamente. O percurso precisa ser compatível.",
          },
          {
            id: "company_condition",
            label: "O que seria mais importante para aceitar?",
            type: "single_choice", required: true,
            options: ["IDENTIFICACAO","SEM_GRANDE_DESVIO","DIVIDIR_DESPESAS","HORARIO","PONTO","OUTRO"],
            semanticCode: "TRUST_FACTORS",
            showWhen: { questionId: "company_drives", equals: "SIM" },
          },
          {
            id: "company_detour",
            label: "Qual desvio máximo você consideraria aceitável?",
            type: "single_choice", required: true,
            options: ["NENHUM","ATE_5_MIN","ATE_10_MIN","MAIS_10_MIN","DEPENDE_DA_ROTA"],
            semanticCode: "COMPANY_MAX_DETOUR",
            showWhen: { questionId: "company_drives", equals: "SIM" },
            helpText: "O CARONAA não muda sua rota automaticamente. O desvio precisa ser aprovado.",
          },
          {
            id: "company_adoption",
            label: "Se houver uma carona compatível com condições claras, você consideraria participar?",
            type: "single_choice", required: true,
            options: ["CERTEZA","PROVAVELMENTE","TALVEZ","PROVAVELMENTE_NAO","NAO"],
            semanticCode: "ADOPTION_INTENT",
          },
          {
            id: "company_launch",
            label: "Gostaria de saber quando a iniciativa estiver disponível?",
            type: "yes_no", required: true, options: [],
            semanticCode: "LAUNCH_PARTICIPATION_INTENT",
            helpText: "Esta resposta não autoriza o compartilhamento de seus dados com a empresa. Consentimentos de contato são separados.",
          },
        ],
      },
    ],
  },
};

export function companyCampusDriverPreset(): ResearchConfiguration {
  const initial = newResearchConfiguration(COMPANY_CAMPUS_DRIVER_KEY);
  return {
    ...initial,
    campaignType: "INSTITUCIONAL",
    serviceState: "PLANEJADO",
    modes: ["CARONA"],
    profiles: ["PASSAGEIRO","MOTORISTA","AMBOS"],
    accessPolicy: "PESQUISA_PUBLICA",
    days: [1,2,3,4,5],
    outboundTimes: ["06:00","07:00","08:00","12:00","17:00","18:00","19:00","21:00"],
    returnTimes: ["12:00","17:00","18:00","19:00","20:00","21:00"],
    flexibilityMinutes: 15,
    partnershipConfirmed: false,
    nearbyUniversity: "",
    pricing: { currency: "BRL", referencePerTrip: null, referenceSource: "" },
    usagePolicy: "Pesquisa exploratória com colaboradores de empresas próximas a instituições de ensino. Informações de rota servem para estudar caronas compatíveis, e não comprovam vínculo empregatício, vaga disponível, parceria institucional, reserva ou cobrança. Relatórios às instituições devem ser agregados, nunca por trabalhador.",
  };
}

export function validateCompanyCampusConfiguration(config: ResearchConfiguration): string[] {
  if (config.templateKey !== COMPANY_CAMPUS_DRIVER_KEY) return [];
  const errors: string[] = [];
  if (config.institutionName.trim().length < 2) errors.push("Informe o nome da empresa.");
  if (config.campus.trim().length < 2) errors.push("Informe a unidade da empresa.");
  if (config.address.trim().length < 5) errors.push("Informe o endereço institucional da empresa.");
  if ((config.nearbyUniversity ?? "").trim().length < 2) errors.push("Informe a universidade ou o instituto próximo.");
  if (config.region.trim().length < 2) errors.push("Informe a região da iniciativa.");
  if (!config.modes.includes("CARONA") || config.modes.length !== 1)
    errors.push("Este modelo deve usar somente a modalidade de carona compartilhada.");
  if (!config.profiles.includes("PASSAGEIRO") || !config.profiles.includes("MOTORISTA"))
    errors.push("Disponibilize os perfis passageiro e motorista para pesquisa e pré-ativação.");
  return errors;
}

export function companyCampusDriverIntro(config: Pick<ResearchConfiguration,
  "institutionName" | "campus" | "nearbyUniversity" | "launchDate" | "serviceState" | "partnershipConfirmed">): string {
  const company=config.institutionName.trim() || "esta empresa";
  const school=(config.nearbyUniversity ?? "").trim() || "uma instituição de ensino próxima";
  const date=config.launchDate
    ? new Date(config.launchDate+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC"})
    : null;
  const status=config.serviceState==="EM_OPERACAO"
    ? "A operação está sinalizada como ativa nesta unidade."
    : config.serviceState==="ADIADO"
      ? "O início da iniciativa está adiado."
      : config.serviceState==="CONFIRMADO" && date
        ? "O início está confirmado para "+date+"."
        : date ? "O início está previsto para "+date+", sujeito a confirmação." : "A data de início ainda não foi confirmada.";
  const partnership=config.partnershipConfirmed
    ? "A parceria com a empresa foi informada como confirmada."
    : "Esta é uma pesquisa exploratória; não há parceria institucional confirmada.";
  return "Seu caminho pode ajudar alguém a chegar mais longe. O CARONAA está estudando a possibilidade de conectar colaboradores de "+
    company+" ("+(config.campus.trim()||"unidade local")+") a estudantes da região de "+school+
    " que tenham horários e trajetos compatíveis. Se você dirige carro, queremos saber se poderia dividir lugares livres sem prejudicar sua rotina. "+
    partnership+" "+status+" Participar não obriga ninguém a oferecer carona.";
}

export function validateCompanyCampusAnswers(schema: SurveySchema, answers: Answers): string[] {
  const qs=schema.sections.flatMap(s=>s.questions);
  const get=(code:string)=>answers[qs.find(q=>q.semanticCode===code)?.id ?? ""];
  const drives=get("COMPANY_DRIVES_CAR");
  const seats=get("SEATS_AVAILABLE");
  const offer=get("RIDE_OFFER_INTENT");
  const errors:string[]=[];
  if (drives==="SIM" && seats!==undefined && (Number(seats)<0 || Number(seats)>4 || !Number.isInteger(Number(seats))))
    errors.push("Informe de zero a quatro lugares disponíveis no carro.");
  if (drives==="SIM" && offer==="SIM" && Number(seats)<1)
    errors.push("Para oferecer carona, indique pelo menos um lugar realmente disponível.");
  return errors;
}

export function companyCampusSuggestedProfile(schema: SurveySchema, answers: Answers): ResearchJourney["profile"] {
  const qs=schema.sections.flatMap(s=>s.questions);
  const answer=(code:string)=>answers[qs.find(q=>q.semanticCode===code)?.id ?? ""];
  return answer("COMPANY_DRIVES_CAR")==="SIM" &&
    answer("RIDE_OFFER_INTENT")==="SIM" && Number(answer("SEATS_AVAILABLE"))>=1
    ? "MOTORISTA" : "PASSAGEIRO";
}

export function validateCompanyCampusJourney(
  schema: SurveySchema, answers: Answers, journey: ResearchJourney | null,
): string[] {
  if (!journey) return ["Preencha o trajeto para concluir sua pesquisa."];
  const suggested=companyCampusSuggestedProfile(schema,answers);
  if (suggested!=="MOTORISTA" && (journey.profile==="MOTORISTA" || journey.profile==="AMBOS"))
    return ["Você ainda não declarou disponibilidade de carro, lugar e intenção de oferecer carona. Selecione passageiro ou revise suas respostas."];
  if (journey.mode!=="CARONA") return ["Escolha a modalidade de carona compartilhada."];
  return [];
}
