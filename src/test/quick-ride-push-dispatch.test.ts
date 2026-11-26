import { describe, it, expect, vi } from "vitest";
import { dispatchPushToEligibleDrivers, encryptAes128gcm, b64urlEncode, vapidAuthorization, type PushRepo } from "@/lib/quick-rides/quick-ride-push.server";

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
