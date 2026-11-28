export const ANDROID_APP_ID = "com.caronaa.app";
export const ANDROID_RELEASE_ENDPOINT = "/api/native/android-release";

export type AndroidRelease = {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
};

export function parseAndroidVersionCode(value: unknown): number | null {
  const code = typeof value === "string" && /^[1-9][0-9]{0,9}$/.test(value) ? Number(value) : value;
  return typeof code === "number" && Number.isInteger(code) && code > 0 && code <= 2_100_000_000
    ? code
    : null;
}

export function parseAndroidRelease(value: unknown): AndroidRelease | null {
  if (!value || typeof value !== "object") return null;
  const { versionCode, versionName, downloadUrl } = value as Partial<AndroidRelease>;
  const code = parseAndroidVersionCode(versionCode);
  if (
    code === null ||
    typeof versionName !== "string" ||
    !/^[0-9][0-9A-Za-z.+-]{0,39}$/.test(versionName) ||
    typeof downloadUrl !== "string"
  ) {
    return null;
  }

  try {
    const url = new URL(downloadUrl);
    // A dedicated download origin hands navigation off from the WebView to Android.
    if (
      url.origin !== "https://downloads.caronaa.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/android\/[a-zA-Z0-9._-]+\.apk$/.test(url.pathname)
    ) {
      return null;
    }
    return { versionCode: code, versionName, downloadUrl: url.href };
  } catch {
    return null;
  }
}
