import type { ResearchTemplate, SurveySchema } from "./research-templates";
import { researchRoleQuestion, roleCondition } from "./research-conditions";
import type { Answers } from "./research-schema";
import {
  newResearchConfiguration,
  type ResearchConfiguration,
} from "./research-configuration";

export const REGIONAL_UNIVERSITY_KEY = "UNIVERSIDADE_MOBILIDADE_REGIONAL";

const PASSENGER = roleCondition("PASSAGEIRO", "AMBOS");
const DRIVER = roleCondition("MOTORISTA", "AMBOS");
const PROFESSIONAL = roleCondition("PROFISSIONAL");

/** Study two distinct markets. CARONA is peer-to-peer ride sharing.
 * TRANSPORTE_PROFISSIONAL_INTERESSE is research ONLY; never an active mototaxi service.
 */
export const regionalUniversityTemplate: ResearchTemplate = {
  key: REGIONAL_UNIVERSITY_KEY,
  nature: "EDUCACAO",
  label: "Universidade regional · Mobilidade local",
  description: "Regiões com poucas alternativas: carona, mototáxi local e acesso ao campus",
  estimatedMinutes: 5,
  schema: {
    sections: [
      {
        title: "Seu perfil",
        description: "Cada perfil responde apenas ao que faz sentido para ele.",
        questions: [
          researchRoleQuestion(true),
          {
            id: "regional_affiliation",
            label: "Qual é seu vínculo com a universidade?",
            type: "single_choice", required: true,
            options: ["ESTUDANTE", "ESTUDANTE_TRABALHADOR", "PROFESSOR", "COLABORADOR", "TERCEIRIZADO", "OUTRO"],
            semanticCode: "ACADEMIC_ROLE",
          },
        ],
      },
      {
        title: "Como você chega ao campus?",
        description: "Sua rotina real como passageiro. Não pedimos endereço residencial.",
        condition: PASSENGER,
        questions: [
          {
            id: "regional_transport",
            condition: PASSENGER,
            label: "Como você se desloca hoje até o campus?",
            type: "multiple_choice", required: true,
            options: ["ONIBUS", "VAN", "MOTOTAXI", "CARONA", "APLICATIVO", "BICICLETA", "A_PE", "OUTRO"],
            semanticCode: "TRANSPORT_MODE",
          },
          {
            id: "regional_wait",
            condition: PASSENGER,
            label: "Quanto tempo costuma esperar pelo transporte (minutos)?",
            type: "number", required: false, options: [],
            semanticCode: "WAIT_TIME", minValue: 0, maxValue: 1440, integerOnly: true,
            helpText: "Se não espera, informe 0.",
          },
          {
            id: "regional_cost",
            condition: PASSENGER,
            label: "Quanto costuma gastar por trecho, em R$?",
            type: "number", required: false, options: [],
            semanticCode: "COST_PER_TRIP", minValue: 0, maxValue: 10000,
            helpText: "Custo de uma única viagem (pode ser zero).",
          },
          {
            id: "regional_pains",
            condition: PASSENGER,
            label: "Quais dificuldades mais afetam seu deslocamento?",
            type: "multiple_choice", required: true,
            options: ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"],
            maxValue: 2, semanticCode: "MOBILITY_PAINS",
            helpText: "Selecione no máximo duas dificuldades.",
          },
          {
            id: "regional_primary_pain",
            condition: PASSENGER,
            label: "Qual dessas dificuldades é a principal?",
            type: "single_choice", required: true,
            options: ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"],
            semanticCode: "REGIONAL_PRIMARY_PAIN",
          },
          {
            id: "regional_alternative",
            condition: PASSENGER,
            label: "Qual alternativa faria mais sentido para você?",
            type: "single_choice", required: true,
            options: ["CARONA_COMPARTILHADA", "MOTOTAXI_REGULARIZADO", "AMBAS_MODALIDADES", "NENHUMA", "CONHECER_MELHOR"],
            semanticCode: "REGIONAL_SERVICE_PREFERENCE",
          },
          {
            id: "regional_adoption",
            condition: PASSENGER,
            label: "Com horário, trajeto e preço claros, consideraria pegar carona?",
            type: "single_choice", required: true,
            options: ["CERTEZA", "PROVAVELMENTE", "TALVEZ", "PROVAVELMENTE_NAO", "NAO"],
            semanticCode: "ADOPTION_INTENT",
          },
          {
            id: "regional_trust_barrier",
            condition: PASSENGER,
            label: "O que mais faria você hesitar em pegar carona?",
            type: "single_choice", required: true,
            options: ["SEGURANCA", "PRECO", "DISPONIBILIDADE", "CONFIANCA", "ESPERA", "OUTRO"],
            semanticCode: "REGIONAL_BARRIER",
          },
          {
            id: "regional_budget",
            condition: PASSENGER,
            label: "Qual faixa de valor caberia no seu orçamento por trecho?",
            type: "money_range", required: false,
            options: ["ATE_5", "DE_5_A_10", "DE_10_A_15", "DE_15_A_20", "ACIMA_20", "DEPENDE_DA_ROTA"],
            semanticCode: "ACCEPTABLE_FARE_RANGE",
            helpText: "Referência do CARONAA: R$ 6 a cada 11 km. É só um orçamento declarado, não uma cobrança.",
          },
        ],
      },
      {
        title: "Seu veículo e disponibilidade",
        description: "Você já faz o trajeto: queremos saber como compartilhar lugares sem atrapalhar sua rotina.",
        condition: DRIVER,
        questions: [
          {
            id: "regional_vehicle",
            condition: DRIVER,
            label: "Qual veículo próprio você usa para ir à universidade?",
            type: "single_choice", required: true,
            options: ["CARRO", "MOTO"],
            semanticCode: "REGIONAL_OFFER_VEHICLE",
          },
          {
            id: "regional_seats",
            condition: DRIVER,
            label: "Quantos lugares para passageiros teria disponíveis?",
            type: "number", required: true, options: [],
            minValue: 1, maxValue: 7, integerOnly: true,
            semanticCode: "SEATS_AVAILABLE",
            helpText: "Na moto, no máximo um passageiro.",
          },
          {
            id: "regional_driving_frequency",
            condition: DRIVER,
            label: "Com que frequência vai de veículo à universidade?",
            type: "single_choice", required: true,
            options: ["TODOS_DIAS", "ALGUNS_DIAS", "RARAMENTE"],
            semanticCode: "COMPANY_DRIVING_FREQUENCY",
          },
          {
            id: "regional_driver_monthly_cost",
            condition: DRIVER,
            label: "Quanto gasta por mês com combustível no trajeto?",
            type: "single_choice", required: false,
            options: ["ATE_150", "DE_150_A_300", "DE_300_A_500", "ACIMA_500"],
            semanticCode: "DRIVER_MONTHLY_COST",
          },
          {
            id: "regional_driver_motivation",
            condition: DRIVER,
            label: "O que mais motivaria você a compartilhar lugares?",
            type: "single_choice", required: true,
            options: ["DIVIDIR_DESPESAS", "AJUDAR", "PRATICIDADE", "OUTRO"],
            semanticCode: "URBAN_DRIVER_MOTIVATION",
          },
          {
            id: "regional_driver_detour",
            condition: DRIVER,
            label: "Qual desvio máximo aceitaria para buscar um passageiro?",
            type: "single_choice", required: true,
            options: ["NENHUM", "ATE_5_MIN", "ATE_10_MIN", "DEPENDE_DA_ROTA"],
            semanticCode: "COMPANY_MAX_DETOUR",
            helpText: "O CARONAA nunca muda sua rota sem sua aprovação.",
          },
        ],
      },
      {
        title: "Transporte profissional local",
        description: "Serviços profissionais exigem validação e habilitação específicas.",
        condition: PROFESSIONAL,
        questions: [
          {
            id: "regional_professional_role",
            condition: PROFESSIONAL,
            label: "Você atua profissionalmente como mototaxista?",
            type: "single_choice", required: true,
            options: ["SIM", "NAO"],
            semanticCode: "REGIONAL_PROFESSIONAL_ROLE",
            helpText: "Declarar esta atividade não habilita automaticamente você a transportar passageiros pelo CARONAA.",
          },
          {
            id: "regional_professional_interest",
            label: "Gostaria de receber informações sobre uma eventual parceria com profissionais locais habilitados?",
            type: "single_choice", required: true,
            options: ["SIM", "NAO"],
            semanticCode: "REGIONAL_PROFESSIONAL_INTEREST",
            showWhen: { questionId: "regional_professional_role", equals: "SIM" },
            helpText: "É apenas manifestação de interesse. Credenciamento e autorização serão analisados separadamente.",
          },
        ],
      },
      {
        title: "Lançamento no campus",
        description: "Você pode registrar seu interesse sem criar oferta, corrida ou pagamento.",
        questions: [
          {
            id: "regional_launch_interest",
            label: "Gostaria de saber quando o CARONAA começar na universidade?",
            type: "yes_no", required: true, options: [],
            semanticCode: "LAUNCH_PARTICIPATION_INTENT",
            helpText: "A autorização para receber contato será solicitada separadamente.",
          },
          {
            id: "regional_preparation",
            label: "Deseja preparar seu trajeto ou sua disponibilidade para a possível ativação?",
            type: "yes_no", required: true, options: [],
            semanticCode: "BOOKING_INTENT",
            helpText: "Não é reserva, oferta pública nem garantia de transporte. A confirmação será feita no aplicativo.",
          },
        ],
      },
    ],
  },
};

export function regionalUniversityPreset(): ResearchConfiguration {
  const base = newResearchConfiguration(REGIONAL_UNIVERSITY_KEY);
  return {
    ...base,
    campaignType: "INSTITUCIONAL",
    accessPolicy: "PESQUISA_PUBLICA",
    profiles: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
    modes: ["CARONA", "TRANSPORTE_PROFISSIONAL_INTERESSE"],
    partnershipConfirmed: false,
    partnershipDescription: "",
    serviceState: "PLANEJADO",
    pricing: { currency: "BRL", referencePerTrip: null, referenceSource: "" },
    usagePolicy: "Esta pesquisa estuda a mobilidade da comunidade universitária, caronas compartilhadas e o interesse em alternativas locais. Transporte profissional, incluindo mototáxi, depende de credenciamento, autorização e requisitos aplicáveis. Preencher não cria corrida, oferta, contrato, reserva ou cobrança. Dados de pesquisa serão analisados de forma agregada.",
  };
}

export function regionalUniversityIntro(
  config: Pick<ResearchConfiguration, "institutionName" | "campus" | "partnershipConfirmed" | "modes">,
): string {
  const name = config.institutionName.trim() || "sua universidade";
  const campus = config.campus.trim() || "o campus";
  const shared = "Queremos entender como você chega e volta do campus, onde encontra dificuldades e se uma carona compartilhada com trajeto compatível ajudaria.";
  const professional = config.modes.includes("TRANSPORTE_PROFISSIONAL_INTERESSE")
    ? config.partnershipConfirmed
      ? " Também investigamos o interesse em opções de transporte profissional local; o atendimento depende de autorização e habilitação."
      : " Também estudamos a possibilidade de trabalhar com mototaxistas locais habilitados, mas não há parceria confirmada nem transporte profissional disponível por esta pesquisa."
    : "";
  return "Como você chega à " + name + "? Em " + campus + ", encontrar transporte no horário certo pode ser um desafio. " +
    shared + professional + " Responda em poucos minutos e, se desejar, prepare seu interesse para o lançamento.";
}

/** Client validation complements required/type checks and uses semantic codes,
 * because clone/publish versions have remapped question UUIDs.
 */
export function validateRegionalUniversityAnswers(schema: SurveySchema, answers: Answers): string[] {
  const questions = schema.sections.flatMap((s) => s.questions);
  const id = (semantic: string) => questions.find((q) => q.semanticCode === semantic)?.id;
  const pains = answers[id("MOBILITY_PAINS") ?? ""];
  const primary = answers[id("REGIONAL_PRIMARY_PAIN") ?? ""];
  const offered = answers[id("REGIONAL_OFFER_POSSIBLE") ?? ""];
  const vehicle = answers[id("REGIONAL_OFFER_VEHICLE") ?? ""];
  const seats = answers[id("SEATS_AVAILABLE") ?? ""];
  const professional = answers[id("REGIONAL_PROFESSIONAL_ROLE") ?? ""];
  const professionalInterest = answers[id("REGIONAL_PROFESSIONAL_INTEREST") ?? ""];
  const errors: string[] = [];
  if (Array.isArray(pains) && pains.length > 2) errors.push("Escolha no máximo duas dificuldades.");
  if (Array.isArray(pains) && typeof primary === "string" && !pains.includes(primary))
    errors.push("A dificuldade principal deve ser uma das opções escolhidas.");
  if (offered === "SIM" && vehicle === "MOTO" && seats !== undefined && Number(seats) !== 1)
    errors.push("Motocicletas podem oferecer apenas um lugar para passageiro, quando permitido.");
  if (professional !== "SIM" && professionalInterest === "SIM")
    errors.push("O interesse profissional é exclusivo para quem declarou atuar como mototaxista.");
  return errors;
}
