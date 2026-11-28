import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { needsIOSHomeScreen, subscribeDriverToPush, unsubscribeDriverFromPush, urlBase64ToUint8Array } from "@/lib/push/web-push-client";

const sub = { endpoint: "https://push.example/abc", unsubscribe: vi.fn(async () => true),
  toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } }) };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
const getRegistration = vi.fn();
const register = vi.fn();
const requestPermission = vi.fn();
let permission = "default";
const registration = (worker = Object.assign(new EventTarget(), { state: "activated" })) =>
  Object.assign(new EventTarget(), { active: worker, installing: null, waiting: null, pushManager });
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  permission = "default";
  rpc.mockReset().mockResolvedValue({ error: null });
  pushManager.getSubscription.mockReset().mockResolvedValue(null);
  pushManager.subscribe.mockReset().mockResolvedValue(sub);
  getRegistration.mockReset().mockResolvedValue(registration());
  register.mockReset().mockResolvedValue(registration());
  requestPermission.mockReset().mockImplementation(async () => { permission = "granted"; return permission; });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function () {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { get permission() { return permission; }, requestPermission } });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration, register } });
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Desktop test browser" });
  Object.defineProperty(navigator, "platform", { configurable: true, value: "Linux" });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });
  Object.defineProperty(navigator, "standalone", { configurable: true, value: false });
});
afterEach(() => { vi.useRealTimers(); });

describe("web push client", () => {
  it("decodes URL-safe base64 VAPID keys", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
  it("subscribes and saves only after permission is granted", async () => {
    expect(await subscribeDriverToPush()).toEqual({ ok: true });
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(rpc).toHaveBeenCalledWith("save_driver_push_subscription", expect.objectContaining({
      p_endpoint: "https://push.example/abc", p_p256dh: "P", p_auth: "A" }));
  });
  it("never prompts again when permission was already granted", async () => {
    permission = "granted";
    pushManager.getSubscription.mockResolvedValue(sub);
    expect(await subscribeDriverToPush()).toEqual({ ok: true });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });
  it("does not request again or subscribe when permission is denied", async () => {
    permission = "denied";
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "DENIED" });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not subscribe after a dismissed prompt", async () => {
    requestPermission.mockResolvedValue("default");
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "DENIED" });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });
  it("handles a rejected permission request without throwing", async () => {
    requestPermission.mockRejectedValue(new Error("browser unavailable"));
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "SAVE_FAILED" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("registers the CARONAA worker on the first load", async () => {
    getRegistration.mockResolvedValue(undefined);
    expect(await subscribeDriverToPush()).toEqual({ ok: true });
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });
  it("waits for worker activation before subscribing", async () => {
    const worker = Object.assign(new EventTarget(), { state: "activating" });
    getRegistration.mockResolvedValue(registration(worker));
    const pending = subscribeDriverToPush();
    await flush();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    worker.state = "activated";
    worker.dispatchEvent(new Event("statechange"));
    expect(await pending).toEqual({ ok: true });
  });
  it("bounds a stalled registration and ignores late completion", async () => {
    vi.useFakeTimers();
    getRegistration.mockResolvedValue(undefined);
    let complete!: (value: ReturnType<typeof registration>) => void;
    register.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = subscribeDriverToPush();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ ok: false, reason: "NO_SERVICE_WORKER" });
    complete(registration());
    await flush();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans listeners after an activation timeout", async () => {
    vi.useFakeTimers();
    const worker = Object.assign(new EventTarget(), { state: "activating" });
    const remove = vi.spyOn(worker, "removeEventListener");
    getRegistration.mockResolvedValue(registration(worker));
    const pending = subscribeDriverToPush();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ ok: false, reason: "NO_SERVICE_WORKER" });
    expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function));
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });
  it("reports registration errors", async () => {
    getRegistration.mockRejectedValue(new Error("worker unavailable"));
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "NO_SERVICE_WORKER" });
  });
  it("reports failed persistence even with granted permission", async () => {
    permission = "granted";
    rpc.mockResolvedValue({ error: { message: "unavailable" } });
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "SAVE_FAILED" });
  });
  it("guides an iPhone browser to installation without prompting", async () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "iPhone" });
    expect(needsIOSHomeScreen()).toBe(true);
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "INSTALL_REQUIRED" });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
  it("recognizes iPadOS with a desktop user agent", () => {
    Object.defineProperty(navigator, "platform", { configurable: true, value: "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    expect(needsIOSHomeScreen()).toBe(true);
  });
  it("allows an installed iPhone app", async () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "iPhone" });
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    expect(needsIOSHomeScreen()).toBe(false);
    expect(await subscribeDriverToPush()).toEqual({ ok: true });
  });
  it("rejects an insecure context without prompting", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    expect(await subscribeDriverToPush()).toEqual({ ok: false, reason: "UNSUPPORTED" });
    expect(requestPermission).not.toHaveBeenCalled();
  });
  it("unsubscribes and deletes the saved endpoint", async () => {
    pushManager.getSubscription.mockResolvedValue(sub);
    await unsubscribeDriverFromPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("delete_driver_push_subscription", { p_endpoint: "https://push.example/abc" });
  });
  it("never installs a worker while signing out", async () => {
    getRegistration.mockResolvedValue(undefined);
    await unsubscribeDriverFromPush();
    expect(register).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
