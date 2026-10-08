import { z } from "zod";

export const travelPreferencesSchema = z.object({
  conversation: z.enum(["any", "quiet", "chat"]).default("any"),
  music: z.enum(["any", "off", "on"]).default("any"),
  smoking: z.enum(["any", "no", "yes"]).default("any"),
  pets: z.enum(["any", "no", "yes"]).default("any"),
  luggage: z.number().int().min(0).max(6).default(0),
}).strict();
export type TravelPreferences = z.infer<typeof travelPreferencesSchema>;
export const emptyTravelPreferences = travelPreferencesSchema.parse({});
export function preferencesCompatible(request: TravelPreferences, offer: TravelPreferences) {
  return (request.smoking === "any" || request.smoking === offer.smoking)
    && (request.pets !== "yes" || offer.pets === "yes")
    && (request.pets !== "no" || offer.pets !== "yes")
    && request.luggage <= offer.luggage;
}
export function preferenceBonus(request: TravelPreferences, offer: TravelPreferences) {
  return (["conversation", "music"] as const).reduce((score, key) =>
    score + (request[key] !== "any" && request[key] === offer[key] ? 3 : 0), 0);
}