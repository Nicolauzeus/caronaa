import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const trip = readFileSync("src/routes/_authenticated/viagem.$rideId.tsx", "utf8");
const liveMap = readFileSync("src/components/caronaa/LiveRideMap.tsx", "utf8");
const qr = readFileSync("src/components/caronaa/RideQrModal.tsx", "utf8");
const scan = readFileSync("src/components/caronaa/RideQrScannerModal.tsx", "utf8");

describe("mobile trip and boarding UX contracts", () => {
  it("places live safety/map control ahead of secondary details on mobile", () => {
    expect(trip).toContain('className="order-1 lg:col-start-1');
    expect(trip).toContain('className="order-2 rounded-xl');
    expect(trip).toContain("Origem</span>");
    expect(trip).toContain("Destino</span>");
  });
  it("uses Google under modal layers with bounded GPS requests", () => {
    expect(liveMap).toContain("<GoogleMapSurface");
    expect(liveMap).toContain("fetchRoadRoute(");
    expect(liveMap).toContain("abort.abort()");
    expect(liveMap).toContain("toFixed(4)");
  });
  it("keeps boarding QR distinct from payment QR and relies on server confirmation", () => {
    expect(qr).toContain("caronaa:ride-confirm:");
    expect(qr).toContain("generateRideQrToken(rideId)");
    expect(scan).toContain("confirmRideByQr(tokenText)");
    expect(scan).not.toContain('status: "PAID"');
  });
});

