import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideResearchDestination, resolvePostOnboardingDestination } from "./research-gate";

const api = vi.hoisted(() => ({
  launch: vi.fn(),
  onboarding: vi.fn(),
  participations: vi.fn(),
  verifications: vi.fn(),
  professionalAccess: vi.fn(),
}));
vi.mock("@/lib/research-launch", () => ({ getMyResearchLaunchState: api.launch }));
vi.mock("@/lib/onboarding/progressive-onboarding", () => ({ readOnboarding: api.onboarding }));
vi.mock("@/lib/formulario/research-participation", () => ({
  getMyResearchParticipationBadges: api.participations,
}));
vi.mock("@/lib/user-verifications", () => ({
  getMyUserVerifications: api.verifications,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.professionalAccess },
}));

describe("optional research after basic registration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.onboarding.mockResolvedValue({status:"BASIC_COMPLETED",usage_role:"PASSAGEIRO"});
    api.launch.mockResolvedValue({locked:false,launches:[]});
    api.participations.mockRejectedValue(new Error("surveys unavailable"));
    api.verifications.mockRejectedValue(new Error("badges unavailable"));
    api.professionalAccess.mockRejectedValue(new Error("professional service unavailable"));
  });

  it("requires all four onboarding steps before Home", async () => {
    api.onboarding.mockResolvedValue({status:"IN_PROGRESS",usage_role:"PASSAGEIRO"});
    expect(await resolvePostOnboardingDestination()).toBe("/onboarding");
    expect(api.launch).not.toHaveBeenCalled();
  });

  it("allows a new passenger to enter without survey responses or professional approval", async () => {
    expect(await resolvePostOnboardingDestination()).toBe("/home");
    expect(api.participations).not.toHaveBeenCalled();
    expect(api.verifications).not.toHaveBeenCalled();
    expect(api.professionalAccess).not.toHaveBeenCalled();
  });

  it("allows existing BOTH and DRIVER accounts without researching participation", async () => {
    for(const role of ["AMBOS","MOTORISTA"]){
      api.onboarding.mockResolvedValue({status:"BASIC_COMPLETED",usage_role:role});
      expect(await resolvePostOnboardingDestination()).toBe("/home");
    }
  });

  it("does not block mobility access when an old research campaign is locked", async () => {
    api.launch.mockResolvedValue({locked:true,launches:[{formId:"pilot"}]});
    expect(await resolvePostOnboardingDestination()).toBe("/home");
    expect(api.launch).not.toHaveBeenCalled();
  });

  it("keeps account setup separate from commercial driver authorization", async () => {
    expect(decideResearchDestination({
      locked:false,hasParticipation:false,isPilot:false,isApprovedProfessional:false
    })).toBe("/home");
    expect(decideResearchDestination({
      locked:true,hasParticipation:false,isPilot:false
    })).toBe("/aguardando");
  });
});
