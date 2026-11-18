/** A GPS accuracy radius is an uncertainty estimate, not a verified address. */
export const GPS_POLICY = {
  trustedPassengerAccuracyM: 80,
  passengerPreviewAccuracyM: 300,
  driverMaxAccuracyM: 150,
  driverArrivalAccuracyM: 50,
  driverSampleMaxAgeMs: 30_000,
  driverFutureClockToleranceMs: 5_000,
  driverDiscoveryTtlMs: 90_000,
  driverCivicCacheTtlMs: 180_000,
  driverCivicCacheRadiusM: 300,
} as const;

export function isFreshGpsTimestamp(
  timestamp: number | undefined,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  if (timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) return false;
  const age = now - timestamp;
  return age >= -GPS_POLICY.driverFutureClockToleranceMs && age <= maxAgeMs;
}
