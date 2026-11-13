import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideResearchDestination, resolvePostOnboardingDestination } from "./research-gate";

const api = vi.hoisted(() => ({
  participations: vi.fn(),
  verifications: vi.fn(),
  launch: vi.fn(),
  onboarding: vi.fn(),
  professionalAccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.professionalAccess },
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
vi.mock("@/lib/onboarding/progressive-onboarding", () => ({
  readOnboarding: api.onboarding,
}));

describe("research gate after basic onboarding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.onboarding.mockResolvedValue({ status: "BASIC_COMPLETED", usage_role: "PASSAGEIRO" });
    api.participations.mockResolvedValue([]);
    api.verifications.mockResolvedValue([]);
    api.launch.mockResolvedValue({ locked: false, launches: [] });
    api.professionalAccess.mockResolvedValue({ data: { authorized: false }, error: null });
  });

  it("requires the survey for an account without participation or a pilot badge", async () => {
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
    expect(api.participations).toHaveBeenCalledTimes(1);
    expect(api.verifications).toHaveBeenCalledTimes(1);
  });

  it("lets DRIVER-ONLY accounts use Home without filling out or even loading surveys", async () => {
    api.onboarding.mockResolvedValue({ status: "BASIC_COMPLETED", usage_role: "MOTORISTA" });
    api.participations.mockRejectedValue(new Error("Research endpoint unavailable"));
    api.verifications.mockRejectedValue(new Error("Badges unavailable"));
    expect(await resolvePostOnboardingDestination()).toBe("/home");
    expect(api.participations).not.toHaveBeenCalled();
    expect(api.verifications).not.toHaveBeenCalled();
    expect(api.professionalAccess).not.toHaveBeenCalled();
    expect(api.launch).toHaveBeenCalledTimes(1);
  });

  it("never lets incomplete onboarding bypass research by declaring a driver role", async () => {
    api.onboarding.mockResolvedValue({ status: "IN_PROGRESS", usage_role: "MOTORISTA" });
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
    expect(api.participations).toHaveBeenCalledTimes(1);
  });

  it("retains the passenger survey gate for AMBOS rather than treating it as driver-only", async () => {
    api.onboarding.mockResolvedValue({ status: "BASIC_COMPLETED", usage_role: "AMBOS" });
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
    expect(api.participations).toHaveBeenCalledTimes(1);
  });

  it("exempts previously approved professional drivers even if onboarding was PASSAGEIRO", async () => {
    api.professionalAccess.mockResolvedValue({ data: { authorized: true }, error: null });
    expect(await resolvePostOnboardingDestination()).toBe("/home");
    expect(api.professionalAccess).toHaveBeenCalledWith("get_my_professional_access");
  });

  it("directs pending or correction-requested professional applicants to approval status", async () => {
    for (const status of ["PENDING", "CHANGES_REQUESTED", "REJECTED"]) {
      api.professionalAccess.mockResolvedValue({ data: {
        authorized: false, request: { status, access_type: "MOTOTAXI_SIMPLE" },
      }, error: null });
      expect(await resolvePostOnboardingDestination()).toBe("/disponibilidade-profissional");
    }
    expect(api.professionalAccess).toHaveBeenCalledTimes(3);
  });

  it("does not mistake arbitrary request statuses for approval or a driver application", async () => {
    api.professionalAccess.mockResolvedValue({
      data: { authorized: false, request: { status: "UNKNOWN" } }, error: null,
    });
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
  });

  it("fails closed to the form when the professional authorization RPC is unavailable", async () => {
    api.professionalAccess.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(await resolvePostOnboardingDestination()).toBe("/formulario");
  });

  it("keeps the institutional launch waiting gate for drivers already enrolled in a campaign", async () => {
    api.onboarding.mockResolvedValue({ status: "BASIC_COMPLETED", usage_role: "MOTORISTA" });
    api.launch.mockResolvedValue({ locked: true, launches: [{formId:"campaign"}] });
    expect(await resolvePostOnboardingDestination()).toBe("/aguardando");
    expect(api.participations).not.toHaveBeenCalled();
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

  it("fails closed instead of allowing Home when passenger research data cannot be read", async () => {
    api.participations.mockRejectedValue(new Error("research unavailable"));
    await expect(resolvePostOnboardingDestination()).rejects.toThrow("research unavailable");
  });

  it("keeps the pure routing rule deterministic", () => {
    expect(decideResearchDestination({ locked: false, hasParticipation: false, isPilot: false })).toBe("/formulario");
    expect(decideResearchDestination({ locked: false, hasParticipation: true, isPilot: false })).toBe("/home");
    expect(decideResearchDestination({ locked: true, hasParticipation: true, isPilot: true })).toBe("/aguardando");
    expect(decideResearchDestination({ locked: false, hasParticipation: false, isPilot: false, isDriverOnly: true })).toBe("/home");
    expect(decideResearchDestination({ locked: false, hasParticipation: false, isPilot: false, isApprovedProfessional: true })).toBe("/home");
    expect(decideResearchDestination({ locked: false, hasParticipation: false, isPilot: false, hasProfessionalRequest: true })).toBe("/disponibilidade-profissional");
    expect(decideResearchDestination({ locked: true, hasParticipation: false, isPilot: false, isDriverOnly: true })).toBe("/aguardando");
  });
});
