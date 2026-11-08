export const STRICT_MEETING_TOLERANCE_MINUTES = 8;

export function calculateRemainingWaitTime(arrivedAtIso: string, now: Date = new Date()) {
  const arrival = Date.parse(arrivedAtIso);
  const current = now.getTime();
  if (!Number.isFinite(arrival) || !Number.isFinite(current) || arrival > current) {
    throw new Error("Horário de chegada inválido.");
  }
  const remainingSeconds = Math.max(
    0,
    Math.ceil((arrival + STRICT_MEETING_TOLERANCE_MINUTES * 60_000 - current) / 1000),
  );
  return {
    minutes: Math.floor(remainingSeconds / 60),
    seconds: remainingSeconds % 60,
    isExpired: remainingSeconds === 0,
  };
}
