/**
 * The CARONAA service operates on Fortaleza wall-clock dates. Never derive
 * ride dates from toISOString(), which can shift a local departure by a day.
 */
export const OFFER_TIME_ZONE = "America/Fortaleza";

export function departureAfterMinutes(minutes: number, now: Date = new Date()) {
  const departure = new Date(now.getTime() + minutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OFFER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(departure);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

export function isFutureOfferDeparture(
  date: string,
  time: string,
  now: Date = new Date(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return false;
  }
  const departure = Date.parse(`${date}T${time}:00-03:00`);
  return Number.isFinite(departure) && departure > now.getTime();
}
