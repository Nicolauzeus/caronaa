import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchFcmToEligibleDrivers, type FcmRepo } from "@/lib/quick-rides/quick-ride-push.server";
import { buildFcmRideMessage, buildFcmActionMessage, isUnregisteredFcmResponse, readFcmConfig, createFcmSender, __resetFcmAccessForTests } from "@/lib/quick-rides/quick-ride-fcm.server";

const input = { rideId: "ride-1", originLat: -3.7319, originLng: -38.5267, vehicleType: "CAR" as const, fareCents: 1500 };
const alert = { vehicleType: "CAR" as const, fareCents: 1500, distanceKm: 1.5 };
const rows = [
  { userId: "driver-a", token: "test-a", updatedAt: "2026-11-27T00:00:00Z" },
  { userId: "driver-a", token: "test-b", updatedAt: "2026-11-27T00:00:00Z" },
  { userId: "outside", token: "test-outside", updatedAt: "2026-11-27T00:00:00Z" },
];
const retired = { error: { details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } };
function repo(): FcmRepo {
  return {
    onlineDriversSince: vi.fn(async () => [
      { userId: "driver-a", lat: -3.73, lng: -38.52 },
      { userId: "driver-moto", lat: -3.73, lng: -38.52 },
      { userId: "outside", lat: -4.5, lng: -38.5 },
    ]),
    approvedDrivers: vi.fn(async (ids: string[]) => ids.filter((id: string) => id === "driver-a")),
    tokens: vi.fn(async () => [...rows, rows[0]!]),
    deleteToken: vi.fn(async () => true),
  };
}
beforeEach(() => __resetFcmAccessForTests());
describe("native Android FCM dispatch", () => {
  it("sends once per Android device of a nearby approved driver", async () => {
    const db = repo();
    const send = vi.fn(async () => ({ status: 200, unregistered: false }));
    expect(await dispatchFcmToEligibleDrivers(input, { repo: db, send })).toEqual({ eligible: 1, sent: 2, failed: 0, removed: 0 });
    expect(db.approvedDrivers).toHaveBeenCalledWith(["driver-a", "driver-moto"], "CAR");
    expect(db.tokens).toHaveBeenCalledWith(["driver-a"]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).not.toHaveBeenCalledWith(rows[2], expect.anything(), expect.anything());
  });
  it("only deletes provider-confirmed retired tokens; other devices can still receive", async () => {
    const db = repo();
    const send = vi.fn(async (row: typeof rows[number]) => row.token === "test-a"
      ? { status: 404, unregistered: true } : { status: 503, unregistered: false });
    expect(await dispatchFcmToEligibleDrivers(input, { repo: db, send })).toEqual({ eligible: 1, sent: 0, failed: 2, removed: 1 });
    expect(db.deleteToken).toHaveBeenCalledTimes(1);
    expect(db.deleteToken).toHaveBeenCalledWith(rows[0]);
  });
  it("isolates network and cleanup failures", async () => {
    const db = repo();
    const send = vi.fn(async (row: typeof rows[number]) => {
      if (row.token === "test-a") throw Error("network");
      return { status: 200, unregistered: false };
    });
    expect(await dispatchFcmToEligibleDrivers(input, { repo: db, send })).toEqual({ eligible: 1, sent: 1, failed: 1, removed: 0 });
    expect(db.deleteToken).not.toHaveBeenCalled();
  });
  it("requires the typed UNREGISTERED error and never treats auth or generic 404 as revocation", () => {
    expect(isUnregisteredFcmResponse(404, retired)).toBe(true);
    expect(isUnregisteredFcmResponse(410, retired)).toBe(true);
    expect(isUnregisteredFcmResponse(404, { error: { status: "NOT_FOUND" } })).toBe(false);
    expect(isUnregisteredFcmResponse(403, retired)).toBe(false);
    expect(isUnregisteredFcmResponse(400, { error: { details: [{ errorCode: "INVALID_ARGUMENT" }] } })).toBe(false);
    expect(isUnregisteredFcmResponse(503, null)).toBe(false);
    const invalid = { error: { message: "The registration token is not a valid FCM registration token", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "INVALID_ARGUMENT" }] } };
    expect(isUnregisteredFcmResponse(400, invalid)).toBe(true);
    expect(isUnregisteredFcmResponse(400, { error: { ...invalid.error, message: "Invalid package name" } })).toBe(false);
  });
  it("builds high-priority private Android alerts without precise ride data", () => {
    const { message } = buildFcmRideMessage("test-a", input.rideId, alert);
    expect(message.android).toMatchObject({ priority: "HIGH", ttl: "300s", restricted_package_name: "com.caronaa.app",
      notification: { channel_id: "corridas_urgentes", visibility: "PRIVATE", sound: "caronaa_ride_alert", notification_priority: "PRIORITY_MAX" } });
    expect(message.notification.title).toBe("Nova corrida CARONAA");
    expect(message.notification.body).toContain("R$ 15,00");
    expect(message.notification.body).toContain("~3 min");
    expect(message.data).toEqual({ route: "/home", url: "/home", kind: "flash_ride", rideId: input.rideId,
      vehicleType: "CAR", estimatedFare: "15.00", estimatedPickupMinutes: "3" });
    expect(JSON.stringify(message)).not.toContain("originLat");
    expect(JSON.stringify(message)).not.toContain("originLng");
    expect(JSON.stringify(message)).not.toContain("fareCents");
    expect(buildFcmRideMessage("test-a", input.rideId, { ...alert, expiresAtMs: 61_000 }, 1000).message.android.ttl).toBe("60s");
  });
  it("builds data-only native action alerts with verified cities and no private addresses", async () => {
    const { message } = await buildFcmActionMessage({ ...rows[0]!, rideActions: true }, input.rideId,
      { ...alert, driverEarningsCents: 600, originCity: "Acarape", destinationCity: "Redenção", expiresAtMs: 61_000 }, 1000);
    expect(message).not.toHaveProperty("notification");
    expect(message.android).not.toHaveProperty("notification");
    expect(message.android.ttl).toBe("60s");
    expect(message.data).toMatchObject({ kind: "flash_ride_action_v1", originCity: "Acarape", destinationCity: "Redenção",
      driverEarnings: "6.00", estimatedFare: "15.00", expiresAtMs: "61000" });
    expect(message.data.ownerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(message)).not.toContain("driver-a");
    const invalid = await buildFcmActionMessage(rows[0]!, input.rideId, { ...alert, originCity: "Rua privada 42", destinationCity: "Fortaleza" }, 1000);
    expect(invalid.message.data.originCity).toBe("");
    expect(invalid.message.data.destinationCity).toBe("Fortaleza");
  });
  it("rejects missing/malformed service-account configuration", () => {
    expect(readFcmConfig(undefined)).toBeNull();
    expect(readFcmConfig("not JSON")).toBeNull();
    expect(readFcmConfig(JSON.stringify({type:"service_account", project_id:"../../wrong"}))).toBeNull();
  });
  it("exchanges a signed assertion once and sends HTTP v1 to the configured project", async () => {
    const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const key = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...der)) + "\n-----END PRIVATE KEY-----";
    const cfg = readFcmConfig(JSON.stringify({type:"service_account", project_id:"caronaa-test", client_email:"test@caronaa-test.iam.gserviceaccount.com", private_key:key}));
    expect(cfg).not.toBeNull();
    const fakeFetch = vi.fn(async (url: string, options: RequestInit) => {
      if (url === "https://oauth2.googleapis.com/token") {
        const assertion = new URLSearchParams(String(options.body)).get("assertion");
        expect(assertion?.split(".")).toHaveLength(3);
        return Response.json({access_token:"mock-access",expires_in:3600});
      }
      expect(url).toBe("https://fcm.googleapis.com/v1/projects/caronaa-test/messages:send");
      expect(new Headers(options.headers).get("authorization")).toBe("Bearer mock-access");
      return Response.json({name:"projects/caronaa-test/messages/test"});
    });
    const send = createFcmSender(cfg!, {fetch:fakeFetch as unknown as typeof fetch});
    await Promise.all([send(rows[0]!, input.rideId, alert), send(rows[1]!, input.rideId, alert)]);
    expect(fakeFetch.mock.calls.filter(c => c[0] === "https://oauth2.googleapis.com/token")).toHaveLength(1);
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });
});
