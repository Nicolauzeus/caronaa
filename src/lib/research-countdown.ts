export type ResearchCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
};

/**
 * Calculate a live countdown from the campaign's authoritative ISO timestamp.
 * It is intentionally timezone-independent: launchAt already contains the
 * UTC instant selected by the institutional launch configuration.
 */
export function getResearchCountdown(
  launchAt: string | undefined,
  now: number,
): ResearchCountdown | null {
  const target = launchAt ? Date.parse(launchAt) : Number.NaN;
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;

  // Ceil prevents showing zero a fraction of a second before the scheduled time.
  const totalSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}
