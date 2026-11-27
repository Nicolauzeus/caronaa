import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { handleNativeDriverLocation } from "@/lib/native-driver-location.server";

const token = "fake.test.signature";
const fix = () => ({ lat: -3.85, lng: -38.58, accuracyM: 12, sampledAtMs: Date.now() });
const request = (payload: unknown, bearer = token) => new Request("https://caronaa.com/api/native/driver-location", {
  method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
function setup(role = "MOTORISTA") {
  const ping = vi.fn(async () => ({ data: true, error: null }));
  const profile = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { active_role: role }, error: null }) }) }) };
  const authenticate = vi.fn(async () => ({ userId: "driver-test", supabase: { from: () => profile, rpc: ping } as any }));
  const publish = vi.fn(async (): Promise<{ published: true; municipality: string }> => ({ published: true, municipality: "Maracanaú" }));
  return { authenticate, publish, ping };
}
describe("Native location HTTPS transport", () => {
  it("publishes a fresh real fix through the same authenticated server policy", async () => {
    const deps = setup();
    const payload = fix();
    expect((await handleNativeDriverLocation(request(payload), deps)).status).toBe(200);
    expect(deps.authenticate).toHaveBeenCalledWith(token);
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ userId: "driver-test" }), payload);
    expect(deps.ping).toHaveBeenCalledWith("driver_presence_ping");
  });
  it("does not accept userId, municipality, stale, coarse or malformed coordinates", async () => {
    const deps = setup();
    for (const payload of [{ ...fix(), userId:"other" }, { ...fix(), municipality:"Fortaleza" }, { ...fix(), accuracyM:151 }, { ...fix(), lat:91 }, { ...fix(), sampledAtMs:Date.now()-30000 }])
      expect((await handleNativeDriverLocation(request(payload), deps)).status).toBe(422);
    expect(deps.publish).not.toHaveBeenCalled();
  });
  it("blocks an invalid session or passenger role before GPS publication", async () => {
    const deps = setup("PASSAGEIRO");
    expect((await handleNativeDriverLocation(request(fix(), "invalid"), deps)).status).toBe(401);
    expect((await handleNativeDriverLocation(request(fix()), deps)).status).toBe(403);
    expect(deps.publish).not.toHaveBeenCalled();
  });
  it("maps revoked approval or explicit offline without reviving presence", async () => {
    const deps = setup();
    deps.publish.mockRejectedValueOnce(new Error("blocked [F07:ACCESS_NOT_AUTHORIZED]"));
    expect((await handleNativeDriverLocation(request(fix()), deps)).status).toBe(403);
    deps.publish.mockRejectedValueOnce(new Error("blocked [F07:DRIVER_OFFLINE]"));
    expect((await handleNativeDriverLocation(request(fix()), deps)).status).toBe(409);
    expect(deps.ping).not.toHaveBeenCalled();
  });
  it("does not log or expose raw provider failures", async () => {
    const deps = setup();
    deps.publish.mockRejectedValueOnce(new Error("private GPS data / token"));
    const result = await handleNativeDriverLocation(request(fix()), deps);
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ code: "LOCATION_UNAVAILABLE" });
  });
  it("keeps the native service private, non-sticky, foreground-only start and HTTPS", () => {
    const service = readFileSync("android/app/src/main/java/com/caronaa/app/CaronaaLocationService.java","utf8");
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml","utf8");
    const bridge = readFileSync("android/app/src/main/java/com/caronaa/app/CaronaaNativePlugin.java","utf8");
    const page = readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
    const home = readFileSync("src/hooks/use-flash-driver-presence.ts","utf8");
    expect(manifest).toMatch(/android:name="\.CaronaaLocationService"\s+android:exported="false"\s+android:foregroundServiceType="location"/);
    expect(service).toContain("START_NOT_STICKY");
    expect(service).toContain("Priority.PRIORITY_HIGH_ACCURACY");
    expect(service).toContain("if (uiForeground) return");
    expect(service).toContain("conn.setInstanceFollowRedirects(false)");
    expect(service).not.toContain("SharedPreferences");
    expect(bridge).toContain("CaronaaLocationService.isUiForeground()");
    expect(page).toContain("startNativeForegroundTracking(true)");
    expect(home).toContain("stopNativeForegroundTracking(true)");
  });
});
