import { describe, expect, it } from "vitest";
import {
  resolveCorridorMunicipality, normalizeMunicipality, distanceBetweenMeters,
  insideApprovedActivityRadius,
} from "./corridor-coverage";

describe("CARONAA corridor from Fortaleza to Maciço", () => {
  it("accepts municipalities independent of the user's home/profile region", () => {
    expect(resolveCorridorMunicipality("Fortaleza","CE","BR")).toEqual({
      municipality:"Fortaleza",region:"FORTALEZA_CORRIDOR",
    });
    expect(resolveCorridorMunicipality("Maracanau","CE","BR")?.municipality).toBe("Maracanaú");
    expect(resolveCorridorMunicipality("PACATUBA","Ceará","Brasil")?.region).toBe("FORTALEZA_CORRIDOR");
    expect(resolveCorridorMunicipality("Guaiuba","CE","BR")?.municipality).toBe("Guaiúba");
    expect(resolveCorridorMunicipality("Redenção","CE","BR")?.region).toBe("MACICO_BATURITE");
    expect(resolveCorridorMunicipality("Baturité","CE","BR")?.region).toBe("MACICO_BATURITE");
  });

  it("normalizes accents and whitespace but not different states", () => {
    expect(normalizeMunicipality("  GUAIÚBA   ")).toBe("guaiuba");
    expect(resolveCorridorMunicipality("Fortaleza","SP","BR")).toBeNull();
    expect(resolveCorridorMunicipality("Fortaleza","CE","PT")).toBeNull();
    expect(resolveCorridorMunicipality("Fortaleza",null,"BR")).toBeNull();
    expect(resolveCorridorMunicipality("Belo Horizonte","MG","BR")).toBeNull();
    expect(resolveCorridorMunicipality("Maracanaú","CE",null)).toBeNull();
  });

  it("uses official activity radius, never just city or event title", () => {
    const center={lat:-4.22,lng:-38.71};
    expect(distanceBetweenMeters(center,center)).toBe(0);
    expect(insideApprovedActivityRadius(center,{
      center_lat:center.lat,center_lng:center.lng,radius_m:1000,
    })).toBe(true);
    expect(insideApprovedActivityRadius({lat:-4.28,lng:-38.71},{
      center_lat:center.lat,center_lng:center.lng,radius_m:1000,
    })).toBe(false);
    expect(insideApprovedActivityRadius(center,{
      center_lat:center.lat,center_lng:center.lng,radius_m:99999,
    })).toBe(false);
  });
});
