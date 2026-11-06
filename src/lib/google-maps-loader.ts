let scriptPromise: Promise<void> | undefined;
let authenticationFailed = false;
const authListeners = new Set<() => void>();
let installed = false;

export function onGoogleMapsAuthFailure(listener: () => void) {
  authListeners.add(listener);
  if (!installed && typeof window !== "undefined") {
    installed = true;
    const previous = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      authenticationFailed = true;
      authListeners.forEach((notify) => notify());
      if (typeof previous === "function") previous();
    };
  }
  return () => {
    authListeners.delete(listener);
  };
}

export function loadGoogleMaps(browserKey: string): Promise<void> {
  if (!browserKey)
    return Promise.reject(new Error("Google Maps browser key missing"));
  if (typeof window === "undefined")
    return Promise.reject(new Error("Browser unavailable"));
  if (authenticationFailed)
    return Promise.reject(new Error("Google Maps authentication failed"));
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const callback = "__caronaaGoogleMapsLoaded";
    const script = document.createElement("script");
    let settled = false;
    const unsubscribe = onGoogleMapsAuthFailure(() =>
      finish(new Error("Google Maps authentication failed")),
    );
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      delete (window as any)[callback];
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    };
    const timeout = window.setTimeout(
      () => finish(new Error("Google Maps load timed out")),
      12000,
    );
    (window as any)[callback] = () =>
      (window as any).google?.maps?.Map
        ? finish()
        : finish(new Error("Google Maps JS missing after load"));
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(browserKey) +
      "&v=weekly&language=pt-BR&region=BR&callback=" +
      callback;
    script.async = true;
    script.onerror = () => finish(new Error("Google Maps load failed"));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}
