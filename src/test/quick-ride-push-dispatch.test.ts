import { describe, it, expect, vi } from "vitest";
import { dispatchPushToEligibleDrivers, dispatchRidePushChannels, supabaseFcmRepo, encryptAes128gcm, b64urlEncode, vapidAuthorization, type PushRepo, type FcmRepo } from "@/lib/quick-rides/quick-ride-push.server";

const origin = { lat: -3.7319, lng: -38.5267 };
function repo(over: Partial<PushRepo> = {}): PushRepo & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    onlineDriversSince: async () => [
      { userId: "near-car", lat: -3.74, lng: -38.53 },
      { userId: "near-moto", lat: -3.735, lng: -38.52 },
      { userId: "far-car", lat: -4.2, lng: -38.53 }, // ~52 km
    ],
    approvedDrivers: async (ids, vt) => ids.filter((id) => (vt === "CAR" ? id.endsWith("car") : id.endsWith("moto"))),
    subscriptions: async (ids) => ids.flatMap((id) => [{ userId: id, endpoint: `https://push.test/${id}`, p256dh: "k", auth: "a" }]),
    deleteSubscription: async (e) => { deleted.push(e); },
    ...over,
  };
}
const input = { rideId: "r1", originLat: origin.lat, originLng: origin.lng, vehicleType: "CAR" as const, fareCents: 1443 };

describe("F07 push dispatch", () => {
  it("notifies only nearby drivers with matching vehicle type", async () => {
    const send = vi.fn(async () => ({ status: 201 }));
    const r = await dispatchPushToEligibleDrivers(input, { repo: repo(), send });
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0] as any)[0].userId).toBe("near-car");
    const payload = JSON.parse((send.mock.calls[0] as any)[1]);
    expect(payload.body).toContain("R$ 14,43");
    expect(payload.data.orderId).toBe("r1");
    expect(r).toEqual({ eligible: 1, sent: 1, failed: 0, removed: 0 });
  });

  it("asks for the last known location of available drivers within 60 minutes", async () => {
    const since = vi.fn(async () => []);
    await dispatchPushToEligibleDrivers(input, { repo: repo({ onlineDriversSince: since }), send: vi.fn(), now: () => 1_000_000_000 });
    expect(since).toHaveBeenCalledWith(new Date(1_000_000_000 - 3_600_000).toISOString());
  });

  it("removes 410/404 subscriptions and tolerates delivery errors", async () => {
    const rp = repo({
      onlineDriversSince: async () => [1, 2, 3].map((i) => ({ userId: `d${i}car`, lat: origin.lat, lng: origin.lng })),
    });
    const send = vi.fn(async (s: any) => {
      if (s.userId === "d1car") return { status: 410 };
      if (s.userId === "d2car") throw new Error("network");
      return { status: 201 };
    });
    const r = await dispatchPushToEligibleDrivers(input, { repo: rp, send });
    expect(rp.deleted).toEqual(["https://push.test/d1car"]);
    expect(r).toEqual({ eligible: 3, sent: 1, failed: 2, removed: 1 });
  });

  it("encrypts per RFC 8291 and signs VAPID with WebCrypto", async () => {
    const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const p256dh = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey)));
    const body = await encryptAes128gcm("{}", p256dh, b64urlEncode(crypto.getRandomValues(new Uint8Array(16))));
    expect(body[20]).toBe(65);
    expect(body.length).toBe(16 + 4 + 1 + 65 + 3 + 16);
    const v = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", v.privateKey);
    const pub = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", v.publicKey)));
    const h = await vapidAuthorization("https://fcm.googleapis.com/x", pub, jwk.d!, "suporte@caronaa.com");
    expect(h).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  });
});

describe("F07 combined Web Push + FCM", () => {
  const token = { userId: "near-car", token: "synthetic-token", updatedAt: "2026-11-27T00:00:00Z" };
  function setup() {
    const webRepo = repo();
    const onlineDriversSince = vi.fn(webRepo.onlineDriversSince);
    const approvedDrivers = vi.fn(webRepo.approvedDrivers);
    const eligibility = { onlineDriversSince, approvedDrivers };
    const fcmRepo: FcmRepo = {
      ...eligibility, tokens: vi.fn(async () => [token, token,
        { ...token, userId: "far-car", token: "outside" },
        { ...token, userId: "near-moto", token: "wrong-vehicle" }]),
      deleteToken: vi.fn(async () => true),
    };
    const web = vi.fn(async () => ({ status: 201 }));
    const fcm = vi.fn(async () => ({ status: 200, unregistered: false }));
    return { eligibility, webRepo, fcmRepo, web, fcm, deps: {
      repo: eligibility, web: { repo: webRepo, send: web }, fcm: { repo: fcmRepo, send: fcm },
      now: () => 1_000_000_000,
    } };
  }
  it("shares one 15 km / 60 min eligibility snapshot and sends both channels", async () => {
    const x = setup();
    const result = await dispatchRidePushChannels(input, x.deps);
    expect(x.eligibility.onlineDriversSince).toHaveBeenCalledExactlyOnceWith(new Date(1_000_000_000 - 3_600_000).toISOString());
    expect(x.eligibility.approvedDrivers).toHaveBeenCalledExactlyOnceWith(["near-car", "near-moto"], "CAR");
    expect(x.web).toHaveBeenCalledTimes(1);
    expect(x.fcmRepo.tokens).toHaveBeenCalledWith(["near-car"]);
    expect(x.fcm).toHaveBeenCalledExactlyOnceWith(token, input.rideId, expect.objectContaining({
      vehicleType: "CAR", fareCents: 1443, distanceKm: expect.any(Number),
    }));
    expect(result.web).toMatchObject({ status: "fulfilled", value: { eligible: 1, sent: 1, failed: 0 } });
    expect(result.fcm).toMatchObject({ status: "fulfilled", value: { eligible: 1, sent: 1, failed: 0 } });
  });
  it("still dispatches FCM when the Web Push subscription query fails", async () => {
    const x = setup();
    x.webRepo.subscriptions = async () => { throw new Error("web unavailable"); };
    const result = await dispatchRidePushChannels(input, x.deps);
    expect(result.web.status).toBe("rejected");
    expect(result.fcm).toMatchObject({ status: "fulfilled", value: { sent: 1 } });
  });
  it("still dispatches Web Push when the FCM token query fails", async () => {
    const x = setup();
    x.fcmRepo.tokens = async () => { throw new Error("fcm unavailable"); };
    const result = await dispatchRidePushChannels(input, x.deps);
    expect(result.fcm.status).toBe("rejected");
    expect(result.web).toMatchObject({ status: "fulfilled", value: { sent: 1 } });
  });
  it("runs FCM without VAPID and Web Push without Firebase", async () => {
    const x = setup();
    const native = await dispatchRidePushChannels(input, { ...x.deps, web: undefined });
    expect(native.web).toEqual({ status: "fulfilled", value: null });
    expect(native.fcm).toMatchObject({ status: "fulfilled", value: { sent: 1 } });
    const browser = await dispatchRidePushChannels(input, { ...x.deps, fcm: undefined });
    expect(browser.fcm).toEqual({ status: "fulfilled", value: null });
    expect(browser.web).toMatchObject({ status: "fulfilled", value: { sent: 1 } });
  });
  it("does not query drivers or send alerts when the 30 minute request has expired", async () => {
    const x = setup();
    await dispatchRidePushChannels({ ...input, expiresAtMs: 1_000_000_000 }, x.deps);
    expect(x.eligibility.onlineDriversSince).not.toHaveBeenCalled();
    expect(x.web).not.toHaveBeenCalled();
    expect(x.fcm).not.toHaveBeenCalled();
  });
  it("counts conditional token cleanup only if the observed row was removed", async () => {
    const x = setup();
    x.fcm.mockResolvedValue({ status: 404, unregistered: true });
    x.fcmRepo.deleteToken = vi.fn(async () => false);
    const result = await dispatchRidePushChannels(input, x.deps);
    expect(x.fcmRepo.deleteToken).toHaveBeenCalledExactlyOnceWith(token);
    expect(result.fcm).toMatchObject({ status: "fulfilled", value: { failed: 1, removed: 0 } });
    expect(result.web).toMatchObject({ status: "fulfilled", value: { sent: 1 } });
  });
  it("queries only Android tokens of active driver profiles and uses conditional service-role cleanup", async () => {
    const profile = { select: vi.fn(), in: vi.fn(), eq: vi.fn(async () => ({ data: [{ id: "near-car" }], error: null })) };
    profile.select.mockReturnValue(profile); profile.in.mockReturnValue(profile);
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(async () => ({ data: [
      { user_id: token.userId, token: token.token, updated_at: token.updatedAt },
    ], error: null })) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const cleanup = { eq: vi.fn(), select: vi.fn(async () => ({ data: [{ id: "row-id" }], error: null })) };
    cleanup.eq.mockReturnValue(cleanup);
    const from = vi.fn((table: string) => table === "profiles" ? profile : { ...query, delete: () => cleanup });
    const db = supabaseFcmRepo({ from });
    expect(await db.tokens(["near-car", "near-moto"])).toEqual([token]);
    expect(profile.eq).toHaveBeenCalledWith("active_role", "MOTORISTA");
    expect(query.eq).toHaveBeenCalledWith("platform", "android");
    expect(query.in).toHaveBeenCalledWith("user_id", ["near-car"]);
    expect(await db.deleteToken(token)).toBe(true);
    expect(cleanup.eq.mock.calls).toEqual([
      ["token", token.token], ["user_id", token.userId], ["updated_at", token.updatedAt], ["platform", "android"],
    ]);
  });
});
