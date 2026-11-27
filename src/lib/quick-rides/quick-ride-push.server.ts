// F07 Web Push and Android FCM dispatch: notifies online, nearby, vehicle-compatible drivers
// when a Flash ride enters SEARCHING. Uses WebCrypto (RFC 8291 aes128gcm +
// RFC 8292 VAPID) so it runs on the Worker runtime without Node crypto.
// Never logs coordinates, user IDs or endpoints.

import { createFcmSender, readFcmConfig, type FcmSender, type FcmTokenRow } from "./quick-ride-fcm.server";

export const PUSH_RADIUS_KM = 15;
// Wake-up push only: a locked phone stops sending GPS, so the last known fix of a
// driver still marked available counts for up to 60 min. The 90s cutoff stays
// for the public radar and dispatch acceptance.
export const PUSH_LOCATION_MAX_AGE_MS = 60 * 60 * 1000;

export type PushDispatchInput = {
  rideId: string; originLat: number; originLng: number;
  vehicleType: "CAR" | "MOTO"; fareCents: number | null;
};
export type OnlineDriver = { userId: string; lat: number; lng: number };
export type PushSubscriptionRow = { userId: string; endpoint: string; p256dh: string; auth: string };
export type PushRepo = {
  onlineDriversSince(sinceIso: string): Promise<OnlineDriver[]>;
  approvedDrivers(userIds: string[], vehicleType: string): Promise<string[]>;
  subscriptions(userIds: string[]): Promise<PushSubscriptionRow[]>;
  deleteSubscription(endpoint: string): Promise<void>;
};
export type PushSender = (sub: PushSubscriptionRow, payload: string) => Promise<{ status: number }>;
export type FcmRepo = Pick<PushRepo, "onlineDriversSince" | "approvedDrivers"> & {
  tokens(userIds: string[]): Promise<FcmTokenRow[]>;
  deleteToken(row: FcmTokenRow): Promise<void>;
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function buildRidePushPayload(input: PushDispatchInput, distanceKm: number) {
  const minutes = Math.max(1, Math.round((distanceKm / 30) * 60)); // ~30 km/h urban estimate
  const fare = input.fareCents != null && Number.isFinite(input.fareCents)
    ? `R$ ${(input.fareCents / 100).toFixed(2).replace(".", ",")}` : null;
  const kind = input.vehicleType === "MOTO" ? "Moto" : "Carro";
  return JSON.stringify({
    title: `Nova corrida ${kind} CARONAA`,
    body: [fare ? `Valor estimado ${fare}` : null, `~${minutes} min até a origem`].filter(Boolean).join(" · ") + ". Toque para abrir.",
    data: { url: "/home", orderId: input.rideId },
  });
}

async function eligiblePushDrivers(input: PushDispatchInput, repo: Pick<PushRepo, "onlineDriversSince" | "approvedDrivers">, now: number) {
  const near = new Map<string, number>();
  if (!Number.isFinite(input.originLat) || !Number.isFinite(input.originLng)) return near;
  const online = await repo.onlineDriversSince(new Date(now - PUSH_LOCATION_MAX_AGE_MS).toISOString());
  for (const d of online) {
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) continue;
    const km = haversineKm(input.originLat, input.originLng, d.lat, d.lng);
    if (km <= PUSH_RADIUS_KM) near.set(d.userId, km);
  }
  if (!near.size) return near;
  const approved = new Set(await repo.approvedDrivers([...near.keys()], input.vehicleType));
  for (const id of near.keys()) if (!approved.has(id)) near.delete(id);
  return near;
}

export async function dispatchPushToEligibleDrivers(
  input: PushDispatchInput,
  deps: { repo: PushRepo; send: PushSender; now?: () => number },
) {
  const result = { eligible: 0, sent: 0, failed: 0, removed: 0 };
  const near = await eligiblePushDrivers(input, deps.repo, deps.now?.() ?? Date.now());
  const ids = [...near.keys()];
  result.eligible = ids.length;
  if (!ids.length) return result;
  const subs = await deps.repo.subscriptions(ids);
  const outcomes = await Promise.allSettled(subs.map(async (s) => {
    const res = await deps.send(s, buildRidePushPayload(input, near.get(s.userId) ?? PUSH_RADIUS_KM));
    if (res.status === 404 || res.status === 410) {
      await deps.repo.deleteSubscription(s.endpoint);
      result.removed++;
      throw new Error("gone");
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`status ${res.status}`);
  }));
  for (const o of outcomes) o.status === "fulfilled" ? result.sent++ : result.failed++;
  return result;
}

/** Independent Android channel: only authenticated-role, nearby approved drivers.
 * FCM provider acceptance is not evidence of display or receipt.
 */
export async function dispatchFcmToEligibleDrivers(
  input: PushDispatchInput,
  deps: { repo: FcmRepo; send: FcmSender; now?: () => number },
) {
  const result = { eligible: 0, sent: 0, failed: 0, removed: 0 };
  const near = await eligiblePushDrivers(input, deps.repo, deps.now?.() ?? Date.now());
  const ids = [...near.keys()];
  result.eligible = ids.length;
  if (!ids.length) return result;
  const seen = new Set<string>();
  const tokens = (await deps.repo.tokens(ids)).filter(row => {
    if (!near.has(row.userId) || !row.token || seen.has(row.token)) return false;
    seen.add(row.token);
    return true;
  });
  // Bound fan-out; token/credential failures must not block other devices.
  let next = 0;
  const run = async () => {
    for (;;) {
      const row = tokens[next++];
      if (!row) return;
      try {
        const response = await deps.send(row, input.rideId);
        if (response.unregistered) {
          // Conditional deletion preserves a token refreshed/reassigned since lookup.
          await deps.repo.deleteToken(row);
          result.removed++;
          result.failed++;
        } else if (response.status >= 200 && response.status < 300) result.sent++;
        else result.failed++;
      } catch { result.failed++; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(tokens.length, 8) }, run));
  return result;
}

// ---------- Supabase repository ----------
export function supabasePushRepo(db: any): PushRepo {
  return {
    async onlineDriversSince(since) {
      // Real driver GPS is published to professional_driver_locations by both
      // the Flash panel and the availability radar; flash presence alone misses the latter.
      const [locs, avail] = await Promise.all([
        db.from("professional_driver_locations").select("user_id,lat,lng").gte("sampled_at", since),
        db.from("professional_presence").select("user_id").eq("is_available", true),
      ]);
      if (locs.error || avail.error) throw new Error("presence");
      const online = new Set((avail.data ?? []).map((r: any) => r.user_id));
      return (locs.data ?? []).filter((r: any) => online.has(r.user_id))
        .map((r: any) => ({ userId: r.user_id, lat: Number(r.lat), lng: Number(r.lng) }));
    },
    async approvedDrivers(userIds, vehicleType) {
      const { data, error } = await db.from("professional_driver_authorizations")
        .select("user_id").in("user_id", userIds).eq("approved", true).eq("vehicle_type", vehicleType);
      if (error) throw new Error("authorizations");
      return (data ?? []).map((r: any) => r.user_id);
    },
    async subscriptions(userIds) {
      const { data, error } = await db.from("driver_push_subscriptions")
        .select("user_id,endpoint,p256dh,auth").in("user_id", userIds);
      if (error) throw new Error("subscriptions");
      return (data ?? []).map((r: any) => ({ userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
    },
    async deleteSubscription(endpoint) {
      await db.from("driver_push_subscriptions").delete().eq("endpoint", endpoint);
    },
  };
}

export function supabaseFcmRepo(db: any): FcmRepo {
  const base = supabasePushRepo(db);
  return {
    onlineDriversSince: base.onlineDriversSince,
    approvedDrivers: base.approvedDrivers,
    async tokens(userIds) {
      // An approved driver's account may currently be in passenger mode.
      // Resolve the actual database role, never trust notification payload or client metadata.
      const { data: profiles, error: roleError } = await db.from("profiles")
        .select("id").in("id", userIds).eq("active_role", "MOTORISTA");
      if (roleError) throw new Error("fcm_roles");
      const drivers = (profiles ?? []).map((row: any) => row.id);
      if (!drivers.length) return [];
      const { data, error } = await db.from("driver_fcm_tokens")
        .select("user_id,token,updated_at").eq("platform", "android").in("user_id", drivers);
      if (error) throw new Error("fcm_tokens");
      return (data ?? []).map((row: any) => ({
        userId: row.user_id, token: row.token, updatedAt: row.updated_at,
      }));
    },
    async deleteToken(row) {
      const { error } = await db.from("driver_fcm_tokens").delete()
        .eq("token", row.token).eq("user_id", row.userId).eq("updated_at", row.updatedAt);
      if (error) throw new Error("fcm_cleanup_failed");
    },
  };
}

// ---------- RFC 8291 / 8292 WebCrypto sender ----------
const enc = { encode: (s: string) => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer> };
type Bytes = Uint8Array<ArrayBuffer>;
export function b64urlDecode(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0)) as Bytes;
}
export function b64urlEncode(u: Uint8Array) {
  let s = ""; for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const concat = (...a: Uint8Array[]): Bytes => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, len: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}

export async function encryptAes128gcm(payload: string, p256dh: string, authSecret: string) {
  const uaPub = b64urlDecode(p256dh), auth = b64urlDecode(authSecret);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as any, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Bytes;
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

export async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  const pub = b64urlDecode(publicKey);
  const jwk = { kty: "EC", crv: "P-256", d: privateKey, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)) };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sub = /^(mailto:|https:)/.test(subject) ? subject : `mailto:${subject}`;
  const part = (o: object) => b64urlEncode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${publicKey}`;
}

export function createWebPushSender(cfg: { publicKey: string; privateKey: string; subject: string }): PushSender {
  return async (sub, payload) => {
    const body = await encryptAes128gcm(payload, sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization(sub.endpoint, cfg.publicKey, cfg.privateKey, cfg.subject),
        "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
        TTL: "300", Urgency: "high", Topic: "caronaa-ride",
      },
      body,
    });
    return { status: res.status };
  };
}

/** Best-effort dispatch for a newly created ride; never throws.
 * The two providers are independent, including credential setup and failures.
 */
export async function dispatchPushForQuickRide(rideId: string) {
  try {
    const publicKey = process.env["VAPID_PUBLIC_KEY"], privateKey = process.env["VAPID_PRIVATE_KEY"], subject = process.env["VAPID_SUBJECT"];
    const webConfigured = Boolean(publicKey && privateKey && subject);
    const fcm = readFcmConfig(process.env["FCM_SERVICE_ACCOUNT_JSON"]);
    if (!webConfigured) console.warn("[CARONAA][F07][PUSH] vapid_not_configured");
    if (!fcm) console.warn("[CARONAA][F07][PUSH] fcm_not_configured");
    if (!webConfigured && !fcm) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ride } = await (supabaseAdmin as any).from("professional_quick_rides")
      .select("id,origin_lat,origin_lng,vehicle_type,estimated_fare_cents,status,expires_at").eq("id", rideId).maybeSingle();
    if (!ride || ride.status !== "SEARCHING" || (ride.vehicle_type !== "CAR" && ride.vehicle_type !== "MOTO") ||
        !ride.expires_at || Date.parse(ride.expires_at) <= Date.now()) return;
    const input: PushDispatchInput = {
      rideId, originLat: Number(ride.origin_lat), originLng: Number(ride.origin_lng),
      vehicleType: ride.vehicle_type, fareCents: ride.estimated_fare_cents,
    };
    const tasks: Promise<void>[] = [];
    const report = (channel: "web" | "fcm", work: Promise<unknown>) => work.then(result => {
      // Aggregate provider acceptance only, never token, endpoint, user, coordinates or raw error.
      console.info("[CARONAA][F07][PUSH] dispatched", { channel, ...(result as object) });
    }).catch(() => { console.warn("[CARONAA][F07][PUSH] channel_failed", { channel }); });
    if (publicKey && privateKey && subject) tasks.push(report("web", dispatchPushToEligibleDrivers(input, {
      repo: supabasePushRepo(supabaseAdmin), send: createWebPushSender({ publicKey, privateKey, subject }),
    })));
    if (fcm) tasks.push(report("fcm", dispatchFcmToEligibleDrivers(input, {
      repo: supabaseFcmRepo(supabaseAdmin), send: createFcmSender(fcm),
    })));
    await Promise.allSettled(tasks);
  } catch {
    console.warn("[CARONAA][F07][PUSH] dispatch_failed");
  }
}
