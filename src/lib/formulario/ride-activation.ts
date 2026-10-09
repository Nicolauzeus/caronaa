import { z } from "zod";

export const publicationDetailsSchema = z.object({
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
  rideDate: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  count: z.number().int().min(1).max(6),
  audience: z.enum(["ANY", "FEMININO", "MASCULINO"]).optional(),
  originLat: z.number().finite().min(-90).max(90).optional(),
  originLng: z.number().finite().min(-180).max(180).optional(),
  destinationLat: z.number().finite().min(-90).max(90).optional(),
  destinationLng: z.number().finite().min(-180).max(180).optional(),
});
export type PublicationDetails = z.infer<typeof publicationDetailsSchema>;
export type StsRideSeed = {
  submissionId: string;
  intent: string;
  origin: string | null;
  destination: string;
  createdAt: string;
  raw: Record<string, unknown>;
};
export type StsRideDraft = {
  submissionId: string;
  kind: "request" | "offer";
  details: Partial<PublicationDetails>;
  missing: string[];
  classification: "sufficient" | "partial" | "insufficient" | "expired";
  departureWindow?: string;
};

function eventDate(seed: StsRideSeed): string | undefined {
  if (typeof seed.raw.rideDate === "string") return seed.raw.rideDate;
  const days = seed.raw.eventPresenceDays;
  if (!Array.isArray(days) || days.length !== 1) return;
  const dates: Record<string, string> = {
    DIA_07: "2026-10-07",
    DIA_08: "2026-10-08",
    DIA_09: "2026-10-09",
  };
  if (days[0] === "HOJE") {
    const date = new Date(seed.createdAt);
    if (!Number.isFinite(date.getTime())) return;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
  return dates[String(days[0])];
}

export function prepareStsRideDraft(
  seed: StsRideSeed,
  kind: "request" | "offer",
  now = new Date(),
): StsRideDraft {
  const raw = seed.raw;
  const count = kind === "request" ? raw.passengerCount : raw.availableSeats;
  const details: Partial<PublicationDetails> = {
    origin: seed.origin?.trim() || undefined,
    destination: seed.destination?.trim() || undefined,
    rideDate: eventDate(seed),
    departureTime: typeof raw.departureTime === "string" ? raw.departureTime : undefined,
    count: typeof count === "number" ? count : undefined,
    audience:
      kind === "offer" && ["ANY", "FEMININO", "MASCULINO"].includes(String(raw.audience))
        ? (raw.audience as PublicationDetails["audience"])
        : undefined,
  };
  for (const prefix of ["origin", "destination"] as const) {
    const location = raw[`${prefix}Location`];
    if (
      location &&
      typeof location === "object" &&
      "lat" in location &&
      "lng" in location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number" &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      Math.abs(location.lat) <= 90 &&
      Math.abs(location.lng) <= 180
    ) {
      details[`${prefix}Lat`] = location.lat;
      details[`${prefix}Lng`] = location.lng;
    }
  }
  const parsed = publicationDetailsSchema.safeParse(details);
  const missing = parsed.success
    ? []
    : [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  if (kind === "offer" && !details.audience) missing.push("audience");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const expired =
    now >= new Date("2026-10-09T22:00:00-03:00") ||
    (details.rideDate && (details.rideDate < "2026-10-07" || details.rideDate > "2026-10-09")) ||
    (details.rideDate && details.rideDate < today) ||
    (parsed.success && (
      new Date(`${parsed.data.rideDate}T${parsed.data.departureTime}:00-03:00`) <= now ||
      new Date(`${parsed.data.rideDate}T${parsed.data.departureTime}:00-03:00`) > new Date("2026-10-09T22:00:00-03:00")
    ));
  return {
    submissionId: seed.submissionId,
    kind,
    details,
    missing,
    classification: expired
      ? "expired"
      : !missing.length
        ? "sufficient"
        : details.origin && details.destination
          ? "partial"
          : "insufficient",
    departureWindow: typeof raw.departureWindow === "string" ? raw.departureWindow : undefined,
  };
}
