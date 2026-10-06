import type { CaronaaIntent, CaronaaStsFormData, VehicleType } from "./types";

export type FormStep =
  | "INTRO"
  | "PROFILE_ROUTE"
  | "PROPOSAL_TRANSITION"
  | "DRIVER_FLOW"
  | "PASSENGER_FLOW"
  | "BOTH_FLOW"
  | "CURRENT_PRICE"
  | "PROBLEMS"
  | "MAIN_PROBLEM"
  | "INTEREST"
  | "CONTACT"
  | "SUCCESS";

export interface StepDefinition {
  id: FormStep;
  title: string;
  badgeText?: string;
  isEligible: (data: CaronaaStsFormData) => boolean;
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: "PROFILE_ROUTE",
    title: "Como você poderia usar a CARONAA?",
    badgeText: "Perfil & Trajeto",
    isEligible: () => true,
  },
  {
    id: "CURRENT_PRICE",
    title: "Como você faz esse trajeto atualmente?",
    badgeText: "Transporte & Custos",
    isEligible: () => true,
  },
  {
    id: "PROBLEMS",
    title: "Quais problemas você enfrenta no trajeto?",
    badgeText: "Dificuldades",
    isEligible: () => true,
  },
  {
    id: "MAIN_PROBLEM",
    title: "Qual problema mais incomoda você?",
    badgeText: "Desafio Principal",
    isEligible: () => true,
  },
  {
    id: "INTEREST",
    title: "Condições e confiança para usar a CARONAA",
    badgeText: "Interesse & Confiança",
    isEligible: () => true,
  },
  {
    id: "CONTACT",
    title: "Como podemos falar com você?",
    badgeText: "Contato & Termos",
    isEligible: () => true,
  },
];

/** Retorna a lista de etapas navegáveis para o preenchimento atual */
export function getActiveSteps(data: CaronaaStsFormData): FormStep[] {
  return STEP_DEFINITIONS.filter((step) => step.isEligible(data)).map((step) => step.id);
}

export function getStepsForIntent(intent?: CaronaaIntent): FormStep[] {
  return getActiveSteps({ intent } as CaronaaStsFormData);
}

export function getNextStep(currentStep: FormStep, data: CaronaaStsFormData): FormStep | null {
  if (currentStep === "INTRO") return "PROFILE_ROUTE";
  if (currentStep === "CONTACT") return "SUCCESS";

  if (currentStep === "PROFILE_ROUTE") {
    return "PROPOSAL_TRANSITION";
  }

  if (currentStep === "PROPOSAL_TRANSITION") {
    if (data.intent === "MOTORISTA") return "DRIVER_FLOW";
    if (data.intent === "PASSAGEIRO") return "PASSENGER_FLOW";
    if (data.intent === "AMBOS") return "BOTH_FLOW";
    return "PASSENGER_FLOW";
  }

  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW" ||
    currentStep === "INTEREST"
  ) {
    return "CONTACT";
  }

  const active = getActiveSteps(data);
  const currentIndex = active.indexOf(currentStep);

  if (currentIndex === -1) {
    return active[0] ?? null;
  }

  const nextStep = active[currentIndex + 1];
  return nextStep ?? "CONTACT";
}

export function getPreviousStep(currentStep: FormStep, data: CaronaaStsFormData): FormStep | null {
  if (currentStep === "INTRO") return null;
  if (currentStep === "SUCCESS") return "CONTACT";

  if (currentStep === "PROFILE_ROUTE") return "INTRO";
  if (currentStep === "PROPOSAL_TRANSITION") return "PROFILE_ROUTE";
  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW"
  ) {
    return "PROPOSAL_TRANSITION";
  }

  if (currentStep === "CONTACT") {
    if (data.intent === "MOTORISTA") return "DRIVER_FLOW";
    if (data.intent === "PASSAGEIRO") return "PASSENGER_FLOW";
    if (data.intent === "AMBOS") return "BOTH_FLOW";
    return "INTEREST";
  }

  const active = getActiveSteps(data);
  const currentIndex = active.indexOf(currentStep);

  if (currentIndex <= 0) {
    return "INTRO";
  }

  return active[currentIndex - 1] ?? "INTRO";
}

export function getStepIndex(currentStep: FormStep, data: CaronaaStsFormData): number {
  if (currentStep === "PROFILE_ROUTE") return 0;
  if (currentStep === "PROPOSAL_TRANSITION") return 1;
  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW"
  ) {
    return 2;
  }
  if (currentStep === "CONTACT") return 3;

  const active = getActiveSteps(data);
  return active.indexOf(currentStep);
}

/** Retorna o número total N de etapas principais ativas (excluindo contato/sucesso do questionário central) */
export function getStepCount(data: CaronaaStsFormData): number {
  const active = getActiveSteps(data);
  // As etapas de questionário antes de CONTACT (excluindo telas de transição pura)
  const questionsOnly = active.filter((s) => s !== "CONTACT" && s !== "PROPOSAL_TRANSITION");
  return questionsOnly.length || 5;
}

export function getProgressPercentage(currentStep: FormStep, data: CaronaaStsFormData): number {
  if (currentStep === "INTRO" || currentStep === "SUCCESS") {
    return 0;
  }
  if (currentStep === "CONTACT" || currentStep === "INTEREST") {
    return 100;
  }

  if (currentStep === "PROFILE_ROUTE") {
    return 25;
  }
  if (currentStep === "PROPOSAL_TRANSITION") {
    return 50;
  }
  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW"
  ) {
    return 75;
  }

  const activeQuestions = getActiveSteps(data).filter(
    (s) => s !== "CONTACT" && s !== "PROPOSAL_TRANSITION",
  );
  const total = activeQuestions.length;
  if (total === 0) return 0;

  const currentIndex = activeQuestions.indexOf(currentStep);
  if (currentIndex === -1) return 0;

  return Math.round(((currentIndex + 1) / total) * 100);
}

export function shouldShowPassengerFlow(intent?: CaronaaIntent): boolean {
  return intent === "PASSAGEIRO" || intent === "AMBOS";
}

export function shouldShowDriverFlow(intent?: CaronaaIntent): boolean {
  return intent === "MOTORISTA" || intent === "AMBOS";
}

export function isCarVehicle(vehicleType?: VehicleType): boolean {
  return vehicleType === "CARRO_PROPRIO" || vehicleType === "CARRO_COMPARTILHADO";
}

export function isMotorcycle(vehicleType?: VehicleType): boolean {
  return vehicleType === "MOTO";
}
