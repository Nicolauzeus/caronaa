import type { ResearchTemplate, SurveySchema } from "./research-templates";
import { newResearchConfiguration, type ResearchConfiguration, type ResearchJourney, type PublicResearchConfiguration } from "./research-configuration";
import type { Answers } from "./research-schema";

export const EVENT_EXIT_MATCH_KEY = "EVENTO_MATCH_CARONAA";

export const eventExitMatchTemplate: ResearchTemplate = {
  key: EVENT_EXIT_MATCH_KEY,
  nature: "EVENTO",
  label: "Evento · Carona na saída",
  description: "Pesquisa expressa sobre horário, direção e interesse em encontrar ou oferecer carona",
  estimatedMinutes: 2,
  schema: {
    sections: [{
      title: "Sua saída do evento",
      description: "Responda rapidamente. A rota e o horário serão selecionados na próxima etapa.",
      questions: [
        {
          id: "event_transport", label: "Como você costuma voltar de eventos?",
          type: "multiple_choice", required: true,
          options: ["ONIBUS","APLICATIVO","CARRO","MOTO","CARONA","MOTOTAXI","A_PE","OUTRO"],
          semanticCode: "TRANSPORT_MODE", maxValue: 2, helpText: "Marque até duas opções.",
        },
        {
          id: "event_main_pain", label: "Qual é sua principal dificuldade ao voltar de eventos?",
          type: "multiple_choice", required: true,
          options: ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"],
          semanticCode: "MOBILITY_PAINS", maxValue: 1,
          helpText: "Escolha apenas uma dificuldade.",
        },
        {
          id: "event_offer_possible", label: "Você poderia oferecer lugares numa carona ao sair do evento?",
          type: "single_choice", required: true, options: ["SIM","NAO"],
          semanticCode: "EVENT_OFFER_POSSIBLE",
        },
        {
          id: "event_offer_vehicle", label: "Com qual veículo poderia oferecer carona?",
          type: "single_choice", required: true, options: ["CARRO","MOTO"],
          semanticCode: "EVENT_OFFER_VEHICLE",
          showWhen: { questionId: "event_offer_possible", equals: "SIM" },
        },
        {
          id: "event_offer_seats", label: "Quantos lugares para passageiros estariam disponíveis?",
          type: "number", required: true, options: [], minValue: 1, maxValue: 4, integerOnly: true,
          semanticCode: "EVENT_OFFER_SEATS",
          showWhen: { questionId: "event_offer_possible", equals: "SIM" },
          helpText: "Motocicleta: somente um passageiro, quando permitido e habilitado.",
        },
        {
          id: "event_adoption", label: "Se houver uma carona compatível com horário, percurso, valor e segurança claros, você consideraria participar?",
          type: "single_choice", required: true,
          options: ["CERTEZA","PROVAVELMENTE","TALVEZ","NAO"],
          semanticCode: "ADOPTION_INTENT",
        },
        {
          id: "event_barrier", label: "O que mais dificultaria sua decisão?",
          type: "single_choice", required: false,
          options: ["PRECO","CONFIANCA","HORARIO","SEGURANCA","OUTRO"],
          semanticCode: "EVENT_ADOPTION_BARRIER",
        },
      ],
    }],
  },
};

/** Existing configured-research services own the identity, event day, safe pickup and
 * actual routes. No second booking database is introduced. */
export function eventExitMatchPreset(): ResearchConfiguration {
  const base = newResearchConfiguration(EVENT_EXIT_MATCH_KEY);
  return {
    ...base,
    campaignType: "EVENTO",
    serviceState: "PLANEJADO",
    modes: ["CARONA"],
    profiles: ["PASSAGEIRO","MOTORISTA","AMBOS"],
    days: [1,2,3,4,5,6,7],
    outboundTimes: ["17:00","18:00","19:00","20:00","21:00","22:00"],
    returnTimes: ["17:00","18:00","19:00","20:00","21:00","22:00"],
    flexibilityMinutes: 30,
    partnershipConfirmed: false,
    pricing: { currency: "BRL", referencePerTrip: null, referenceSource: "" },
    usagePolicy: "Pesquisa expressa sobre o trajeto de saída de um evento. Participar não cria reserva, oferta pública, pagamento nem garantia de carona. O interesse pode ser registrado separadamente, com sua autorização.",
  };
}

export function validateEventConfiguration(config: ResearchConfiguration): string[] {
  if (config.templateKey !== EVENT_EXIT_MATCH_KEY) return [];
  const errors: string[] = [];
  if (!config.launchDate) errors.push("Informe a data do evento para permitir buscas por caronas reais.");
  if (!config.campus.trim()) errors.push("Informe o local de realização do evento.");
  if (!config.address.trim()) errors.push("Informe o endereço do evento.");
  if (!config.safeMeetingPoints.length) errors.push("Informe pelo menos um ponto seguro de embarque.");
  if (!config.modes.includes("CARONA") || config.modes.length !== 1)
    errors.push("O modelo de evento permite somente carona compartilhada.");
  if (!config.campaignName.trim()) errors.push("Identifique a campanha do evento.");
  return errors;
}

export function eventExitMatchIntro(config: Pick<ResearchConfiguration, "institutionName" | "campus">): string {
  const name = config.institutionName.trim() || "o evento";
  return "Está saindo de " + name + "? Talvez alguém esteja indo na mesma direção. " +
    "O CARONAA ajuda a procurar pessoas com horários e trajetos compatíveis para compartilhar caronas. " +
    "Conte rapidamente seu plano de saída de " + (config.campus.trim() || "aqui") +
    " e veja os próximos passos. A disponibilidade de caronas depende de ofertas reais no aplicativo.";
}

export function validateEventExitAnswers(schema: SurveySchema, answers: Answers): string[] {
  const q = schema.sections.flatMap(s=>s.questions);
  const answer = (code: string) => answers[q.find(v=>v.semanticCode===code)?.id ?? ""];
  const vehicle=answer("EVENT_OFFER_VEHICLE");
  const seats=answer("EVENT_OFFER_SEATS");
  const offer=answer("EVENT_OFFER_POSSIBLE");
  const mainPain=answer("MOBILITY_PAINS");
  const errors: string[]=[];
  if (Array.isArray(mainPain) && mainPain.length > 1) errors.push("Escolha uma única dificuldade principal.");
  if (offer==="SIM" && vehicle==="MOTO" && seats!==undefined && Number(seats)!==1)
    errors.push("Para motocicleta, informe no máximo um lugar para passageiro.");
  return errors;
}

/** The explicit role picked at the route step cannot contradict willingness to offer. */
export function validateEventExitJourney(schema: SurveySchema, answers: Answers, journey: ResearchJourney | null): string[] {
  if (!journey) return ["Preencha seu trajeto de saída do evento."];
  const eligible=schema.sections.flatMap(s=>s.questions).find(q=>q.semanticCode==="EVENT_OFFER_POSSIBLE");
  const offer=eligible ? answers[eligible.id] : null;
  if (journey.direction!=="VOLTA") return ["O trajeto do evento deve partir do local do evento."];
  if (journey.mode!=="CARONA") return ["Este modelo destina-se apenas a caronas compartilhadas."];
  if (offer!=="SIM" && (journey.profile==="MOTORISTA"||journey.profile==="AMBOS"))
    return ["Você marcou que não oferece carona. Selecione passageiro ou altere sua resposta anterior."];
  return [];
}

/** Build links only when the event is operational and date is usable. The other
 * side still verifies auth, availability, route, quote and explicitly confirms. */
export function eventRideActionLinks(config: PublicResearchConfiguration["settings"], journey: ResearchJourney, today: string, seats?: number) {
  if (config.templateKey !== EVENT_EXIT_MATCH_KEY || config.serviceState !== "EM_OPERACAO") return null;
  const day=config.launchDate;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today) return null;
  if (journey.mode !== "CARONA" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(journey.outboundTime)) return null;
  // The event exit form is for a journey FROM the event, not an arbitrary commute.
  if (journey.direction !== "VOLTA" || !journey.originArea.trim() || !journey.destinationArea.trim()) return null;
  const base = new URLSearchParams({
    origem: journey.originArea.trim().slice(0,160),
    destino: journey.destinationArea.trim().slice(0,160),
    data: day,
    horario: journey.outboundTime,
  });
  // Do not add private residential coordinates to URLs; the user reviews the route
  // in the authenticated/public booking flow before making a real request.
  const tolerances=[5,15,30,60];
  const matchedTolerance=tolerances.reduce((best,n) => Math.abs(n-journey.flexibilityMinutes) < Math.abs(best-journey.flexibilityMinutes) ? n : best,15);
  base.set("tolerancia",String(matchedTolerance));
  const offerParams = new URLSearchParams(base);
  if (seats !== undefined && Number.isInteger(seats) && seats>=1 && seats<=4) offerParams.set("vagas", String(seats));
  return { search: "/buscar?"+base.toString(), offer: "/oferecer?"+offerParams.toString() };
}
