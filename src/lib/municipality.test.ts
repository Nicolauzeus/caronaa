import { describe, expect, it } from "vitest";
import { municipalityFromGoogle } from "./municipality";
const place = { id: "ChIJ_city", types: ["administrative_area_level_2"], addressComponents: [
  { longText: "Redenção", types: ["administrative_area_level_2"] },
  { shortText: "CE", types: ["administrative_area_level_1"] },
  { shortText: "BR", types: ["country"] },
] };
describe("Google municipality selection", () => {
  it("uses the municipality component rather than typed text", () => expect(municipalityFromGoogle(place)).toEqual({ placeId: "ChIJ_city", name: "Redenção", state: "CE" }));
  it("rejects establishments even with city components", () => expect(municipalityFromGoogle({ ...place, types: ["university"] })).toBeNull());
  it("rejects foreign municipalities", () => expect(municipalityFromGoogle({ ...place, addressComponents: [...place.addressComponents.slice(0, 2), { shortText: "PT", types: ["country"] }] })).toBeNull());
  it("rejects missing geographic components", () => expect(municipalityFromGoogle({ ...place, addressComponents: [] })).toBeNull());
});