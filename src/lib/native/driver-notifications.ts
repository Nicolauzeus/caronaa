import { subscribeDriverToPush, type PushSubscribeResult } from "@/lib/push/web-push-client";
import {
  isNativeAndroid, isNativePluginAvailable, setupAndroidNotificationChannels,
} from "./capacitor-bridge";
import { registerNativeDriverPush, __resetFcmSessionForTests } from "./driver-fcm-session";

/** Platform-neutral driver alert permission. */
export type DriverAlertPermission = "granted" | "denied" | "prompt" | "unsupported";

export type DriverAlertResult =
  | { ok: true; remote: "web" | "native-registered" | "native-unavailable" }
  | Extract<PushSubscribeResult, { ok: false }>;

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

async function finishNative(): Promise<DriverAlertResult> {
  await setupAndroidNotificationChannels();
  return { ok: true, remote: (await registerNativeDriverPush()) ? "native-registered" : "native-unavailable" };
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

export function __resetDriverNotificationsForTests() { __resetFcmSessionForTests(); }

/** APK only: fires a local alert on the ride channel so the driver can hear the ringtone. Never prompts. */
export async function testRideAlertSound(): Promise<"ok" | "denied" | "unsupported"> {
  if (!isNativeAndroid()) return "unsupported";
  const plugin = await nativeLocal();
  if (!plugin) return "unsupported";
  try {
    if (normalize((await plugin.checkPermissions()).display) !== "granted") return "denied";
    await setupAndroidNotificationChannels();
    await plugin.schedule({ notifications: [{
      id: 990001, title: "Teste de corrida CARONAA", body: "Este é o toque que você ouvirá quando chegar uma corrida.",
      channelId: "corridas_urgentes", smallIcon: "ic_stat_caronaa", iconColor: "#FFBB00",
    }] });
    return "ok";
  } catch { return "unsupported"; }
}

/** APK only: opens this app's Android settings (battery/notifications). */
export async function openNativeAppSettings(): Promise<boolean> {
  if (!isNativeAndroid() || !isNativePluginAvailable("CaronaaNative")) return false;
  try {
    const { registerPlugin } = await import("@capacitor/core");
    await registerPlugin<{ openAppSettings(): Promise<void> }>("CaronaaNative").openAppSettings();
    return true;
  } catch { return false; }
}
