import type { CaronaaIntent, CaronaaStsFormData, VehicleType } from "./types";

export type FormStep =
  | "INTRO"
  | "PROFILE_ROUTE"
  | "CURRENT_PRICE"
  | "PROBLEMS"
  | "MAIN_PROBLEM"
  | "INTEREST"
  | "CONTACT"
  | "SUCCESS";

const mainSteps: FormStep[] = [
  "PROFILE_ROUTE",
  "CURRENT_PRICE",
  "PROBLEMS",
  "MAIN_PROBLEM",
  "INTEREST",
  "CONTACT",
];

export function getStepsForIntent(intent?: CaronaaIntent): FormStep[] {
  return intent ? mainSteps : ["INTRO", "PROFILE_ROUTE"];
}

export function getNextStep(currentStep: FormStep, data: CaronaaStsFormData): FormStep | null {
  if (currentStep === "INTRO") return "PROFILE_ROUTE";
  if (currentStep === "INTEREST") return "CONTACT";
  if (currentStep === "CONTACT") return "SUCCESS";
  const steps = getStepsForIntent(data.intent);

  const currentIndex = steps.indexOf(currentStep);

  if (currentIndex === -1) {
    return null;
  }

  const nextStep = steps[currentIndex + 1];

  if (!nextStep) {
    return null;
  }

  return nextStep;
}

export function getPreviousStep(currentStep: FormStep, data: CaronaaStsFormData): FormStep | null {
  if (currentStep === "CONTACT") return "INTEREST";
  if (currentStep === "SUCCESS") return "CONTACT";
  const steps = getStepsForIntent(data.intent);

  const currentIndex = steps.indexOf(currentStep);

  if (currentIndex <= 0) {
    return null;
  }

  return steps[currentIndex - 1] ?? null;
}

export function getStepIndex(currentStep: FormStep, data: CaronaaStsFormData): number {
  const steps = getStepsForIntent(data.intent);

  return steps.indexOf(currentStep);
}

export function getStepCount(data: CaronaaStsFormData): number {
  return 5;
}

export function getProgressPercentage(currentStep: FormStep, data: CaronaaStsFormData): number {
  if (currentStep === "INTRO" || currentStep === "SUCCESS") {
    return 0;
  }
  if (currentStep === "CONTACT") return 100;

  const mainStepIndex = [
    "PROFILE_ROUTE",
    "CURRENT_PRICE",
    "PROBLEMS",
    "MAIN_PROBLEM",
    "INTEREST",
  ].indexOf(currentStep);

  return mainStepIndex >= 0 ? (mainStepIndex + 1) * 20 : 0;
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
