import { parseAndroidRelease } from "./android-release";

export function androidReleaseResponse(raw = process.env["CARONAA_ANDROID_RELEASE"]): Response {
  const headers = { "Cache-Control": "no-store" };
  let release = null;
  try {
    if (raw) release = parseAndroidRelease(JSON.parse(raw));
  } catch {
    // A malformed deployment variable must never advertise an incomplete release.
  }

  return release
    ? Response.json(release, { headers })
    : new Response(null, { status: 204, headers });
}
