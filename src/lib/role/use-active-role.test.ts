import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveRole } from "./use-active-role";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

function mockProfile(profile: Record<string, unknown> | null, eligible = false) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-test" } }, error: null });
  mocks.from.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
      })),
    })),
  });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "get_my_professional_access") {
      return { data: { authorized: eligible }, error: null };
    }
    return { data: "MOTORISTA", error: null };
  });
}

describe("useActiveRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts as PASSAGEIRO and requests vehicle details from the own profile", async () => {
    mockProfile({
      vehicle_brand: "Honda",
      vehicle_description: "CG 160",
      vehicle_plate: "ABC1D23",
    });
    const { result } = renderHook(() => useActiveRole());

    expect(result.current.activeRole).toBe("PASSAGEIRO");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(result.current.vehicleStatus).toEqual({
      hasBrand: true,
      hasModel: true,
      hasColor: false,
      hasPlate: true,
      isComplete: false,
    });
  });

  it("returns missing vehicle fields and does not call role RPC when driver is incomplete and ineligible", async () => {
    mockProfile({ vehicle_brand: "Honda", vehicle_description: "", vehicle_plate: null }, false);
    const { result } = renderHook(() => useActiveRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: Awaited<ReturnType<typeof result.current.switchRole>> | undefined;
    await act(async () => {
      outcome = await result.current.switchRole("MOTORISTA");
    });

    expect(outcome).toEqual({
      needsVehicleModal: true,
      missingFields: ["model", "color", "plate"],
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("switch_user_active_role", expect.anything());
    expect(result.current.activeRole).toBe("PASSAGEIRO");
  });

  it("allows MOTORISTA when the vehicle is complete", async () => {
    mockProfile({
      vehicle_brand: "Honda",
      vehicle_description: "CG 160 vermelha",
      vehicle_color: "Vermelha",
      vehicle_plate: "ABC1D23",
    }, false);
    const { result } = renderHook(() => useActiveRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchRole("MOTORISTA");
    });

    expect(mocks.rpc).toHaveBeenCalledWith("switch_user_active_role", {
      p_target_role: "MOTORISTA",
    });
    expect(result.current.activeRole).toBe("MOTORISTA");
  });

  it("allows an eligible driver even if vehicle profile fields are incomplete", async () => {
    mockProfile({ vehicle_brand: null, vehicle_description: null, vehicle_plate: null }, true);
    const { result } = renderHook(() => useActiveRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchRole("MOTORISTA");
    });

    expect(result.current.isDriverEligible).toBe(true);
    expect(result.current.activeRole).toBe("MOTORISTA");
  });

  it("switches to PASSAGEIRO immediately and persists the role", async () => {
    mockProfile(null);
    const { result } = renderHook(() => useActiveRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchRole("PASSAGEIRO");
    });

    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(mocks.rpc).toHaveBeenCalledWith("switch_user_active_role", {
      p_target_role: "PASSAGEIRO",
    });
  });
});
