import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "./vapid-public-key";
import { isNativeAndroid } from "@/lib/native/capacitor-bridge";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "UNSUPPORTED" | "INSTALL_REQUIRED" | "DENIED" | "NO_SERVICE_WORKER" | "SAVE_FAILED" };

/** iOS Web Push is available from an installed Home Screen web app. */
export function needsIOSHomeScreen(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined" || isNativeAndroid()) return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !installed;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isWebPushSupported(): boolean {
  // The Android APK uses native notifications; never a browser subscription.
  return typeof window !== "undefined" && !isNativeAndroid() && window.isSecureContext &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as Rpc)(fn, args);

/** First-load registration and activation share one bounded deadline. */
function getRegistration(ensureActive = false): Promise<ServiceWorkerRegistration | null> {
  return new Promise((resolve) => {
    let finished = false;
    const cleanup: Array<() => void> = [];
    const finish = (registration: ServiceWorkerRegistration | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup.forEach(remove => remove());
      resolve(registration);
    };
    const timer = setTimeout(() => finish(null), 8000);
    void (async () => {
      try {
        let registration = await navigator.serviceWorker.getRegistration("/");
        if (finished) return;
        if (!registration && ensureActive) {
          registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        }
        if (finished) return;
        if (!registration || !ensureActive) { finish(registration ?? null); return; }
        const current = registration;
        const observed = new Set<ServiceWorker>();
        const check = () => {
          if (finished) return;
          if (current.active?.state === "activated") { finish(current); return; }
          for (const worker of [current.installing, current.waiting, current.active]) {
            if (!worker || observed.has(worker)) continue;
            observed.add(worker);
            worker.addEventListener("statechange", check);
            cleanup.push(() => worker.removeEventListener("statechange", check));
          }
        };
        current.addEventListener("updatefound", check);
        cleanup.push(() => current.removeEventListener("updatefound", check));
        check();
      } catch { finish(null); }
    })();
  });
}

/** Ask permission, subscribe through the service worker and save it for the signed-in driver. */
export async function subscribeDriverToPush(): Promise<PushSubscribeResult> {
  if (needsIOSHomeScreen()) return { ok: false, reason: "INSTALL_REQUIRED" };
  if (!isWebPushSupported()) return { ok: false, reason: "UNSUPPORTED" };
  try {
    // Ask immediately within the driver's tap, before awaiting worker setup.
    if (Notification.permission === "denied") return { ok: false, reason: "DENIED" };
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "DENIED" };
    const registration = await getRegistration(true);
    if (!registration) return { ok: false, reason: "NO_SERVICE_WORKER" };
    const subscription = (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    const json = subscription.toJSON();
    const p256dh = json.keys?.["p256dh"]; const auth = json.keys?.["auth"];
    if (!json.endpoint || !p256dh || !auth) return { ok: false, reason: "SAVE_FAILED" };
    const { error } = await rpc("save_driver_push_subscription", {
      p_endpoint: json.endpoint, p_p256dh: p256dh, p_auth: auth,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
    return error ? { ok: false, reason: "SAVE_FAILED" } : { ok: true };
  } catch { return { ok: false, reason: "SAVE_FAILED" }; }
}

/** Revoke this device's subscription (call on sign-out). Never throws. */
export async function unsubscribeDriverFromPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => false);
  await rpc("delete_driver_push_subscription", { p_endpoint: endpoint }).catch(() => undefined);
}
