import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rides = readFileSync("src/lib/rides.functions.ts", "utf8");
const detail = readFileSync("src/routes/_authenticated/minha-carona.$offerId.tsx", "utf8");
const profile = readFileSync("src/routes/_authenticated/perfil.tsx", "utf8");
const publication = readFileSync("src/routes/_authenticated/oferecer.tsx", "utf8");

describe("driver offer visibility and default vehicle", () => {
  it("identifies owned offers as driver rows even without passengers", () => {
    expect(rides).toContain('role: String(r["user_id"]) === viewerUserId ? "driver" : "available"');
    expect(rides).not.toContain("matchedOfferIds.has");
  });
  it("uses the driver's full offer for details rather than a passenger segment", () => {
    expect(detail).toContain('items.find((item) => item.kind === "offer")');
  });
  it("loads and saves registration only on the owner's profile and reuses the vehicle", () => {
    expect(profile).toContain("vehicle_plate: normalizedPlate || null");
    expect(publication).toContain('select("vehicle_description, vehicle_brand, vehicle_plate")');
    expect(rides).not.toContain("vehicle_plate");
  });
});