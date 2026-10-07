export const rideStatuses = [
  "MATCHED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type RideStatus = (typeof rideStatuses)[number];

const allowedTransitions: Partial<Record<RideStatus, readonly RideStatus[]>> = {
  MATCHED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  if (from === "CONFIRMED" && to === "CONFIRMED") return true;
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function transitionRide(
  from: RideStatus,
  to: RideStatus,
  context: { hasPersistedMatch: boolean; isParticipant: boolean; confirmedByBoth?: boolean },
): RideStatus {
  if (!context.hasPersistedMatch) throw new Error("A ride requires a persisted match");
  if (!context.isParticipant) throw new Error("Only ride participants may transition the ride");
  if (from === "CONFIRMED" && to === "CONFIRMED") return "CONFIRMED";
  if (to === "COMPLETED") {
    if (from === "IN_PROGRESS" && context.confirmedByBoth) return "COMPLETED";
    throw new Error(`Invalid ride transition: ${from} -> ${to}`);
  }
  if (!canTransitionRide(from, to)) throw new Error(`Invalid ride transition: ${from} -> ${to}`);
  return to;
}
