import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cap = vi.hoisted(() => ({ native: false, platform: "web", plugins: new Set<string>(), firebase: false }));
const local = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), listChannels: vi.fn(), createChannel: vi.fn(),
}));
const push = vi.hoisted(() => ({ register: vi.fn(), addListener: vi.fn() }));
const app = vi.hoisted(() => ({ addListener: vi.fn() }));
const webPush = vi.hoisted(() => ({ subscribeDriverToPush: vi.fn() }));

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
import { isStandaloneApp } from "@/lib/push/install-prompt";
import { registerPwa, requestPersistentStorage } from "@/lib/pwa";

const android = (plugins = ["LocalNotifications", "PushNotifications", "App", "CaronaaNative"]) => {
  cap.native = true; cap.platform = "android"; cap.plugins = new Set(plugins);
};
const requestPermission = vi.fn();

beforeEach(() => {
  cap.native = false; cap.platform = "web"; cap.plugins = new Set(); cap.firebase = false;
  __resetNativeBridgeForTests(); __resetDriverNotificationsForTests();
  vi.clearAllMocks();
  local.listChannels.mockResolvedValue({ channels: [] });
  local.createChannel.mockResolvedValue(undefined);
  webPush.subscribeDriverToPush.mockResolvedValue({ ok: true });
  vi.stubGlobal("Notification", Object.assign(function () {}, { permission: "default", requestPermission }));
});
afterEach(() => vi.unstubAllGlobals());

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
  it("registers FCM once when a real Firebase config exists, without storing the token", async () => {
    android(); cap.firebase = true;
    local.checkPermissions.mockResolvedValue({ display: "granted" });
    const listeners: Record<string, (v: unknown) => void> = {};
    push.addListener.mockImplementation(async (ev: string, fn: (v: unknown) => void) => { listeners[ev] = fn; return { remove: async () => {} }; });
    push.register.mockImplementation(async () => { await Promise.resolve(); listeners["registration"]?.({ value: "secret" }); });
    expect(await enableDriverAlerts()).toEqual({ ok: true, remote: "native-registered" });
    await enableDriverAlerts();
    expect(push.register).toHaveBeenCalledTimes(1);
    expect(webPush.subscribeDriverToPush).not.toHaveBeenCalled();
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
