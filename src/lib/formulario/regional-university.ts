import type { ResearchTemplate, SurveySchema } from "./research-templates";
import type { Answers } from "./research-schema";
import {
  newResearchConfiguration,
  type ResearchConfiguration,
} from "./research-configuration";

export const REGIONAL_UNIVERSITY_KEY = "UNIVERSIDADE_MOBILIDADE_REGIONAL";

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
        title: "Como você chega ao campus?",
        description: "Responda sobre sua rotina real. Não é necessário informar endereço residencial.",
        questions: [
          {
            id: "regional_affiliation",
            label: "Qual é seu vínculo com a universidade?",
            type: "single_choice", required: true,
            options: ["ESTUDANTE", "ESTUDANTE_TRABALHADOR", "PROFESSOR", "COLABORADOR", "TERCEIRIZADO", "OUTRO"],
            semanticCode: "ACADEMIC_ROLE",
          },
          {
            id: "regional_transport",
            label: "Quais meios de transporte você usa para ir ou voltar do campus?",
            type: "multiple_choice", required: true,
            options: ["ONIBUS", "VAN", "MOTOTAXI", "CARRO", "MOTO", "CARONA", "APLICATIVO", "BICICLETA", "A_PE", "OUTRO"],
            semanticCode: "TRANSPORT_MODE",
          },
          {
            id: "regional_cost",
            label: "Quanto costuma gastar por trecho, em R$?",
            type: "number", required: false, options: [],
            semanticCode: "COST_PER_TRIP", minValue: 0, maxValue: 10000,
            helpText: "Informe o custo de uma única viagem (pode ser zero). Não é o valor semanal.",
          },
          {
            id: "regional_wait",
            label: "Quanto tempo costuma esperar pelo transporte (minutos)?",
            type: "number", required: false, options: [],
            semanticCode: "WAIT_TIME", minValue: 0, maxValue: 1440, integerOnly: true,
            helpText: "Se não espera pelo transporte, informe 0.",
          },
          {
            id: "regional_pains",
            label: "Quais dificuldades mais afetam seu deslocamento?",
            type: "multiple_choice", required: true,
            options: ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"],
            maxValue: 2, semanticCode: "MOBILITY_PAINS",
            helpText: "Selecione no máximo duas dificuldades.",
          },
          {
            id: "regional_primary_pain",
            label: "Qual dessas dificuldades é a principal?",
            type: "single_choice", required: true,
            options: ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"],
            semanticCode: "REGIONAL_PRIMARY_PAIN",
          },
        ],
      },
      {
        title: "Qual alternativa ajudaria?",
        description: "Carona compartilhada é diferente de mototáxi profissional. Queremos estudar as duas possibilidades.",
        questions: [
          {
            id: "regional_alternative",
            label: "Qual alternativa faria mais sentido para você?",
            type: "single_choice", required: true,
            options: ["CARONA_COMPARTILHADA", "MOTOTAXI_REGULARIZADO", "AMBAS_MODALIDADES", "NENHUMA", "CONHECER_MELHOR"],
            semanticCode: "REGIONAL_SERVICE_PREFERENCE",
          },
          {
            id: "regional_adoption",
            label: "Se houvesse uma opção compatível com seu horário e trajeto, com preço e condições claros, consideraria utilizá-la?",
            type: "single_choice", required: true,
            options: ["CERTEZA", "PROVAVELMENTE", "TALVEZ", "PROVAVELMENTE_NAO", "NAO"],
            semanticCode: "ADOPTION_INTENT",
          },
          {
            id: "regional_trust_barrier",
            label: "O que mais faria você hesitar em utilizar a solução?",
            type: "single_choice", required: true,
            options: ["SEGURANCA", "PRECO", "DISPONIBILIDADE", "CONFIANCA", "ESPERA", "OUTRO"],
            semanticCode: "REGIONAL_BARRIER",
          },
          {
            id: "regional_budget",
            label: "Qual faixa de valor caberia no seu orçamento por trecho?",
            type: "money_range", required: false,
            options: ["ATE_5", "DE_5_A_10", "DE_10_A_15", "DE_15_A_20", "ACIMA_20", "DEPENDE_DA_ROTA"],
            semanticCode: "ACCEPTABLE_FARE_RANGE",
            helpText: "É apenas um orçamento declarado, não uma cotação, reserva nem cobrança.",
          },
        ],
      },
      {
        title: "Você também poderia oferecer transporte?",
        description: "A participação como motorista é opcional. Serviços profissionais exigem validação e habilitação específicas.",
        questions: [
          {
            id: "regional_offer_possible",
            label: "Você poderia compartilhar lugares em um trajeto que já faz?",
            type: "single_choice", required: true,
            options: ["SIM", "NAO"],
            semanticCode: "REGIONAL_OFFER_POSSIBLE",
          },
          {
            id: "regional_vehicle",
            label: "Qual veículo próprio utilizaria para a carona compartilhada?",
            type: "single_choice", required: true,
            options: ["CARRO", "MOTO"],
            semanticCode: "REGIONAL_OFFER_VEHICLE",
            showWhen: { questionId: "regional_offer_possible", equals: "SIM" },
          },
          {
            id: "regional_seats",
            label: "Quantos lugares para passageiros realmente teria disponíveis?",
            type: "number", required: true, options: [],
            minValue: 1, maxValue: 4, integerOnly: true,
            semanticCode: "SEATS_AVAILABLE",
            showWhen: { questionId: "regional_offer_possible", equals: "SIM" },
            helpText: "Na moto, no máximo um passageiro e apenas se o serviço for permitido e habilitado.",
          },
          {
            id: "regional_professional_role",
            label: "Você trabalha como mototaxista profissional?",
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
            helpText: "É apenas manifestação de interesse. Credenciamento, regras locais e autorização serão analisados separadamente.",
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
