/** One-time, local UX prompt; never a source of truth for payment or rating. */
export type CompletedQuickRideRef = {
  id: string;
  requested_at?: string | null;
};

/** Recover if navigation/reload interrupted completion, without reopening very old trips. */
export function shouldPresentQuickPostTrip(
  ride: CompletedQuickRideRef | null | undefined,
  lastActiveRideId: string | null,
  alreadySeen: boolean,
  now = Date.now(),
): boolean {
  if (!ride?.id || alreadySeen) return false;
  if (lastActiveRideId === ride.id) return true;
  if (typeof ride.requested_at !== "string") return false;
  const requestedAt = Date.parse(ride.requested_at);
  const age = now - requestedAt;
  // A recent completion on another device should still surface the payment.
  return Number.isFinite(age) && age >= 0 && age <= 3 * 60 * 60 * 1000;
}

export function quickPostTripSeenKey(role: "PASSENGER" | "DRIVER", rideId: string): string {
  return `caronaa-f07-post-trip-seen:${role}:${rideId}`;
}

export function quickPostTripActiveKey(role: "PASSENGER" | "DRIVER"): string {
  return `caronaa-f07-last-active:${role}`;
}
