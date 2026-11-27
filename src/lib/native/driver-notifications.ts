import { subscribeDriverToPush } from "@/lib/push/web-push-client";
import {
  hasNativeFirebaseConfig, isNativeAndroid, isNativePluginAvailable, setupAndroidNotificationChannels,
} from "./capacitor-bridge";

/** Platform-neutral driver alert permission. */
export type DriverAlertPermission = "granted" | "denied" | "prompt" | "unsupported";

export type DriverAlertResult =
  | { ok: true; remote: "web" | "native-registered" | "native-unavailable" }
  | { ok: false; reason: "UNSUPPORTED" | "DENIED" | "NO_SERVICE_WORKER" | "SAVE_FAILED" };

function normalize(value: string | undefined): DriverAlertPermission {
  if (value === "granted") return "granted";
  if (value === "denied") return "denied";
  if (value === "prompt" || value === "prompt-with-rationale" || value === "default") return "prompt";
  return "unsupported";
}

async function nativeLocal() {
  if (!isNativePluginAvailable("LocalNotifications")) return null;
  try { return (await import("@capacitor/local-notifications")).LocalNotifications; } catch { return null; }
}

/** Current permission without asking. Never prompts. */
export async function getDriverAlertPermission(): Promise<DriverAlertPermission> {
  if (isNativeAndroid()) {
    const plugin = await nativeLocal();
    if (!plugin) return "unsupported";
    try { return normalize((await plugin.checkPermissions()).display); } catch { return "unsupported"; }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return normalize(Notification.permission);
}

let pushRegistration: Promise<boolean> | null = null;

/**
 * Registers with FCM only when the APK carries a real Firebase config. The token
 * is neither logged nor stored: authenticated FCM delivery is a later phase.
 */
function registerNativePushOnce(): Promise<boolean> {
  if (pushRegistration) return pushRegistration;
  pushRegistration = (async () => {
    if (!isNativePluginAvailable("PushNotifications") || !(await hasNativeFirebaseConfig())) return false;
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const result = await new Promise<boolean>((resolve) => {
        const handles: Array<Promise<{ remove: () => Promise<void> }>> = [];
        const done = (ok: boolean) => { handles.forEach((h) => void h.then((x) => x.remove())); resolve(ok); };
        handles.push(PushNotifications.addListener("registration", () => done(true)));
        handles.push(PushNotifications.addListener("registrationError", () => done(false)));
        PushNotifications.register().catch(() => done(false));
      });
      if (!result) pushRegistration = null;
      return result;
    } catch {
      pushRegistration = null;
      return false;
    }
  })();
  return pushRegistration;
}

async function finishNative(): Promise<DriverAlertResult> {
  await setupAndroidNotificationChannels();
  return { ok: true, remote: (await registerNativePushOnce()) ? "native-registered" : "native-unavailable" };
}

/** Asks for permission (call only from an explicit driver action). */
export async function enableDriverAlerts(): Promise<DriverAlertResult> {
  if (!isNativeAndroid()) {
    const r = await subscribeDriverToPush();
    return r.ok ? { ok: true, remote: "web" } : r;
  }
  const plugin = await nativeLocal();
  if (!plugin) return { ok: false, reason: "UNSUPPORTED" };
  try {
    let state = normalize((await plugin.checkPermissions()).display);
    if (state === "prompt") state = normalize((await plugin.requestPermissions()).display);
    if (state !== "granted") return { ok: false, reason: state === "denied" || state === "prompt" ? "DENIED" : "UNSUPPORTED" };
  } catch {
    return { ok: false, reason: "UNSUPPORTED" };
  }
  return finishNative();
}

/** Revalidates only an already-granted permission. Never prompts. */
export async function refreshGrantedDriverAlerts(): Promise<DriverAlertResult | null> {
  if ((await getDriverAlertPermission()) !== "granted") return null;
  if (!isNativeAndroid()) {
    const r = await subscribeDriverToPush();
    return r.ok ? { ok: true, remote: "web" } : r;
  }
  return finishNative();
}

export function __resetDriverNotificationsForTests() { pushRegistration = null; }
