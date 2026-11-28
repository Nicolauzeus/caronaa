// FCM HTTP v1 server-only implementation for Worker/Node runtimes.
import { resolveCorridorMunicipality } from "./corridor-coverage";
// No Firebase private key or OAuth access token is ever shipped to the APK.
export type FcmTokenRow = { userId: string; token: string; updatedAt: string; rideActions?: boolean };
export type FcmResult = { status: number; unregistered: boolean };
export type FcmRideAlert = {
  vehicleType: "CAR" | "MOTO"; fareCents: number | null; distanceKm: number; expiresAtMs?: number;
  driverEarningsCents?: number | null; originCity?: string | null; destinationCity?: string | null;
};
export type FcmSender = (row: FcmTokenRow, rideId: string, alert: FcmRideAlert) => Promise<FcmResult>;
type FcmConfig = { projectId: string; clientEmail: string; privateKey: string };
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const CHANNEL = "corridas_urgentes";
const encoder = new TextEncoder();

export function readFcmConfig(raw: string | undefined): FcmConfig | null {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    if (cfg?.type !== "service_account" ||
        typeof cfg.project_id !== "string" || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(cfg.project_id) ||
        typeof cfg.client_email !== "string" || !cfg.client_email.endsWith(".gserviceaccount.com") ||
        typeof cfg.private_key !== "string" || !cfg.private_key.includes("-----BEGIN PRIVATE KEY-----")) return null;
    return { projectId: cfg.project_id, clientEmail: cfg.client_email, privateKey: cfg.private_key };
  } catch { return null; }
}
function base64url(value: Uint8Array): string {
  let bytes = "";
  for (const byte of value) bytes += String.fromCharCode(byte);
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function segment(value: object) { return base64url(encoder.encode(JSON.stringify(value))); }

async function serviceAssertion(cfg: FcmConfig, now: number): Promise<string> {
  const pem = cfg.privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, {
    name: "RSASSA-PKCS1-v1_5", hash: "SHA-256",
  }, false, ["sign"]);
  const iat = Math.floor(now / 1000);
  const unsigned = segment({ alg: "RS256", typ: "JWT" }) + "." + segment({
    iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600,
  });
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return unsigned + "." + base64url(new Uint8Array(signature));
}

type Access = { value: string; expiresAt: number };
let cache: { config: FcmConfig; access: Promise<Access> } | undefined;
function sameConfig(a: FcmConfig, b: FcmConfig) {
  return a.projectId === b.projectId && a.clientEmail === b.clientEmail && a.privateKey === b.privateKey;
}
async function getAccess(cfg: FcmConfig, fetcher: typeof fetch, now: () => number): Promise<Access> {
  if (cache && sameConfig(cache.config, cfg)) {
    const old = cache;
    try {
      const token = await old.access;
      if (token.expiresAt > now() + 60_000) return token;
    } catch { /* retry failed refresh */ }
    if (cache === old) cache = undefined;
    else return getAccess(cfg, fetcher, now);
  }
  const access = (async () => {
    const assertion = await serviceAssertion(cfg, now());
    const response = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("fcm_oauth_failed");
    const body = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string" || !body.access_token ||
        typeof body.expires_in !== "number" || !Number.isFinite(body.expires_in) || body.expires_in <= 60)
      throw new Error("fcm_oauth_invalid");
    return { value: body.access_token, expiresAt: now() + Math.min(body.expires_in, 3600) * 1000 };
  })();
  const entry = { config: cfg, access };
  cache = entry;
  try { return await access; }
  catch { if (cache === entry) cache = undefined; throw new Error("fcm_oauth_failed"); }
}
export function __resetFcmAccessForTests() { cache = undefined; }

/** Only a provider-confirmed retired/invalid registration token is removable.
 * An ambiguous 400/404, invalid payload, auth, quota or network error is not proof.
 */
export function isUnregisteredFcmResponse(status: number, body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const error = (body as { error?: { message?: unknown; details?: unknown } }).error;
  const details = error?.details;
  if (!Array.isArray(details)) return false;
  const code = (value: string) => details.some(detail =>
    detail?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError" && detail?.errorCode === value);
  if ((status === 404 || status === 410) && code("UNREGISTERED")) return true;
  // FCM documents INVALID_ARGUMENT for several unrelated errors. Require its
  // explicit invalid-registration-token message as well as the typed code.
  return status === 400 && code("INVALID_ARGUMENT") &&
    typeof error?.message === "string" &&
    /^The registration token is not a valid FCM registration token\.?$/i.test(error.message);
}

function remainingTtl(alert: FcmRideAlert, now: number): number {
  if (alert.expiresAtMs === undefined) return 300;
  if (!Number.isFinite(alert.expiresAtMs)) return 0;
  return Math.max(0, Math.min(300, Math.floor((alert.expiresAtMs - now) / 1000)));
}

export function buildFcmRideMessage(token: string, rideId: string, alert: FcmRideAlert, now = Date.now()) {
  const minutes = Math.max(1, Math.round((alert.distanceKm / 30) * 60));
  const fare = alert.fareCents != null && Number.isSafeInteger(alert.fareCents) && alert.fareCents >= 0
    ? (alert.fareCents / 100).toFixed(2) : "";
  const kind = alert.vehicleType === "MOTO" ? "Moto" : "Carro";
  // A stale device token may outlive an offline logout. Send only a minimal
  // offer summary; exact pickup coordinates and passenger data are fetched
  // from the existing authenticated radar when the driver opens the app.
  return { message: {
    token,
    notification: {
      title: "Nova corrida CARONAA",
      body: [kind, fare ? "Valor estimado R$ " + fare.replace(".", ",") : null,
        "~" + minutes + " min até a origem"].filter(Boolean).join(" · ") + ". Toque para abrir.",
    },
    data: { route: "/home", url: "/home", kind: "flash_ride", rideId,
      vehicleType: alert.vehicleType, estimatedFare: fare, estimatedPickupMinutes: String(minutes) },
    android: {
      priority: "HIGH", ttl: remainingTtl(alert, now) + "s", restricted_package_name: "com.caronaa.app",
      notification: {
        channel_id: CHANNEL,
        // Android raw resources use the basename; Firebase Android SDK falls
        // back to the default sound if the resource is missing. On Android 8+
        // the channel and the user's settings take precedence.
        sound: "caronaa_ride_alert", notification_priority: "PRIORITY_MAX", visibility: "PRIVATE",
        vibrate_timings: ["0s", "0.5s", "0.25s", "0.5s"],
        tag: "caronaa-ride-" + rideId,
      },
    },
  } };
}

/** Only clients that explicitly advertise the native handler receive data-only FCM.
 * Municipality values come from verified persisted ride/quote fields, never address labels. */
export async function buildFcmActionMessage(row: FcmTokenRow, rideId: string, alert: FcmRideAlert, now = Date.now()) {
  const legacy = buildFcmRideMessage(row.token, rideId, alert, now).message;
  const ttl = remainingTtl(alert, now);
  const ownerHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(row.userId))), b => b.toString(16).padStart(2,"0")).join("");
  const valid = (c: unknown): c is number => typeof c === "number" && Number.isSafeInteger(c) && c >= 0;
  const city = (c: string | null | undefined) => resolveCorridorMunicipality(c, "CE", "BR")?.municipality ?? "";
  return { message: {
    token: row.token,
    data: { ...legacy.data, kind: "flash_ride_action_v1", ownerHash,
      expiresAtMs: String(now + ttl * 1000),
      originCity: city(alert.originCity), destinationCity: city(alert.destinationCity),
      driverEarnings: valid(alert.driverEarningsCents) ? (alert.driverEarningsCents / 100).toFixed(2) : "" },
    android: { priority: "HIGH", ttl: ttl + "s", restricted_package_name: "com.caronaa.app" },
  } };
}

export function createFcmSender(cfg: FcmConfig, deps: { fetch?: typeof fetch; now?: () => number } = {}): FcmSender {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  return async (row, rideId, alert) => {
    if (!remainingTtl(alert, now())) return { status: 0, unregistered: false };
    const access = await getAccess(cfg, fetcher, now);
    if (!remainingTtl(alert, now())) return { status: 0, unregistered: false };
    const response = await fetcher("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) + "/messages:send", {
      method: "POST",
      headers: { Authorization: "Bearer " + access.value, "Content-Type": "application/json" },
      body: JSON.stringify(row.rideActions === true
        ? await buildFcmActionMessage(row, rideId, alert, now())
        : buildFcmRideMessage(row.token, rideId, alert, now())),
      signal: AbortSignal.timeout(2500),
    });
    // Expired credentials may recover on the next dispatch; don't erase devices.
    if (response.status === 401 && cache && sameConfig(cache.config, cfg)) cache = undefined;
    if (response.ok) return { status: response.status, unregistered: false };
    let body: unknown = null;
    try { body = await response.json(); } catch { /* no raw provider errors in logs */ }
    return { status: response.status, unregistered: isUnregisteredFcmResponse(response.status, body) };
  };
}
