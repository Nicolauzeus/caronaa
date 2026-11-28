import { registerPlugin } from "@capacitor/core";
import { isNativeAndroid, isNativePluginAvailable } from "./capacitor-bridge";
import { openNativeAppSettings, refreshGrantedDriverAlerts } from "./driver-notifications";

export type SetupStatus = {
  preciseLocation?: boolean; approximateLocation?: boolean; gpsEnabled?: boolean;
  notifications?: boolean; rideChannel?: boolean; batteryExempt?: boolean;
};
export type SetupTarget = "app" | "gps" | "battery" | "notifications" | "channel";
const bridge = registerPlugin<{
  permissionSetupStatus(): Promise<SetupStatus>;
  requestSetupLocation(): Promise<SetupStatus>;
  openPermissionSetupSettings(options: { target: SetupTarget }): Promise<void>;
}>("CaronaaNative");

export async function readSetupStatus(): Promise<SetupStatus> {
  if (!isNativeAndroid()) return {};
  if (isNativePluginAvailable("CaronaaNative")) {
    try { return await bridge.permissionSetupStatus(); } catch { /* APK 1.1.0/1.1.1 */ }
  }
  // Old APKs do not expose native status for GPS, battery or channel.
  // Never manufacture a green check from opening settings.
  const status: SetupStatus = {};
  try {
    if (isNativePluginAvailable("LocalNotifications")) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const permission = (await LocalNotifications.checkPermissions()).display;
      if (permission !== "granted") status.notifications = false;
    }
  } catch { /* unknown */ }
  return status;
}

export async function openSetupSettings(target: SetupTarget): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try { await bridge.openPermissionSetupSettings({ target }); return true; }
  catch { return openNativeAppSettings(); }
}

export async function requestSetupGps(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try { await bridge.requestSetupLocation(); return true; }
  catch {
    // Older APK: show Android app settings; do not start or sample GPS to test a permission.
    return openSetupSettings("app");
  }
}

export async function requestSetupNotifications(driver: boolean): Promise<boolean> {
  if (!isNativeAndroid() || !isNativePluginAvailable("LocalNotifications")) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let display = (await LocalNotifications.checkPermissions()).display;
    if (display === "prompt" || display === "prompt-with-rationale") {
      display = (await LocalNotifications.requestPermissions()).display;
      if (display !== "granted") return true; // Respect refusal; settings remain available on a later tap.
    }
    if (display === "granted") {
      const status = await readSetupStatus();
      if (status.notifications === false) return openSetupSettings("notifications");
      if (driver) void refreshGrantedDriverAlerts().catch(() => undefined);
      // Older APKs cannot reliably detect disabled global notification switch on Android <13.
      if (status.notifications === undefined) return openSetupSettings("notifications");
      return true;
    }
    return openSetupSettings("notifications");
  } catch { return openSetupSettings("notifications"); }
}

export function setupSeenKey(userId: string, driver: boolean): string {
  return "caronaa:android-permission-setup:v1:" + userId + ":" + (driver ? "driver" : "passenger");
}

export function setupStatusLabel(value: boolean | undefined): string {
  return value === true ? "Ativo" : value === false ? "Pendente" : "Verificar nos ajustes";
}
