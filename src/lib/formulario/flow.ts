import type { CaronaaIntent, CaronaaStsFormData, VehicleType } from "./types";

export type FormStep =
  | "INTRO"
  | "ROLE_SELECTION"
  | "ROUTE_DETAILS"
  | "EVENT_PRESENCE"
  | "PROPOSAL_TRANSITION"
  | "DRIVER_FLOW"
  | "PASSENGER_FLOW"
  | "BOTH_FLOW"
  | "CURRENT_PRICE"
  | "PROBLEMS"
  | "MAIN_PROBLEM"
  | "INTEREST"
  | "CONTACT"
  | "SUCCESS"
  // Legado para compatibilidade retroativa
  | "PROFILE_ROUTE";

export interface StepDefinition {
  id: FormStep;
  title: string;
  badgeText?: string;
  isEligible: (data: CaronaaStsFormData) => boolean;
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: "ROLE_SELECTION",
    title: "Como você poderia usar a CARONAA?",
    badgeText: "Seu Papel",
    isEligible: () => true,
  },
  {
    id: "ROUTE_DETAILS",
    title: "Vamos entender seu caminho",
    badgeText: "Trajeto & Horário",
    isEligible: () => true,
  },
  {
    id: "EVENT_PRESENCE",
    title: "Quando você estará por aqui?",
    badgeText: "Dias no STS",
    isEligible: () => true,
  },
  {
    id: "PROPOSAL_TRANSITION",
    title: "Como funciona a CARONAA",
    badgeText: "Proposta",
    isEligible: () => true,
  },
  {
    id: "DRIVER_FLOW",
    title: "Preferências para oferecer carona",
    badgeText: "Motorista",
    isEligible: (data) => data.intent === "MOTORISTA",
  },
  {
    id: "PASSENGER_FLOW",
    title: "Preferências para pegar carona",
    badgeText: "Passageiro",
    isEligible: (data) => data.intent === "PASSAGEIRO",
  },
  {
    id: "BOTH_FLOW",
    title: "Preferências para oferecer e pegar carona",
    badgeText: "Motorista & Passageiro",
    isEligible: (data) => data.intent === "AMBOS",
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
  if (currentStep === "INTRO") return "ROLE_SELECTION";
  if (currentStep === "CONTACT") return "SUCCESS";

  if (currentStep === "ROLE_SELECTION") {
    return "ROUTE_DETAILS";
  }

  if (currentStep === "ROUTE_DETAILS") {
    return "EVENT_PRESENCE";
  }

  if (currentStep === "EVENT_PRESENCE") {
    return "PROPOSAL_TRANSITION";
  }

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

  if (currentStep === "ROLE_SELECTION") return "INTRO";
  if (currentStep === "PROFILE_ROUTE") return "INTRO";
  if (currentStep === "ROUTE_DETAILS") return "ROLE_SELECTION";
  if (currentStep === "EVENT_PRESENCE") return "ROUTE_DETAILS";
  if (currentStep === "PROPOSAL_TRANSITION") return "EVENT_PRESENCE";

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
    return "PASSENGER_FLOW";
  }

  const active = getActiveSteps(data);
  const currentIndex = active.indexOf(currentStep);

  if (currentIndex <= 0) {
    return "INTRO";
  }

  return active[currentIndex - 1] ?? "INTRO";
}

export function getStepIndex(currentStep: FormStep, data: CaronaaStsFormData): number {
  if (currentStep === "ROLE_SELECTION" || currentStep === "PROFILE_ROUTE") return 1;
  if (currentStep === "ROUTE_DETAILS") return 2;
  if (currentStep === "EVENT_PRESENCE") return 3;
  if (currentStep === "PROPOSAL_TRANSITION") return 4;
  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW"
  ) {
    return 5;
  }
  if (currentStep === "CONTACT") return 6;

  const active = getActiveSteps(data);
  const idx = active.indexOf(currentStep);
  return idx >= 0 ? idx + 1 : 1;
}

/** Retorna o número total N de etapas principais ativas do questionário */
export function getStepCount(data?: CaronaaStsFormData): number {
  return 5;
}

export function getProgressPercentage(currentStep: FormStep, data: CaronaaStsFormData): number {
  if (currentStep === "INTRO" || currentStep === "SUCCESS") {
    return 0;
  }
  if (currentStep === "ROLE_SELECTION" || currentStep === "PROFILE_ROUTE") {
    return 17;
  }
  if (currentStep === "ROUTE_DETAILS") {
    return 33;
  }
  if (currentStep === "EVENT_PRESENCE") {
    return 50;
  }
  if (currentStep === "PROPOSAL_TRANSITION") {
    return 67;
  }
  if (
    currentStep === "DRIVER_FLOW" ||
    currentStep === "PASSENGER_FLOW" ||
    currentStep === "BOTH_FLOW"
  ) {
    return 83;
  }
  if (currentStep === "CONTACT" || currentStep === "INTEREST") {
    return 100;
  }

  return 50;
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
