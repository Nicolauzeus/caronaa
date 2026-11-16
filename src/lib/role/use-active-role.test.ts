import type { ActiveRole, VehicleDraft } from "./use-active-role";

// Bun does not load the Vitest configuration or its DOM setup. Keep this suite
// runnable with both bun test and the project's usual Vitest test command.
const runtime = globalThis as typeof globalThis & {
  process?: { versions?: { bun?: string }; env?: { VITEST?: string } };
};
const isBun = Boolean(runtime.process?.versions?.bun) && !runtime.process?.env?.VITEST;
const runnerName = isBun ? "bun:test" : "vitest";
const runner = await import(/* @vite-ignore */ runnerName);
const { afterAll, afterEach, beforeEach, describe, expect, it } = runner;
const fn = isBun ? runner.mock : runner.vi.fn;
let restoreDom = () => {};
if (isBun) {
  const domModule: string = "jsdom";
  const { JSDOM } = await import(/* @vite-ignore */ domModule);
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  restoreDom = () => {
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
}

type Profile = Record<string, unknown>;
const api = {
  getUser: fn(), from: fn(), rpc: fn(), update: fn(), readEq: fn(), writeEq: fn(),
  read: fn(), persist: fn(), readiness: fn(), roleSwitch: fn(), profile: null as Profile | null,
};
const clientMock = () => ({ supabase: { auth: { getUser: api.getUser }, from: api.from, rpc: api.rpc } });
if (isBun) runner.mock.module("@/integrations/supabase/client", clientMock);
else runner.vi.doMock("@/integrations/supabase/client", clientMock);

const { act, cleanup, renderHook, waitFor } = await import("@testing-library/react/pure");
const { getMissingVehicleFields, getVehicleStatus, normalizeVehicleSeats, useActiveRole } = await import("./use-active-role");

const fullProfile = {
  active_role: "PASSAGEIRO", vehicle_brand: "Honda", vehicle_description: "CG 160",
  vehicle_color: "Vermelha", vehicle_plate: "ABC1D23", vehicle_type: "moto", vehicle_seats: 1,
};
const draft: VehicleDraft = {
  brand: " Honda ", model: " CG 160 ", color: " Preta ", plate: "abc-1d23",
  vehicleType: "moto", vehicleSeats: 1,
};

function setup(profile: Profile | null = { ...fullProfile }) {
  for (const value of Object.values(api)) {
    if (typeof value === "function" && "mockReset" in value) value.mockReset();
  }
  api.profile = profile;
  api.getUser.mockResolvedValue({ data: { user: { id: "authenticated-user" } }, error: null });
  api.read.mockImplementation(async () => ({ data: api.profile, error: null }));
  api.persist.mockImplementation(async (values: Profile) => {
    api.profile = { ...api.profile, ...values };
    return { data: api.profile, error: null };
  });
  api.from.mockImplementation((table: string) => {
    if (table !== "profiles") throw new Error("unexpected table: " + table);
    return {
      select: () => ({ eq: (column: string, value: unknown) => {
        api.readEq(column, value);
        return { maybeSingle: api.read };
      } }),
      update: api.update,
    };
  });
  api.update.mockImplementation((values: Profile) => ({
    eq: (column: string, value: unknown) => {
      api.writeEq(column, value);
      return { select: () => ({ single: () => api.persist(values) }) };
    },
  }));
  api.readiness.mockResolvedValue({ data: false, error: null });
  api.roleSwitch.mockImplementation(async (args: { target_role: ActiveRole; p_target_role: ActiveRole }) => {
    api.profile = { ...api.profile, active_role: args.target_role };
    return { data: args.target_role, error: null };
  });
  api.rpc.mockImplementation((name: string, args?: Profile) => {
    if (name === "is_driver_ready") return api.readiness(args);
    if (name === "switch_user_active_role") return api.roleSwitch(args);
    throw new Error("unexpected RPC: " + name);
  });
}

function readinessFailure(mode: "false" | "error" | "rejection") {
  if (mode === "error") api.readiness.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  else if (mode === "rejection") api.readiness.mockRejectedValue(new Error("readiness unavailable"));
}

async function loadedHook() {
  const hook = renderHook(() => useActiveRole());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("useActiveRole / Carona Tradicional F02/F03", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());
  afterAll(() => restoreDom());

  it("loads saved vehicle data and derives traditional completeness without querying professional readiness", async () => {
    const { result } = await loadedHook();
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(result.current.vehicleStatus.isComplete).toBe(true);
    expect(result.current.isDriverEligible).toBe(true);
    expect(result.current.vehicleType).toBe("moto");
    expect(result.current.vehicleSeats).toBe(1);
    expect(result.current.error).toBeNull();
    expect(api.readEq).toHaveBeenCalledWith("id", "authenticated-user");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("restores a persisted driver role", async () => {
    setup({ ...fullProfile, active_role: "MOTORISTA" });
    const { result } = await loadedHook();
    expect(result.current.activeRole).toBe("MOTORISTA");
  });

  it.each([
    ["vehicle_brand", "brand"], ["vehicle_description", "model"],
    ["vehicle_color", "color"], ["vehicle_plate", "plate"],
  ])("opens the modal only for the missing %s", async (column: string, field: string) => {
    setup({ ...fullProfile, [column]: " " });
    const { result } = await loadedHook();
    let response: unknown;
    await act(async () => { response = await result.current.switchRole("MOTORISTA"); });
    expect(response).toEqual({ needsVehicleModal: true, missingFields: [field] });
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(result.current.isDriverEligible).toBe(false);
    expect(api.rpc).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("reports all basic fields for an empty vehicle and rejects malformed plates", () => {
    expect(getMissingVehicleFields(getVehicleStatus(null))).toEqual(["brand", "model", "color", "plate"]);
    expect(getVehicleStatus({ ...fullProfile, vehicle_plate: "INVALID" }).hasPlate).toBe(false);
  });

  it("keeps motorcycle capacity at one and the current car capacity at one to three", () => {
    expect(normalizeVehicleSeats("moto", 3)).toBe(1);
    expect(normalizeVehicleSeats("car", 9)).toBe(3);
    expect(normalizeVehicleSeats("car", -4)).toBe(1);
    expect(normalizeVehicleSeats("car", 2)).toBe(2);
  });

  it.each(["false", "error", "rejection"])("switches a complete profile independently of readiness %s", async (mode: "false" | "error" | "rejection") => {
    readinessFailure(mode);
    const { result } = await loadedHook();
    let response: unknown;
    await act(async () => { response = await result.current.switchRole("MOTORISTA"); });
    expect(response).toEqual({ needsVehicleModal: false, missingFields: [] });
    expect(result.current.activeRole).toBe("MOTORISTA");
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(api.rpc).toHaveBeenCalledWith("switch_user_active_role", { target_role: "MOTORISTA", p_target_role: "MOTORISTA" });
    expect(api.readiness).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("returns to passenger with both compatible RPC parameter names", async () => {
    setup({ ...fullProfile, active_role: "MOTORISTA", vehicle_color: null });
    const { result } = await loadedHook();
    await act(async () => { await result.current.switchRole("PASSAGEIRO"); });
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(api.rpc).toHaveBeenCalledWith("switch_user_active_role", { target_role: "PASSAGEIRO", p_target_role: "PASSAGEIRO" });
  });

  it.each([
    ["MOTORISTA", "error"], ["MOTORISTA", "rejection"],
    ["PASSAGEIRO", "error"], ["PASSAGEIRO", "rejection"],
  ])("persists %s on the authenticated profile when the switch RPC returns %s", async (target: ActiveRole, mode: string) => {
    const previous = target === "MOTORISTA" ? "PASSAGEIRO" : "MOTORISTA";
    setup({ ...fullProfile, active_role: previous });
    if (mode === "error") api.roleSwitch.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    else api.roleSwitch.mockRejectedValue(new Error("network unavailable"));
    const { result } = await loadedHook();
    await act(async () => { await result.current.switchRole(target); });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({ active_role: target });
    expect(api.writeEq).toHaveBeenCalledTimes(1);
    expect(api.writeEq).toHaveBeenCalledWith("id", "authenticated-user");
    expect(api.persist).toHaveBeenCalledTimes(1);
    expect(api.profile?.active_role).toBe(target);
    expect(result.current.activeRole).toBe(target);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it.each([
    { success: false, error: "ROLE_BLOCKED" },
    { success: false, error: "ROLE_BLOCKED", active_role: "MOTORISTA" },
    { success: false, active_role: "MOTORISTA" },
    { success: true, error: "ROLE_BLOCKED", active_role: "MOTORISTA" },
    null,
    { success: true },
    { success: true, active_role: "UNKNOWN" },
    "PASSAGEIRO",
  ])("uses verified profile persistence when an HTTP-success RPC body does not confirm the role (%j)", async (data: unknown) => {
    api.roleSwitch.mockResolvedValue({ data, error: null });
    const { result } = await loadedHook();
    let response: unknown;
    await act(async () => { response = await result.current.switchRole("MOTORISTA"); });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({ active_role: "MOTORISTA" });
    expect(api.writeEq).toHaveBeenCalledWith("id", "authenticated-user");
    expect(api.persist).toHaveBeenCalledTimes(1);
    expect(api.profile?.active_role).toBe("MOTORISTA");
    expect(response).toEqual({ needsVehicleModal: false, missingFields: [] });
    expect(result.current.activeRole).toBe("MOTORISTA");
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not activate from a misleading failure body when verified profile persistence also fails", async () => {
    api.roleSwitch.mockResolvedValue({
      data: { success: false, error: "ROLE_BLOCKED", active_role: "MOTORISTA" }, error: null,
    });
    api.persist.mockResolvedValue({ data: null, error: { code: "42501" } });
    const { result } = await loadedHook();
    await act(async () => { await expect(result.current.switchRole("MOTORISTA")).rejects.toThrow(); });
    expect(api.persist).toHaveBeenCalledTimes(1);
    expect(api.profile?.active_role).toBe("PASSAGEIRO");
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).not.toMatch(/ROLE_BLOCKED|42501/);
  });

  it.each(["MOTORISTA", "PASSAGEIRO"])("restores the previous role if both persistence paths fail for %s", async (target: ActiveRole) => {
    const previous = target === "MOTORISTA" ? "PASSAGEIRO" : "MOTORISTA";
    setup({ ...fullProfile, active_role: previous });
    api.roleSwitch.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    api.persist.mockResolvedValue({ data: null, error: { code: "42501", message: "private database details" } });
    const { result } = await loadedHook();
    await act(async () => { await expect(result.current.switchRole(target)).rejects.toThrow(); });
    expect(result.current.activeRole).toBe(previous);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).not.toMatch(/Supabase|42501|private database details/);
  });

  it.each([null, { active_role: "PASSAGEIRO" }])("requires fallback readback to confirm the requested role (%j)", async (data: Profile | null) => {
    api.roleSwitch.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    api.persist.mockResolvedValue({ data, error: null });
    const { result } = await loadedHook();
    await act(async () => { await expect(result.current.switchRole("MOTORISTA")).rejects.toThrow(); });
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(result.current.busy).toBe(false);
  });

  it.each(["false", "error", "rejection"])("saves all normalized vehicle fields and driver role atomically despite readiness %s", async (mode: "false" | "error" | "rejection") => {
    setup({ active_role: "PASSAGEIRO" });
    readinessFailure(mode);
    const { result } = await loadedHook();
    await act(async () => { await result.current.saveVehicle(draft); });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({
      active_role: "MOTORISTA", vehicle_brand: "Honda", vehicle_description: "CG 160",
      vehicle_color: "Preta", vehicle_plate: "ABC1D23", vehicle_type: "moto", vehicle_seats: 1,
    });
    expect(api.writeEq).toHaveBeenCalledTimes(1);
    expect(api.writeEq).toHaveBeenCalledWith("id", "authenticated-user");
    expect(result.current.activeRole).toBe("MOTORISTA");
    expect(result.current.vehicleStatus.isComplete).toBe(true);
    expect(result.current.isDriverEligible).toBe(true);
    expect(result.current.vehicleSeats).toBe(1);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("preserves saved fields omitted by the missing-fields modal and saves car seats", async () => {
    setup({ ...fullProfile, vehicle_color: null });
    const { result } = await loadedHook();
    await act(async () => { await result.current.saveVehicle({
      brand: "", model: "", color: " Prata ", plate: "", vehicleType: "car", vehicleSeats: 3,
    }); });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({
      active_role: "MOTORISTA", vehicle_brand: "Honda", vehicle_description: "CG 160",
      vehicle_color: "Prata", vehicle_plate: "ABC1D23", vehicle_type: "car", vehicle_seats: 3,
    });
    expect(result.current.vehicleType).toBe("car");
    expect(result.current.vehicleSeats).toBe(3);
    expect(result.current.activeRole).toBe("MOTORISTA");
  });

  it("persists explicitly supplied changes to an already complete vehicle", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.saveVehicle({
      brand: " Toyota ", model: " Corolla ", color: "Branca", plate: "xyz1234", vehicleType: "car", vehicleSeats: 2,
    }); });
    expect(api.profile).toEqual({
      active_role: "MOTORISTA", vehicle_brand: "Toyota", vehicle_description: "Corolla",
      vehicle_color: "Branca", vehicle_plate: "XYZ1234", vehicle_type: "car", vehicle_seats: 2,
    });
  });

  it.each(["error", "rejection", "empty", "wrong-role"])("keeps the previous role and clears busy after a failed vehicle save (%s)", async (mode: string) => {
    setup({ ...fullProfile, vehicle_color: null });
    if (mode === "rejection") api.persist.mockRejectedValue(new Error("private database details"));
    else api.persist.mockResolvedValue({
      data: mode === "wrong-role" ? { ...fullProfile, vehicle_color: "Preta" } : null,
      error: mode === "error" ? { code: "42501", message: "private database details" } : null,
    });
    const { result } = await loadedHook();
    await act(async () => { await expect(result.current.saveVehicle(draft)).rejects.toThrow(); });
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(result.current.vehicleStatus.hasColor).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).not.toMatch(/Supabase|42501|private database details/);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { vehicleType: "moto", vehicleSeats: 2 }, { vehicleType: "car", vehicleSeats: 0 },
    { vehicleType: "car", vehicleSeats: 4 }, { vehicleType: "car", vehicleSeats: 1.5 },
    { vehicleType: "bus", vehicleSeats: 1 }, { plate: "INVALID" }, { brand: "", model: "" },
  ])("rejects invalid vehicle input without writing (%j)", async (invalid: Partial<VehicleDraft>) => {
    setup({ active_role: "PASSAGEIRO" });
    const { result } = await loadedHook();
    await expect(result.current.saveVehicle({ ...draft, ...invalid })).rejects.toThrow();
    expect(api.update).not.toHaveBeenCalled();
    expect(result.current.activeRole).toBe("PASSAGEIRO");
  });

  it("does not write an unauthenticated role or vehicle", async () => {
    api.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result } = await loadedHook();
    await expect(result.current.switchRole("PASSAGEIRO")).rejects.toThrow();
    await expect(result.current.saveVehicle(draft)).rejects.toThrow();
    expect(api.rpc).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });
});
