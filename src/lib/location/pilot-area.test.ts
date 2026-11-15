import { describe, expect, it } from "vitest";
import { matchPilotArea } from "./pilot-area";
const areas = [
  { municipality: "Fortaleza", state: "CE", region: "FORTALEZA_CORRIDOR", center_lat: -3.731862, center_lng: -38.52667, radius_km: 22 },
  { municipality: "Redenção", state: "CE", region: "MACICO_BATURITE", center_lat: -4.225278, center_lng: -38.730278, radius_km: 18 },
  { municipality: "Acarape", state: "CE", region: "MACICO_BATURITE", center_lat: -4.2212, center_lng: -38.7078, radius_km: 12 },
];
describe("matchPilotArea", () => {
  it("Fortaleza", () => expect(matchPilotArea(-3.73, -38.52, areas)?.municipality).toBe("Fortaleza"));
  it("Redenção wins overlap by nearest centre", () => expect(matchPilotArea(-4.2253, -38.7303, areas)?.municipality).toBe("Redenção"));
  it("Acarape wins overlap by nearest centre", () => expect(matchPilotArea(-4.2212, -38.7078, areas)?.municipality).toBe("Acarape"));
  it("outside pilot → null", () => expect(matchPilotArea(-23.55, -46.63, areas)).toBeNull());
});
