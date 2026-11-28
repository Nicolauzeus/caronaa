import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ enable: vi.fn() }));
vi.mock("@/lib/native/driver-notifications", () => ({ enableDriverAlerts: mock.enable }));
import { readWebSetupStatus, requestWebSetupLocation, requestWebSetupNotifications } from "@/lib/native/web-permission-setup";
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());
describe("browser permission center", () => {
  it("reads browser consent without assuming precise GPS or battery", async () => {
    vi.stubGlobal("Notification", { permission:"granted" });
    vi.stubGlobal("navigator", { permissions:{query:vi.fn().mockResolvedValue({state:"prompt"})} });
    expect(await readWebSetupStatus()).toEqual({ notifications:true, siteLocation:false });
    expect(mock.enable).not.toHaveBeenCalled();
  });
  it("requests passenger consent without registering a driver", async () => {
    const requestPermission=vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification",{permission:"default",requestPermission});
    expect(await requestWebSetupNotifications(false)).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(mock.enable).not.toHaveBeenCalled();
  });
  it("reuses the existing driver push flow", async () => {
    vi.stubGlobal("Notification",{permission:"default"});
    mock.enable.mockResolvedValue({ok:true,remote:"web"});
    expect(await requestWebSetupNotifications(true)).toBe(true);
    expect(mock.enable).toHaveBeenCalledOnce();
  });
  it("requests a one-time location fix only from explicit action", async () => {
    const getCurrentPosition=vi.fn((ok:()=>void)=>ok());
    vi.stubGlobal("navigator",{geolocation:{getCurrentPosition}});
    expect(await requestWebSetupLocation()).toBe(true);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
});
