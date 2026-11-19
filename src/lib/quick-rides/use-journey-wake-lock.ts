import { useEffect } from "react";

/**
 * Holds a Screen Wake Lock only while an active journey is visible.
 * Browsers may release it on screen lock/background/battery restrictions.
 * It must never be used as a replacement for server ride persistence.
 */
export function useJourneyWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;

    const acquire = async () => {
      if (disposed || pending || sentinel || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") {
          await next.release();
          return;
        }
        sentinel = next;
        next.addEventListener("release", () => {
          if (sentinel === next) sentinel = null;
        }, { once: true });
      } catch {
        // Unsupported or denied: navigation must continue normally.
      } finally {
        pending = false;
      }
    };

    const onResume = () => { if (!document.hidden) void acquire(); };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    void acquire();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      const current = sentinel;
      sentinel = null;
      if (current) void current.release().catch(() => {});
    };
  }, [enabled]);
}
