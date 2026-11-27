import { isNativeAndroid } from "@/lib/native/capacitor-bridge";

export async function registerPwa(): Promise<void> {
  if (isNativeAndroid() || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    // A tab left open across a deploy keeps requesting files the server replaced,
    // so look for the replacement as soon as the user comes back to it.
    const checkForUpdate = () => {
      try {
        void registration?.update?.()?.catch?.(() => {});
      } catch {
        // Checking for an update is best-effort.
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
  } catch (error) {
    console.warn("[PWA] Não foi possível registrar o service worker:", error);
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (isNativeAndroid() || !window.isSecureContext || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
