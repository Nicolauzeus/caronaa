import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: ((input: unknown) => unknown) | undefined;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (input: unknown) => unknown) => { validate = fn; return builder; },
      handler: (fn: (input: { data: unknown; context: unknown }) => unknown) =>
        async (input?: { data: unknown }) => fn({
          data: validate ? validate(input?.data) : input?.data,
          context: { userId: "authenticated-fixture", supabase: {} },
        }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { activateF07PilotDriver, f07TestEnvironmentConfigured, getF07PilotState } from "@/lib/quick-rides/f07-pilot.functions";
import { clearF07TestLocation, getF07TestSelfRadar, simulateF07TestLocation } from "@/lib/quick-rides/f07-radar-diagnostic.functions";

afterEach(() => vi.unstubAllEnvs());

describe("public F07 cannot revive retired shortcuts", () => {
  it("ignores both old enable flags", async () => {
    vi.stubEnv("CARONAA_DEPLOY_ENV", "homologacao");
    vi.stubEnv("CARONAA_F07_TEST_MODE", "enabled");
    expect(f07TestEnvironmentConfigured()).toBe(false);
    expect(await getF07PilotState()).toEqual({ enabled: false });
  });
  it.each(["CAR", "MOTO"] as const)("cannot grant temporary %s access", async vehicleType => {
    await expect(activateF07PilotDriver({ data: { vehicleType } })).rejects.toBeInstanceOf(Error);
  });
  it("never creates a simulated GPS fix", async () => {
    await expect(simulateF07TestLocation({ data: { municipality: "Redenção", vehicleType: "MOTO" } })).rejects.toBeInstanceOf(Error);
  });
  it("returns no diagnostic markers", async () => {
    expect(await getF07TestSelfRadar({ data: { municipality: "Redenção", vehicleType: "CAR" } })).toEqual([]);
  });
  it("does not erase archived positions through a legacy cleanup call", async () => {
    expect(await clearF07TestLocation()).toEqual({ ok: false });
  });
});