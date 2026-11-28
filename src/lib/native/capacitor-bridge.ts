import { Capacitor, registerPlugin } from "@capacitor/core";

/** Ride-alert channel shared by the Java bootstrap and the JS fallback. */
export const RIDE_ALERT_CHANNEL_ID = "corridas_urgentes";

/**
 * True only inside the CARONAA Android shell. Uses the Capacitor bridge, never
 * the user agent, and is safe during SSR.
 */
export function isNativeAndroid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/** Plugin availability: an older APK may not ship a newer plugin. */
export function isNativePluginAvailable(name: string): boolean {
  try {
    return isNativeAndroid() && Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

interface CaronaaNativePlugin {
  firebaseStatus(): Promise<{ configured: boolean; rideActions?: boolean }>;
  consumeRideNotificationAction(): Promise<{ rideId?: string; ownerHash?: string; expiresAtMs?: number; action?: string }>;
}
const CaronaaNative = registerPlugin<CaronaaNativePlugin>("CaronaaNative");

/** Whether the APK was built with a real Firebase configuration (google-services.json). */
export async function hasNativeFirebaseConfig(): Promise<boolean> {
  if (!isNativePluginAvailable("CaronaaNative")) return false;
  try {
    return (await CaronaaNative.firebaseStatus()).configured === true;
  } catch {
    return false;
  }
}

export async function nativeRideActionsSupported(): Promise<boolean> {
  if (!isNativePluginAvailable("CaronaaNative")) return false;
  try { return (await CaronaaNative.firebaseStatus()).rideActions === true; } catch { return false; }
}

export async function consumeNativeRideAction() {
  if (!isNativePluginAvailable("CaronaaNative")) return null;
  try { return await CaronaaNative.consumeRideNotificationAction(); } catch { return null; }
}

let channelSetup: Promise<boolean> | null = null;

/**
 * Ensures the ride-alert channel exists. The Java bootstrap normally creates it
 * first; this only creates it when absent and never overrides user choices.
 * Web: no-op. Idempotent within a session.
 */
export function setupAndroidNotificationChannels(): Promise<boolean> {
  if (!isNativePluginAvailable("LocalNotifications")) return Promise.resolve(false);
  if (channelSetup) return channelSetup;
  channelSetup = (async () => {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const { channels } = await LocalNotifications.listChannels();
      if (channels.some((c) => c.id === RIDE_ALERT_CHANNEL_ID)) return true;
      await LocalNotifications.createChannel({
        id: RIDE_ALERT_CHANNEL_ID,
        name: "Corridas urgentes",
        description: "Novos pedidos de corrida perto de você",
        importance: 5,
        visibility: 0, // PRIVATE: no route or personal data on the lock screen
        sound: "caronaa_ride_alert.wav",
        lights: true,
        lightColor: "#FFBB00",
        vibration: true,
      });
      return true;
    } catch {
      channelSetup = null;
      return false;
    }
  })();
  return channelSetup;
}

/** Runs `onResume` when the Android app returns to foreground. Returns cleanup. */
export function onNativeAppResume(onResume: () => void): () => void {
  if (!isNativePluginAvailable("App")) return () => {};
  let disposed = false;
  let remove: (() => void) | null = null;
  void import("@capacitor/app")
    .then(({ App }) => App.addListener("appStateChange", (s) => { if (s.isActive) onResume(); }))
    .then((handle) => {
      const off = () => { void handle.remove(); };
      if (disposed) off(); else remove = off;
    })
    .catch(() => undefined);
  return () => { disposed = true; remove?.(); remove = null; };
}

/** Test-only reset of module caches. */
export function __resetNativeBridgeForTests() { channelSetup = null; }
