import {
  ANDROID_APP_ID,
  ANDROID_RELEASE_ENDPOINT,
  parseAndroidRelease,
  parseAndroidVersionCode,
} from "./android-release";
import { isNativePluginAvailable } from "./capacitor-bridge";

export async function checkAndroidUpdate(signal: AbortSignal) {
  if (!isNativePluginAvailable("App")) return null;
  const { App } = await import("@capacitor/app");
  const installed = await App.getInfo();
  const installedCode = parseAndroidVersionCode(installed.build);
  if (installed.id !== ANDROID_APP_ID || installedCode === null || signal.aborted) return null;

  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 5000);
  try {
    const response = await fetch(ANDROID_RELEASE_ENDPOINT, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: request.signal,
    });
    if (response.status !== 200) return null;
    const release = parseAndroidRelease(await response.json());
    return release && release.versionCode > installedCode ? release : null;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
