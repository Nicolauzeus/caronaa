export async function registerPwa(): Promise<void> {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch (error) {
    console.warn("[PWA] Não foi possível registrar o service worker:", error);
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!window.isSecureContext || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
