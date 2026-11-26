import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "./vapid-public-key";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "UNSUPPORTED" | "DENIED" | "NO_SERVICE_WORKER" | "SAVE_FAILED" };

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isWebPushSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as Rpc)(fn, args);

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch { return null; }
}

/** Ask permission, subscribe through the service worker and save it for the signed-in driver. */
export async function subscribeDriverToPush(): Promise<PushSubscribeResult> {
  if (!isWebPushSupported()) return { ok: false, reason: "UNSUPPORTED" };
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "DENIED" };
  const registration = await getRegistration();
  if (!registration) return { ok: false, reason: "NO_SERVICE_WORKER" };
  try {
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
