import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cap = vi.hoisted(() => ({ native: false, platform: "web", plugins: new Set<string>(), firebase: false }));
const local = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), listChannels: vi.fn(), createChannel: vi.fn(),
}));
const push = vi.hoisted(() => ({ register: vi.fn(), unregister: vi.fn(), removeAllDeliveredNotifications: vi.fn(), addListener: vi.fn() }));
const app = vi.hoisted(() => ({ addListener: vi.fn(), getInfo: vi.fn() }));
const webPush = vi.hoisted(() => ({ subscribeDriverToPush: vi.fn() }));
const db = vi.hoisted(() => ({ owner: "driver-a" as string | null, role: "MOTORISTA", fail: false, rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: db.owner ? { user: { id: db.owner } } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({
      maybeSingle: async () => ({ data: { active_role: db.role }, error: null }),
    }) }) }) }),
    rpc: (name: string, args: unknown) => {
      db.rpc(name, args);
      return { abortSignal: async () => ({ error: db.fail ? { code: "NETWORK" } : null }) };
    },
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => cap.native, getPlatform: () => cap.platform,
    isPluginAvailable: (n: string) => cap.plugins.has(n),
  },
  registerPlugin: () => ({ firebaseStatus: async () => ({ configured: cap.firebase }) }),
}));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: local }));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: push }));
vi.mock("@capacitor/app", () => ({ App: app }));
vi.mock("@/lib/push/web-push-client", () => webPush);

import { __resetNativeBridgeForTests, isNativeAndroid, onNativeAppResume, setupAndroidNotificationChannels } from "@/lib/native/capacitor-bridge";
import { __resetDriverNotificationsForTests, enableDriverAlerts, getDriverAlertPermission, refreshGrantedDriverAlerts } from "@/lib/native/driver-notifications";
import { mountNativeDriverNotifications, nativeDriverAuthChanged, revokeNativeDriverNotificationsBeforeSignOut } from "@/lib/native/driver-fcm-session";
import { isStandaloneApp } from "@/lib/push/install-prompt";
import { registerPwa, requestPersistentStorage } from "@/lib/pwa";

const android = (plugins = ["LocalNotifications", "PushNotifications", "App", "CaronaaNative"]) => {
  cap.native = true; cap.platform = "android"; cap.plugins = new Set(plugins);
};
const requestPermission = vi.fn();
let cleanupNative: (() => void) | undefined;

beforeEach(() => {
  cap.native = false; cap.platform = "web"; cap.plugins = new Set(); cap.firebase = false;
  __resetNativeBridgeForTests(); __resetDriverNotificationsForTests();
  vi.clearAllMocks();
  db.owner = "driver-a"; db.role = "MOTORISTA"; db.fail = false;
  localStorage.removeItem("caronaa:native-fcm-device-bindings:v1");
  app.getInfo.mockResolvedValue({ version: "1.0.0", build: "1" });
  push.unregister.mockResolvedValue(undefined);
  push.removeAllDeliveredNotifications.mockResolvedValue(undefined);
  local.listChannels.mockResolvedValue({ channels: [] });
  local.createChannel.mockResolvedValue(undefined);
  webPush.subscribeDriverToPush.mockResolvedValue({ ok: true });
  vi.stubGlobal("Notification", Object.assign(function () {}, { permission: "default", requestPermission }));
});
afterEach(() => { cleanupNative?.(); cleanupNative = undefined; vi.unstubAllGlobals(); });

describe("isNativeAndroid", () => {
  it("is false in a browser and without window (SSR)", () => {
    expect(isNativeAndroid()).toBe(false);
    vi.stubGlobal("window", undefined);
    expect(isNativeAndroid()).toBe(false);
  });
  it("is true only for the native android platform, ignoring user agent", () => {
    cap.native = true; cap.platform = "ios";
    expect(isNativeAndroid()).toBe(false);
    android();
    expect(isNativeAndroid()).toBe(true);
  });
});

describe("notification channel", () => {
  it("is a web no-op", async () => {
    expect(await setupAndroidNotificationChannels()).toBe(false);
    expect(local.listChannels).not.toHaveBeenCalled();
  });
  it("creates the private channel once when absent", async () => {
    android();
    await setupAndroidNotificationChannels(); await setupAndroidNotificationChannels();
    expect(local.createChannel).toHaveBeenCalledTimes(1);
    expect(local.createChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: "corridas_urgentes", name: "Corridas urgentes", importance: 5, visibility: 0, lightColor: "#FFBB00", vibration: true,
    }));
  });
  it("never replaces an existing (user-controlled) channel", async () => {
    android();
    local.listChannels.mockResolvedValue({ channels: [{ id: "corridas_urgentes" }] });
    expect(await setupAndroidNotificationChannels()).toBe(true);
    expect(local.createChannel).not.toHaveBeenCalled();
  });
});

describe("driver alert permissions", () => {
  it("web keeps the original Web Push flow", async () => {
    expect(await getDriverAlertPermission()).toBe("prompt");
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "web" });
    expect(webPush.subscribeDriverToPush).toHaveBeenCalledTimes(1);
  });
  it.each([["granted", "granted"], ["denied", "denied"], ["prompt", "prompt"], ["prompt-with-rationale", "prompt"]])(
    "native maps %s", async (display, expected) => {
      android(); local.checkPermissions.mockResolvedValue({ display });
      expect(await getDriverAlertPermission()).toBe(expected);
    });
  it("native reports unsupported on plugin error or old APK without plugin", async () => {
    android(); local.checkPermissions.mockRejectedValue(new Error("x"));
    expect(await getDriverAlertPermission()).toBe("unsupported");
    android([]);
    expect(await getDriverAlertPermission()).toBe("unsupported");
    expect(await enableDriverAlerts()).toEqual({ ok: false, reason: "UNSUPPORTED" });
    expect(webPush.subscribeDriverToPush).not.toHaveBeenCalled();
  });
  it("native asks via plugin, never the Web API, and is honest without Firebase", async () => {
    android();
    local.checkPermissions.mockResolvedValue({ display: "prompt" });
    local.requestPermissions.mockResolvedValue({ display: "granted" });
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-unavailable" });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(webPush.subscribeDriverToPush).not.toHaveBeenCalled();
    expect(push.register).not.toHaveBeenCalled();
    expect(local.createChannel).toHaveBeenCalledTimes(1);
  });
  it("native denial is reported without registering", async () => {
    android();
    local.checkPermissions.mockResolvedValue({ display: "prompt" });
    local.requestPermissions.mockResolvedValue({ display: "denied" });
    expect(await enableDriverAlerts()).toEqual({ ok: false, reason: "DENIED" });
  });
  function startFcm(open = vi.fn()) {
    android(); cap.firebase = true;
    local.checkPermissions.mockResolvedValue({ display: "granted" });
    const listeners: Record<string, (v: any) => void> = {};
    push.addListener.mockImplementation(async (ev: string, fn: (v: any) => void) => {
      listeners[ev] = fn;
      return { remove: async () => { delete listeners[ev]; } };
    });
    push.register.mockImplementation(async () => { listeners.registration?.({ value: "test-token-a" }); });
    cleanupNative = mountNativeDriverNotifications("driver-a", open);
    return { listeners, open };
  }
  it("persists the native registration for a verified driver and deduplicates it", async () => {
    startFcm();
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledWith("save_driver_fcm_token", {
      p_token: "test-token-a", p_platform: "android", p_device_info: expect.stringContaining("1.0.0"),
    }));
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-registered" });
    await enableDriverAlerts();
    expect(push.register).toHaveBeenCalledTimes(1);
    expect(db.rpc.mock.calls.filter(c => c[0] === "save_driver_fcm_token")).toHaveLength(1);
    expect(webPush.subscribeDriverToPush).not.toHaveBeenCalled();
  });
  it("does not register for a passenger even when permission is granted", async () => {
    db.role = "PASSAGEIRO";
    startFcm();
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-unavailable" });
    expect(push.register).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("retries a failed save on reconnect without asking for permission again", async () => {
    db.fail = true;
    startFcm();
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(1));
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-unavailable" });
    db.fail = false;
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(db.rpc.mock.calls.filter(c => c[0] === "save_driver_fcm_token").length).toBeGreaterThan(1));
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-registered" });
    expect(local.requestPermissions).not.toHaveBeenCalled();
  });
  it("handles token rotation and revokes only the previous device token", async () => {
    const { listeners } = startFcm();
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(1));
    listeners.registration({ value: "test-token-b" });
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledWith("delete_driver_fcm_token", { p_token: "test-token-a" }));
    expect(db.rpc).toHaveBeenCalledWith("save_driver_fcm_token", expect.objectContaining({p_token:"test-token-b"}));
  });
  it("routes a tap only to a safe driver screen, never to an external URL", async () => {
    const { listeners, open } = startFcm();
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(1));
    listeners.pushNotificationActionPerformed({ actionId: "tap", notification: { data: { route: "https://example.invalid" } } });
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith("/disponibilidade-profissional"));
    listeners.pushNotificationActionPerformed({ actionId: "tap", notification: { data: { route: "/home" } } });
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith("/home"));
  });
  it("revokes on logout before the authenticated session is removed and ignores late registration", async () => {
    const { listeners } = startFcm();
    await vi.waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(1));
    const late = listeners.registration;
    await revokeNativeDriverNotificationsBeforeSignOut();
    expect(db.rpc).toHaveBeenCalledWith("delete_driver_fcm_token", { p_token: "test-token-a" });
    expect(push.unregister).toHaveBeenCalledTimes(1);
    db.owner = null;
    nativeDriverAuthChanged(null);
    late({value:"late-token"});
    expect(db.rpc.mock.calls.filter(c => c[0] === "save_driver_fcm_token")).toHaveLength(1);
  });
  it("does not rebind a previous account's token if logout cleanup failed", async () => {
    localStorage.setItem("caronaa:native-fcm-device-bindings:v1", JSON.stringify([{owner:"previous-owner",token:"test-token-a"}]));
    startFcm();
    await vi.waitFor(() => expect(push.unregister).toHaveBeenCalled());
    expect(db.rpc).not.toHaveBeenCalledWith("save_driver_fcm_token", expect.anything());
    expect(db.rpc).not.toHaveBeenCalledWith("delete_driver_fcm_token", expect.anything());
  });
  it("refresh never prompts", async () => {
    android(); local.checkPermissions.mockResolvedValue({ display: "prompt" });
    expect(await refreshGrantedDriverAlerts()).toBeNull();
    expect(local.requestPermissions).not.toHaveBeenCalled();
    cap.native = false; cap.platform = "web";
    expect(await refreshGrantedDriverAlerts()).toBeNull();
    expect(webPush.subscribeDriverToPush).not.toHaveBeenCalled();
  });
});

describe("PWA in the APK", () => {
  it("treats the APK as installed and skips service worker/storage", async () => {
    const register = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { register }, storage: { persist: vi.fn(), persisted: vi.fn() } });
    android();
    expect(isStandaloneApp()).toBe(true);
    await registerPwa();
    expect(register).not.toHaveBeenCalled();
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe("native resume lifecycle", () => {
  it("is a web no-op", () => {
    onNativeAppResume(() => {})();
    expect(app.addListener).not.toHaveBeenCalled();
  });
  it("fires on active and removes the listener even if cleanup races the registration", async () => {
    android();
    const remove = vi.fn(async () => {});
    let cb: (s: { isActive: boolean }) => void = () => {};
    app.addListener.mockImplementation(async (_e: string, fn: typeof cb) => { cb = fn; return { remove }; });
    const onResume = vi.fn();
    const off = onNativeAppResume(onResume);
    off(); // before the Promise resolves
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    const off2 = onNativeAppResume(onResume);
    await vi.waitFor(() => expect(app.addListener).toHaveBeenCalledTimes(2));
    cb({ isActive: false }); cb({ isActive: true });
    expect(onResume).toHaveBeenCalledTimes(1);
    await Promise.resolve(); await Promise.resolve();
    off2();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
