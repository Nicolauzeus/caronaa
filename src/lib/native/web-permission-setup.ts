import { enableDriverAlerts } from "./driver-notifications";
import type { SetupStatus } from "./permission-setup";

export async function readWebSetupStatus(): Promise<SetupStatus> {
  const result: SetupStatus = {};
  if (typeof window === "undefined") return result;
  if ("Notification" in window) result.notifications = window.Notification.permission === "granted";
  try {
    if (navigator.permissions?.query) {
      const state = (await navigator.permissions.query({ name: "geolocation" })).state;
      result.siteLocation = state === "granted" ? true : state === "denied" || state === "prompt" ? false : undefined;
    }
  } catch { /* Safari and some browsers do not expose permission state. */ }
  return result;
}

/** Explicit click only: do not publish a fix or start professional tracking. */
export function requestWebSetupLocation(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(false);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  });
}

/** Driver uses the existing consent + web-push registration flow. Passenger only requests browser consent. */
export async function requestWebSetupNotifications(driver: boolean): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  try {
    if (driver) return (await enableDriverAlerts()).ok;
    if (window.Notification.permission === "denied") return false;
    return (window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission()) === "granted";
  } catch { return false; }
}
