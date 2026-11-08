import type { FormLocationDetails } from "@/lib/location/types";
import type { TimeToleranceMinutes } from "@/components/caronaa/TimeToleranceSelector";

/**
 * One-time, tab-scoped handoff when a member switches between requesting
 * and offering a carona. No GPS coordinates in URLs, logs or query params.
 * Removed immediately on consumption, on sign-out or after two minutes.
 */
export type RideIntentDraft = {
  origin: string;
  destination: string;
  originLocation?: FormLocationDetails;
  destinationLocation?: FormLocationDetails;
  date?: string;
  time?: string;
  tolerance?: TimeToleranceMinutes;
  passengerMode?: "CAR" | "MOTO" | "EXCLUSIVE";
  offerVehicle?: "CAR" | "MOTO";
};
const KEY = "caronaa:role-switch-draft:v1";
const MAX_AGE_MS = 2 * 60_000;
const validLocation = (point: unknown): FormLocationDetails | undefined => {
  if (!point || typeof point !== "object") return undefined;
  const p = point as Record<string, unknown>;
  if (typeof p.lat !== "number" || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 ||
    typeof p.lng !== "number" || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180) return undefined;
  const label = typeof p.formattedAddress === "string" && p.formattedAddress.trim()
    ? p.formattedAddress.slice(0, 180)
    : typeof p.rawText === "string" ? p.rawText.slice(0, 180) : "";
  if (!label.trim()) return undefined;
  return { rawText: label, formattedAddress: label, lat: p.lat, lng: p.lng };
};
const shortText = (text: unknown, limit: number) =>
  typeof text === "string" ? text.trim().slice(0, limit) : "";
const safeDraft = (value: RideIntentDraft): RideIntentDraft => ({
  origin: shortText(value.origin, 180),
  destination: shortText(value.destination, 180),
  originLocation: validLocation(value.originLocation),
  destinationLocation: validLocation(value.destinationLocation),
  date: /^\d{4}-\d{2}-\d{2}$/.test(value.date ?? "") ? value.date : undefined,
  time: /^\d{2}:\d{2}$/.test(value.time ?? "") ? value.time : undefined,
  tolerance: [5, 15, 30, 60].includes(value.tolerance ?? 0) ? value.tolerance : undefined,
  passengerMode: ["CAR", "MOTO", "EXCLUSIVE"].includes(value.passengerMode ?? "")
    ? value.passengerMode : undefined,
  offerVehicle: value.offerVehicle === "MOTO" ? "MOTO" : "CAR",
});

export function saveRideIntentDraft(value: RideIntentDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({
      expiresAt: Date.now() + MAX_AGE_MS,
      value: safeDraft(value),
    }));
  } catch { /* Private browsing/storage blocked; navigation still works. */ }
}
export function consumeRideIntentDraft(): RideIntentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: number; value?: RideIntentDraft };
    if (!Number.isFinite(parsed.expiresAt) || Number(parsed.expiresAt) < Date.now() ||
      !parsed.value || typeof parsed.value !== "object") return null;
    return safeDraft(parsed.value);
  } catch { return null; }
}
export function clearRideIntentDraft(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
