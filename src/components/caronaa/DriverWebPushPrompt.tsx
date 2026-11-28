import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isNativeAndroid } from "@/lib/native/capacitor-bridge";
import type { DriverAlertResult } from "@/lib/native/driver-notifications";
import { isWebPushSupported, needsIOSHomeScreen, subscribeDriverToPush, type PushSubscribeResult } from "@/lib/push/web-push-client";
import { DriverWebPushStatus } from "./DriverWebPushStatus";

export const WEB_PUSH_SETUP_EVENT = "caronaa:web-push-setup";
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const dismissedInMemory = new Map<string, number>();
const dismissKey = (userId: string) => `caronaa:web-push-invitation:${userId}`;

/** The app explains the choice before the browser's required permission prompt. */
export function openDriverWebPushPrompt() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WEB_PUSH_SETUP_EVENT));
}

function isDeferred(userId: string) {
  let until = dismissedInMemory.get(userId) ?? 0;
  try { until = Math.max(until, Number(localStorage.getItem(dismissKey(userId))) || 0); } catch { /* Storage may be disabled. */ }
  return until > Date.now();
}

function defer(userId: string) {
  const until = Date.now() + SNOOZE_MS;
  dismissedInMemory.set(userId, until);
  try { localStorage.setItem(dismissKey(userId), String(until)); } catch { /* Keep the session choice. */ }
}

/** Mounted once by the authenticated shell for the database-confirmed driver role. */
export function DriverWebPushPrompt({ userId, automatic = true }: { userId: string; automatic?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DriverAlertResult | null>(null);
  const activate = useRef<() => void>(() => {});
  const dismiss = useRef<() => void>(() => {});

  useEffect(() => {
    if (!userId || isNativeAndroid()) return;
    let alive = true;
    let running = false;
    let manual = false;
    let saved = false;
    let lastRefresh = -Infinity;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    setVisible(false); setResult(null); setPending(false);

    const setup = (fromTap: boolean) => {
      if (!alive || running) return;
      // Resume/login may reconcile an earlier grant, but never ask permission.
      if (!fromTap && (typeof Notification === "undefined" || Notification.permission !== "granted")) return;
      if (fromTap) { manual = true; setVisible(true); }
      running = true; setPending(true);
      // Invoke immediately from the tap: no awaited work before browser consent.
      void subscribeDriverToPush().catch((): PushSubscribeResult => ({ ok: false, reason: "SAVE_FAILED" }))
        .then(outcome => {
          if (!alive) return;
          saved = outcome.ok;
          setResult(outcome.ok ? { ok: true, remote: "web" } : outcome);
          if (outcome.ok) {
            dismissedInMemory.delete(userId);
            try { localStorage.removeItem(dismissKey(userId)); } catch { /* Best effort. */ }
            setVisible(manual);
            if (manual) {
              clearTimeout(closeTimer);
              closeTimer = setTimeout(() => { if (alive) { manual = false; setVisible(false); } }, 6000);
            }
          } else if (manual || (automatic && !isDeferred(userId))) setVisible(true);
        }).finally(() => { running = false; if (alive) setPending(false); });
    };

    const inspect = (force = false) => {
      if (!alive) return;
      if (force) { manual = true; setVisible(true); }
      if (needsIOSHomeScreen() || !isWebPushSupported()) {
        saved = false;
        setResult({ ok: false, reason: needsIOSHomeScreen() ? "INSTALL_REQUIRED" : "UNSUPPORTED" });
      } else if (Notification.permission === "granted") {
        setup(false);
        return;
      } else {
        saved = false;
        setResult(Notification.permission === "denied" ? { ok: false, reason: "DENIED" } : null);
      }
      setVisible(force || (automatic && !isDeferred(userId)));
    };
    activate.current = () => setup(true);
    dismiss.current = () => {
      if (running) return;
      if (!saved) defer(userId);
      manual = false; clearTimeout(closeTimer); setVisible(false);
    };
    const open = () => inspect(true);
    const resume = () => {
      if (document.hidden || Date.now() - lastRefresh < 1500) return;
      lastRefresh = Date.now(); inspect();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === dismissKey(userId) && isDeferred(userId) && !running) {
        manual = false; setVisible(false);
      }
    };
    window.addEventListener(WEB_PUSH_SETUP_EVENT, open);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", resume);
    inspect();
    return () => {
      alive = false; clearTimeout(closeTimer);
      activate.current = () => {}; dismiss.current = () => {};
      window.removeEventListener(WEB_PUSH_SETUP_EVENT, open);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [userId, automatic]);

  if (!visible || isNativeAndroid()) return null;
  return createPortal(<aside aria-label="Configurar alertas do CARONAA"
    className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[70] max-h-[calc(100dvh-7rem)] overflow-y-auto sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]">
    <DriverWebPushStatus result={result} pending={pending}
      onEnable={() => activate.current()} onDismiss={() => dismiss.current()}/>
  </aside>, document.body);
}
