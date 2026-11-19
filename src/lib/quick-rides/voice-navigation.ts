import type { NavigationPhase, NavigationPoint } from "./driver-navigation";

export type VoiceManeuver = {
  start: NavigationPoint;
  instruction: string;
  distanceMeters: number;
};

/** Three announcements max per turn; the GPS pulse itself never triggers an API request. */
export function navigationVoiceStage(distanceMeters: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 0;
  if (distanceMeters <= 45) return 3;
  if (distanceMeters <= 180) return 2;
  if (distanceMeters <= 600) return 1;
  return 0;
}

export function navigationVoiceKey(
  rideId: string,
  phase: NavigationPhase,
  maneuver: VoiceManeuver,
): string {
  return [rideId, phase, maneuver.start.lat.toFixed(5),
    maneuver.start.lng.toFixed(5), maneuver.instruction.trim()].join(":");
}

export function navigationVoiceMessage(maneuver: VoiceManeuver, stage: 1 | 2 | 3): string {
  const instruction = maneuver.instruction
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
  const action = instruction.charAt(0).toLocaleLowerCase("pt-BR") + instruction.slice(1);
  if (stage === 3) return `Agora, ${action}.`;
  const meters = stage === 1
    ? Math.max(200, Math.round(maneuver.distanceMeters / 50) * 50)
    : Math.max(50, Math.round(maneuver.distanceMeters / 10) * 10);
  return `Em ${meters} metros, ${action}.`;
}
