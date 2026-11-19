import { readNotificationSettings } from "./notification-settings";

/** Browser-generated tones: no audio asset download and no Google API calls. */
export type NotificationSound =
  | "request" | "confirmed" | "cancelled" | "message"
  | "order_incoming_loop" | "driver_arrived" | "ride_completed";

export const NOTIFICATION_NOTES: Record<NotificationSound, readonly number[]> = {
  request: [520, 650],
  confirmed: [523, 659, 783],
  cancelled: [440, 349],
  message: [800],
  order_incoming_loop: [587, 880],
  driver_arrived: [523, 659, 784],
  ride_completed: [698, 1046],
};

let context: AudioContext | undefined;
let audioPrimed = false;
let loopOwner: string | null = null;
let loopTimer: number | undefined;
let loopExpiry: number | undefined;
const loopOscillators = new Set<OscillatorNode>();
const lastPlayed = new Map<NotificationSound, number>();

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
      navigator.vibrate(pattern);
  } catch { /* iOS and restricted browser contexts may not support vibration. */ }
}

/** Status is read by the incoming-order UI to offer an explicit audio activation when needed. */
export function isNotificationAudioReady(): boolean {
  return typeof window !== "undefined" && context?.state === "running";
}

/**
 * Call synchronously from a deliberate user gesture (e.g. Ficar Online).
 * Prime the Safari audio graph with an inaudible oscillator; this is not a queued
 * notification. A suspended context must never defer a real chime until a later tap.
 */
export async function unlockNotificationAudio(): Promise<void> {
  if (typeof window === "undefined" || !readNotificationSettings().soundEnabled) return;
  try {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Audio = win.AudioContext || win.webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    const ctx = context;
    if (!audioPrimed) {
      audioPrimed = true;
      const oscillator = context.createOscillator();
      const silence = context.createGain();
      silence.gain.value = 0;
      oscillator.connect(silence);
      silence.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        silence.disconnect();
      };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.03);
    }
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    /* Mobile autoplay or an unavailable audio device must never block a trip. */
  }
}

function scheduleTone(
  audio: AudioContext, frequency: number, start: number, duration: number,
  peak: number, waveform: OscillatorType, incoming: boolean,
): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + (incoming ? 0.012 : 0.018));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  if (incoming) loopOscillators.add(oscillator);
  oscillator.onended = () => {
    loopOscillators.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

/** Plays a one-shot cue; loopOwnerId prevents a stopped offer sounding after resume(). */
export async function playNotificationSound(
  type: NotificationSound, loopOwnerId?: string,
): Promise<void> {
  if (!readNotificationSettings().soundEnabled) return;
  const now = Date.now();
  if (type !== "order_incoming_loop" && now - (lastPlayed.get(type) ?? 0) < 700) return;
  // Do not await AudioContext.resume() here. Mobile browsers may keep that
  // promise pending until the driver's next touch (e.g. Recusar), causing
  // a notification to play seconds or minutes after it was received.
  if (type === "order_incoming_loop" && loopOwnerId !== loopOwner) return;
  if (!readNotificationSettings().soundEnabled) return;
  if (typeof window === "undefined" || document.visibilityState === "hidden") return;

  // Haptics remain a graceful enhancement: never assume Safari supports them.
  if (type === "order_incoming_loop") vibrate([250, 100, 250, 100, 400]);
  else if (type === "driver_arrived") vibrate([150, 80, 150]);
  else if (type === "ride_completed") vibrate([200]);

  if (!isNotificationAudioReady() || !context) return;
  try {
    const incoming = type === "order_incoming_loop";
    const completed = type === "ride_completed";
    const arrival = type === "driver_arrived";
    const startAt = context.currentTime + 0.008;
    const interval = incoming ? 0.17 : arrival ? 0.135 : completed ? 0.17 : 0.14;
    const duration = incoming ? 0.145 : completed ? 0.45 : arrival ? 0.34 : 0.3;
    NOTIFICATION_NOTES[type].forEach((frequency, index) => {
      const start = startAt + index * interval;
      scheduleTone(context!, frequency, start, duration,
        incoming ? 0.095 : completed ? 0.055 : arrival ? 0.063 : 0.07,
        "sine", incoming);
      // Quiet triangle component increases intelligibility through road/helmet noise.
      if (incoming) scheduleTone(context!, frequency, start, duration, 0.032, "triangle", true);
    });
    if (!incoming) lastPlayed.set(type, now);
  } catch {
    /* Audio failure must not interrupt dispatch, navigation or payment. */
  }
}

/** At most one incoming-offer ringtone at a time; ownership is scoped to offer ID. */
export function startLoop(orderId: string, expiresAtMs: number): void {
  if (typeof window === "undefined" || !orderId || !readNotificationSettings().soundEnabled) return;
  if (loopOwner === orderId) return;
  stopLoop();
  const now = Date.now();
  const expiry = Math.min(Number.isFinite(expiresAtMs) ? expiresAtMs : now + 30_000, now + 30_000);
  if (expiry <= now) return;
  loopOwner = orderId;
  const tick = () => {
    if (loopOwner !== orderId) return;
    if (Date.now() >= expiry || !readNotificationSettings().soundEnabled) {
      stopLoop(orderId);
      return;
    }
    void playNotificationSound("order_incoming_loop", orderId);
  };
  tick();
  loopTimer = window.setInterval(tick, 1_800);
  loopExpiry = window.setTimeout(() => stopLoop(orderId), Math.max(0, expiry - now));
}

/** Cancel haptics and every scheduled incoming oscillator immediately on answer/unmount. */
export function stopLoop(orderId?: string): void {
  if (orderId && loopOwner !== orderId) return;
  loopOwner = null;
  if (loopTimer !== undefined) clearInterval(loopTimer);
  if (loopExpiry !== undefined) clearTimeout(loopExpiry);
  loopTimer = undefined;
  loopExpiry = undefined;
  for (const oscillator of loopOscillators) {
    try { oscillator.stop(); } catch { /* Already stopped. */ }
  }
  loopOscillators.clear();
  vibrate(0);
}
