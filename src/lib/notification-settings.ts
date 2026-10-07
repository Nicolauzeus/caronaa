export type NotificationSettings = { soundEnabled: boolean; pushEnabled: boolean };
export const NOTIFICATION_CONFIG_KEY = "caronaa-notifications-config";
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  pushEnabled: false,
};

export function readNotificationSettings(): NotificationSettings {
  try {
    if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
    const value = JSON.parse(window.localStorage.getItem(NOTIFICATION_CONFIG_KEY) ?? "null");
    return {
      soundEnabled: typeof value?.soundEnabled === "boolean" ? value.soundEnabled : true,
      pushEnabled: typeof value?.pushEnabled === "boolean" ? value.pushEnabled : false,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}
