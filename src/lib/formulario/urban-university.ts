import type { ResearchTemplate, SurveySchema } from "./research-templates";
import {
  newResearchConfiguration,
  type ResearchConfiguration,
} from "./research-configuration";
import type { Answers } from "./research-schema";

export const URBAN_UNIVERSITY_KEY = "UNIVERSIDADE_URBANA_CARONAA";

/** The existing configured-research service stores identity, dates, days, times and
 * journeys transactionally. This model adds only research questions (no duplicate route
 * or identity tables, and no pretend booking/payment events).
 */
export const urbanUniversityTemplate: ResearchTemplate = {
  key: URBAN_UNIVERSITY_KEY,
  nature: "EDUCACAO",
  label: "Universidade urbana · CARONAA",
  description: "Validação de custos, Uber/99, problemas, motoristas e disposição a pagar",
  estimatedMinutes: 5,
  schema: {
    sections: [
      {
        title: "Sua rotina universitária",
        description: "Queremos conhecer suas alternativas atuais. Não pedimos seu endereço residencial.",
        questions: [
          { id: "urban_affiliation", label: "Qual é seu vínculo com a universidade?", type: "single_choice", required: true,
            options: ["ESTUDANTE","ESTUDANTE_TRABALHADOR","PROFESSOR","COLABORADOR","TERCEIRIZADO","OUTRO"], semanticCode: "ACADEMIC_ROLE" },
          { id: "urban_transport", label: "Como costuma ir ou voltar da universidade?", type: "multiple_choice", required: true,
            options: ["ONIBUS","APLICATIVO","CARRO","MOTO","CARONA","BICICLETA","A_PE","OUTRO"], semanticCode: "TRANSPORT_MODE" },
          { id: "urban_cost", label: "Quanto gasta, em média, por trecho (em R$)?", type: "number", required: false, options: [],
            semanticCode: "COST_PER_TRIP", helpText: "Considere uma única viagem, não a semana. Pode informar 0.", minValue: 0, maxValue: 10000 },
          { id: "urban_pains", label: "Quais são as duas maiores dificuldades no seu deslocamento?", type: "multiple_choice", required: true,
            options: ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"], semanticCode: "MOBILITY_PAINS",
            helpText: "Escolha uma ou duas dificuldades." },
          { id: "urban_primary_pain", label: "Qual dessas dificuldades é a principal?", type: "single_choice", required: true,
            options: ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"], semanticCode: "URBAN_PRIMARY_PAIN" },
        ],
      },
      {
        title: "Oferta de caronas e confiança",
        description: "Mesmo que só queira pegar carona, sua opinião nos ajuda a validar a proposta.",
        questions: [
          { id: "urban_offer_possible", label: "Você poderia oferecer lugares em um trajeto que já realiza?", type: "yes_no", required: true,
            options: [], semanticCode: "RIDE_OFFER_INTENT" },
          { id: "urban_offer_vehicle", label: "Qual veículo usaria para oferecer carona?", type: "single_choice", required: true,
            options: ["CARRO","MOTO"], showWhen: { questionId: "urban_offer_possible", equals: "SIM" }, semanticCode: "URBAN_OFFER_VEHICLE" },
          { id: "urban_seats", label: "Quantos lugares para passageiros teria disponíveis?", type: "number", required: true,
            options: [], minValue: 1, maxValue: 4, integerOnly: true, semanticCode: "SEATS_AVAILABLE",
            showWhen: { questionId: "urban_offer_possible", equals: "SIM" },
            helpText: "Para uma motocicleta, considere apenas um passageiro, quando a modalidade for permitida." },
          { id: "urban_adoption", label: "Se uma carona tiver rota, horário e condições claras, consideraria participar?", type: "single_choice",
            required: true, options: ["CERTEZA","PROVAVELMENTE","TALVEZ","PROVAVELMENTE_NAO","NAO"], semanticCode: "ADOPTION_INTENT" },
          { id: "urban_decision", label: "O que mais influenciaria sua decisão?", type: "single_choice", required: true,
            options: ["PRECO","CONFIANCA","HORARIO","PONTO","AVALIACOES","PREVISIBILIDADE","OUTRO"],
            semanticCode: "TRUST_FACTORS" },
        ],
      },
      {
        title: "Valor e lançamento",
        description: "Estas perguntas medem interesse declarado. Não fazem uma reserva nem cobram nada.",
        questions: [
          { id: "urban_budget", label: "Qual faixa de valor caberia no seu orçamento por trecho?", type: "money_range", required: false,
            options: ["ATE_5","DE_5_A_10","DE_10_A_15","DE_15_A_20","ACIMA_20","DEPENDE_DA_ROTA"],
            semanticCode: "ACCEPTABLE_FARE_RANGE", helpText: "Faixas indicativas, não são preços ou cotações do CARONAA." },
          { id: "urban_driver_motivation", label: "O que mais motivaria você a oferecer carona?", type: "single_choice", required: false,
            options: ["DIVIDIR_DESPESAS","AJUDAR","PRATICIDADE","OUTRO"],
            semanticCode: "URBAN_DRIVER_MOTIVATION", showWhen: { questionId: "urban_offer_possible", equals: "SIM" } },
          { id: "urban_launch_interest", label: "Tem interesse em receber notícias sobre o lançamento?", type: "yes_no", required: true,
            options: [], semanticCode: "LAUNCH_PARTICIPATION_INTENT",
            helpText: "Esta resposta não autoriza contato comercial. O consentimento é solicitado separadamente." },
          { id: "urban_prep_intent", label: "Gostaria de preparar seu interesse para encontrar ou oferecer uma carona?", type: "yes_no",
            required: true, options: [], semanticCode: "BOOKING_INTENT",
            helpText: "A preparação é opcional e não cria oferta pública, reserva, match ou cobrança." },
        ],
      },
    ],
  },
};

export function urbanUniversityPreset(): ResearchConfiguration {
  const initial = newResearchConfiguration(URBAN_UNIVERSITY_KEY);
  return {
    ...initial,
    campaignType: "INSTITUCIONAL",
    modes: ["CARONA"],
    profiles: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
    accessPolicy: "PESQUISA_PUBLICA",
    usagePolicy: "Esta pesquisa investiga a mobilidade da comunidade universitária. O registro de interesse não representa reserva, oferta pública nem garantia de atendimento. Os dados serão usados para análises agregadas, conforme o aviso de privacidade aplicável.",
  };
}

export function urbanUniversityIntro(config: ResearchConfiguration): string {
  const place = config.institutionName.trim() || "sua universidade";
  return "Seu caminho para " + place + " pode ser mais simples. " +
    "O CARONAA conecta pessoas com trajetos e horários compatíveis para compartilhar deslocamentos. " +
    "Queremos compreender como quem frequenta " + (config.campus || "o campus") +
    " se desloca hoje e preparar oportunidades reais para o lançamento. " +
    "Responda em poucos minutos e, se desejar, manifeste seu interesse em uma futura carona.";
}

/** Validation independent of remapped published question UUIDs. */
export function validateUrbanUniversityAnswers(schema: SurveySchema, answers: Answers): string[] {
  const questions = schema.sections.flatMap((s) => s.questions);
  const questionBy = (code: string) => questions.find((q) => q.semanticCode === code);
  const painsId = questionBy("MOBILITY_PAINS")?.id;
  const primaryId = questionBy("URBAN_PRIMARY_PAIN")?.id;
  const vehicleId = questionBy("URBAN_OFFER_VEHICLE")?.id;
  const seatsId = questionBy("SEATS_AVAILABLE")?.id;
  const pains = painsId ? answers[painsId] : undefined;
  const primary = primaryId ? answers[primaryId] : undefined;
  const vehicle = vehicleId ? answers[vehicleId] : undefined;
  const seats = seatsId ? answers[seatsId] : undefined;
  const errors: string[] = [];
  if (Array.isArray(pains) && pains.length > 2)
    errors.push("Selecione no máximo duas dificuldades.");
  if (Array.isArray(pains) && typeof primary === "string" && !pains.includes(primary))
    errors.push("Escolha como principal uma das dificuldades que você marcou.");
  if (vehicle === "MOTO" && seats !== undefined && Number(seats) !== 1)
    errors.push("Para motocicleta, informe apenas um lugar para passageiro.");
  return errors;
}
