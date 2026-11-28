import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ enabled: true, status: vi.fn(), request: vi.fn(), settings: vi.fn(), oldSettings: vi.fn(), check: vi.fn(), ask: vi.fn(), refresh: vi.fn() }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({ permissionSetupStatus: native.status, requestSetupLocation: native.request, openPermissionSetupSettings: native.settings }) }));
vi.mock("@/lib/native/capacitor-bridge", () => ({ isNativeAndroid: () => native.enabled, isNativePluginAvailable: () => native.enabled }));
vi.mock("@/lib/native/driver-notifications", () => ({ openNativeAppSettings: native.oldSettings, refreshGrantedDriverAlerts: native.refresh }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: { checkPermissions: native.check, requestPermissions: native.ask } }));
import { openSetupSettings, readSetupStatus, requestSetupGps, requestSetupNotifications, setupSeenKey, setupStatusLabel, nextSetupStep } from "@/lib/native/permission-setup";
beforeEach(() => { vi.resetAllMocks(); native.enabled = true; native.oldSettings.mockResolvedValue(true); native.refresh.mockResolvedValue(null); });
describe("native first-access permissions", () => {
  it("does not ask permissions on web", async () => { native.enabled = false; expect(await readSetupStatus()).toEqual({}); expect(await requestSetupGps()).toBe(false); expect(await requestSetupNotifications(true)).toBe(false); expect(native.request).not.toHaveBeenCalled(); expect(native.ask).not.toHaveBeenCalled(); });
  it("reads native booleans without prompting", async () => { native.status.mockResolvedValue({ preciseLocation: false, gpsEnabled: true, notifications: true, batteryExempt: false }); expect(await readSetupStatus()).toEqual({ preciseLocation: false, gpsEnabled: true, notifications: true, batteryExempt: false }); expect(native.ask).not.toHaveBeenCalled(); });
  it("never marks an old APK as configured when status is missing", async () => { native.status.mockRejectedValue(new Error("unimplemented")); native.check.mockResolvedValue({ display: "granted" }); expect(await readSetupStatus()).toEqual({}); expect(setupStatusLabel(undefined)).toBe("Verificar nos ajustes"); });
  it("falls back to old APK settings on missing native method", async () => { native.request.mockRejectedValue(new Error("unimplemented")); native.settings.mockRejectedValue(new Error("unimplemented")); expect(await requestSetupGps()).toBe(true); expect(native.oldSettings).toHaveBeenCalledOnce(); });
  it("opens requested settings without changing permissions", async () => { native.settings.mockResolvedValue(undefined); expect(await openSetupSettings("battery")).toBe(true); expect(native.settings).toHaveBeenCalledWith({ target: "battery" }); expect(native.ask).not.toHaveBeenCalled(); });
  it("asks for notification consent only when prompted, registers driver only", async () => { native.check.mockResolvedValue({ display: "prompt" }); native.ask.mockResolvedValue({ display: "granted" }); native.status.mockResolvedValue({ notifications: true }); expect(await requestSetupNotifications(false)).toBe(true); expect(native.refresh).not.toHaveBeenCalled(); expect(await requestSetupNotifications(true)).toBe(true); expect(native.refresh).toHaveBeenCalledOnce(); });
  it("respects a fresh refusal without immediately opening settings", async () => { native.check.mockResolvedValue({ display: "prompt" }); native.ask.mockResolvedValue({ display: "denied" }); expect(await requestSetupNotifications(true)).toBe(true); expect(native.settings).not.toHaveBeenCalled(); expect(native.refresh).not.toHaveBeenCalled(); });
  it("keeps denial actionable and does not register a driver", async () => { native.check.mockResolvedValue({ display: "denied" }); native.settings.mockResolvedValue(undefined); expect(await requestSetupNotifications(true)).toBe(true); expect(native.settings).toHaveBeenCalledWith({target:"notifications"}); expect(native.refresh).not.toHaveBeenCalled(); expect(native.ask).not.toHaveBeenCalled(); });
  it("guides only pending or unknown items, once per explicit pass", () => {
    const rows = [{title:"Ativo",value:true},{title:"GPS",value:false},{title:"Bateria",value:undefined}];
    expect(nextSetupStep(rows, [])?.title).toBe("GPS");
    expect(nextSetupStep(rows, ["GPS"])?.title).toBe("Bateria");
    expect(nextSetupStep(rows, ["GPS","Bateria"])).toBeUndefined();
  });
  it("separates the first-run marker by account and role", () => { expect(setupSeenKey("a", true)).not.toBe(setupSeenKey("a", false)); expect(setupSeenKey("a", true)).not.toBe(setupSeenKey("b", true)); expect(setupSeenKey("a", true, "web")).not.toBe(setupSeenKey("a", true, "android")); });
});
