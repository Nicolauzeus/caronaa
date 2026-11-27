// FCM HTTP v1 server-only implementation for Worker/Node runtimes.
// No Firebase private key or OAuth access token is ever shipped to the APK.
export type FcmTokenRow = { userId: string; token: string; updatedAt: string };
export type FcmResult = { status: number; unregistered: boolean };
export type FcmSender = (row: FcmTokenRow, rideId: string) => Promise<FcmResult>;
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

/** Only an explicit Firebase UNREGISTERED error is a token revocation.
 * Generic HTTP 404/410, auth, quota or malformed payload errors are not proof.
 */
export function isUnregisteredFcmResponse(status: number, body: unknown): boolean {
  if (status !== 404 && status !== 410) return false;
  if (!body || typeof body !== "object") return false;
  const details = (body as { error?: { details?: unknown } }).error?.details;
  return Array.isArray(details) && details.some(detail =>
    detail?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError" &&
    detail?.errorCode === "UNREGISTERED");
}

export function buildFcmRideMessage(token: string, rideId: string) {
  // No passenger name, address, fare, GPS or other private ride contents in OS
  // notifications. An offline logout cannot guarantee immediate revocation.
  return { message: {
    token,
    notification: { title: "CARONAA", body: "Há uma nova oportunidade de corrida. Abra o aplicativo para consultar." },
    data: { route: "/disponibilidade-profissional", kind: "flash_ride" },
    android: {
      priority: "HIGH", ttl: "300s", restricted_package_name: "com.caronaa.app",
      notification: {
        channel_id: CHANNEL, sound: "caronaa_ride_alert",
        notification_priority: "PRIORITY_HIGH", visibility: "PRIVATE",
        tag: "caronaa-ride-" + rideId,
      },
    },
  } };
}

export function createFcmSender(cfg: FcmConfig, deps: { fetch?: typeof fetch; now?: () => number } = {}): FcmSender {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  return async (row, rideId) => {
    const access = await getAccess(cfg, fetcher, now);
    const response = await fetcher("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) + "/messages:send", {
      method: "POST",
      headers: { Authorization: "Bearer " + access.value, "Content-Type": "application/json" },
      body: JSON.stringify(buildFcmRideMessage(row.token, rideId)),
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
