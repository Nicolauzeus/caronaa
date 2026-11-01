import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideResearchDestination, resolvePostOnboardingDestination } from "./research-gate";

const api = vi.hoisted(() => ({
  participations: vi.fn(),
  verifications: vi.fn(),
  launch: vi.fn(),
}));

vi.mock("@/lib/formulario/research-participation", () => ({
  getMyResearchParticipationBadges: api.participations,
}));
vi.mock("@/lib/user-verifications", () => ({
  getMyUserVerifications: api.verifications,
}));
vi.mock("@/lib/research-launch", () => ({
  getMyResearchLaunchState: api.launch,
}));

describe("research gate after basic onboarding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.participations.mockResolvedValue([]);
    api.verifications.mockResolvedValue([]);
    api.launch.mockResolvedValue({ locked: false, launches: [] });
  });

  it("requires the survey for an account without participation or a pilot badge", async () => {
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
    expect(api.participations).toHaveBeenCalledTimes(1);
    expect(api.verifications).toHaveBeenCalledTimes(1);
  });

  it("lets a verified CARONAA pilot use Home", async () => {
    api.verifications.mockResolvedValue([{ type: "CARONAA_TEST", status: "VERIFIED" }]);
    expect(await resolvePostOnboardingDestination()).toBe("/home");
  });

  it("lets an account with linked research participation use Home", async () => {
    api.participations.mockResolvedValue([{ form_id: "survey-1" }]);
    expect(await resolvePostOnboardingDestination()).toBe("/home");
  });

  it("does not treat an unrelated badge as pilot access", async () => {
    api.verifications.mockResolvedValue([{ type: "UNIFOR", status: "VERIFIED" }]);
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
  });

  it("does not treat a revoked pilot badge as access", async () => {
    api.verifications.mockResolvedValue([{ type: "CARONAA_TEST", status: "REVOKED" }]);
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
  });

  it("keeps the prelaunch waiting screen in precedence over Home", async () => {
    api.participations.mockResolvedValue([{ form_id: "survey-1" }]);
    api.verifications.mockResolvedValue([{ type: "CARONAA_TEST", status: "VERIFIED" }]);
    api.launch.mockResolvedValue({ locked: true, launches: [{ formId: "survey-1" }] });
    expect(await resolvePostOnboardingDestination()).toBe("/aguardando");
  });

  it("fails closed instead of allowing Home when research data cannot be read", async () => {
    api.participations.mockRejectedValue(new Error("research unavailable"));
    await expect(resolvePostOnboardingDestination()).rejects.toThrow("research unavailable");
  });

  it("keeps the pure routing rule deterministic", () => {
    expect(decideResearchDestination({ locked: false, hasParticipation: false, isPilot: false })).toBe("/formulario");
    expect(decideResearchDestination({ locked: false, hasParticipation: true, isPilot: false })).toBe("/home");
    expect(decideResearchDestination({ locked: true, hasParticipation: true, isPilot: true })).toBe("/aguardando");
  });
});
