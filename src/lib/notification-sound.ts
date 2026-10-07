import { readNotificationSettings } from "./notification-settings";

export type NotificationSound = "request" | "confirmed" | "cancelled" | "message";
export const NOTIFICATION_NOTES: Record<NotificationSound, readonly number[]> = {
  request: [520, 650],
  confirmed: [523, 659, 783],
  cancelled: [440, 349],
  message: [800],
};
let context: AudioContext | undefined;

export async function unlockNotificationAudio(): Promise<void> {
  if (typeof window === "undefined" || !readNotificationSettings().soundEnabled) return;
  try {
    if (!window.AudioContext) return;
    context ??= new window.AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* Autoplay or audio device unavailable: visual alerts remain available. */
  }
}

export async function playNotificationSound(type: NotificationSound): Promise<void> {
  if (!readNotificationSettings().soundEnabled) return;
  await unlockNotificationAudio();
  if (!context || context.state !== "running" || !readNotificationSettings().soundEnabled) return;
  try {
    NOTIFICATION_NOTES[type].forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const start = context!.currentTime + index * 0.14;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  } catch {
    /* Audio failure must not interrupt ride operations. */
  }
}
