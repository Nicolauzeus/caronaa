import type { CaronaaIntent, CaronaaStsFormData, VehicleType } from "./types";

export type FormStep =
  | "INTRO"
  | "INTENT"
  | "ROUTE"
  | "PASSENGER_CONTEXT"
  | "PASSENGER_TRUST"
  | "PASSENGER_PRICE"
  | "PASSENGER_COMMITMENT"
  | "DRIVER_CONTEXT"
  | "DRIVER_TRUST"
  | "DRIVER_PRICE"
  | "DRIVER_COMMITMENT"
  | "CONTACT"
  | "SUCCESS";

const passengerSteps: FormStep[] = [
  "INTRO",
  "INTENT",
  "ROUTE",
  "PASSENGER_CONTEXT",
  "PASSENGER_TRUST",
  "PASSENGER_PRICE",
  "PASSENGER_COMMITMENT",
  "CONTACT",
  "SUCCESS",
];

const driverSteps: FormStep[] = [
  "INTRO",
  "INTENT",
  "ROUTE",
  "DRIVER_CONTEXT",
  "DRIVER_TRUST",
  "DRIVER_PRICE",
  "DRIVER_COMMITMENT",
  "CONTACT",
  "SUCCESS",
];

const bothSteps: FormStep[] = [
  "INTRO",
  "INTENT",
  "ROUTE",
  "DRIVER_CONTEXT",
  "PASSENGER_CONTEXT",
  "DRIVER_TRUST",
  "PASSENGER_TRUST",
  "DRIVER_PRICE",
  "PASSENGER_PRICE",
  "DRIVER_COMMITMENT",
  "PASSENGER_COMMITMENT",
  "CONTACT",
  "SUCCESS",
];

export function getStepsForIntent(intent?: CaronaaIntent): FormStep[] {
  if (intent === "MOTORISTA") {
    return driverSteps;
  }

  if (intent === "PASSAGEIRO") {
    return passengerSteps;
  }

  if (intent === "AMBOS") {
    return bothSteps;
  }

  return ["INTRO", "INTENT"];
}

export function getNextStep(currentStep: FormStep, data: CaronaaStsFormData): FormStep | null {
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
  return getStepsForIntent(data.intent).length;
}

export function getProgressPercentage(currentStep: FormStep, data: CaronaaStsFormData): number {
  const steps = getStepsForIntent(data.intent);

  const currentIndex = steps.indexOf(currentStep);

  if (currentIndex < 0 || steps.length <= 1) {
    return 0;
  }

  return Math.round((currentIndex / (steps.length - 1)) * 100);
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
