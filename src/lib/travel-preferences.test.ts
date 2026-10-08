import { describe, expect, it } from "vitest";
import { emptyTravelPreferences as defaults, preferencesCompatible, preferenceBonus, travelPreferencesSchema } from "./travel-preferences";

describe("consented travel preferences", () => {
  it("does not block unspecified preferences", () => expect(preferencesCompatible(defaults, defaults)).toBe(true));
  it("rejects smoking conflict and unknown smoking availability", () => {
    expect(preferencesCompatible({ ...defaults, smoking: "no" }, { ...defaults, smoking: "yes" })).toBe(false);
    expect(preferencesCompatible({ ...defaults, smoking: "no" }, defaults)).toBe(false);
  });
  it("requires explicit acceptance for a pet", () => {
    expect(preferencesCompatible({ ...defaults, pets: "yes" }, defaults)).toBe(false);
    expect(preferencesCompatible({ ...defaults, pets: "yes" }, { ...defaults, pets: "yes" })).toBe(true);
  });
  it("rejects insufficient luggage space", () => expect(preferencesCompatible({ ...defaults, luggage: 2 }, { ...defaults, luggage: 1 })).toBe(false));
  it("conversation and music only add a ranking bonus", () => {
    const quiet = { ...defaults, conversation: "quiet" as const, music: "off" as const };
    expect(preferencesCompatible(quiet, { ...defaults, conversation: "chat" })).toBe(true);
    expect(preferenceBonus(quiet, quiet)).toBe(6);
    expect(preferenceBonus(defaults, defaults)).toBe(0);
  });
  it("rejects invalid and unknown fields", () => {
    expect(travelPreferencesSchema.safeParse({ luggage: 7 }).success).toBe(false);
    expect(travelPreferencesSchema.safeParse({ family: true }).success).toBe(false);
  });
});