import { describe, expect, it } from "vitest";
import { municipalityFromProfessionalGps, professionalRadarPointSchema } from "./professional-radar-geo";

describe("F07: radar GPS independent of registered driver region", () => {
  it("accepts the operational municipality, not where the driver signed up", () => {
    // Profile region MACICO_BATURITE: a real GPS in Fortaleza is authorized
    // by the DB municipality flag, not blocked by the profile.
    expect(municipalityFromProfessionalGps({
      city: "FORTALEZA", state: "CE", country: "BR",
    })).toBe("Fortaleza");
    // Driver who registered in Fortaleza can drive in Redenção/Guaiúba.
    expect(municipalityFromProfessionalGps({
      city: "Redencao", state: "Ceará", country: "Brasil",
    })).toBe("Redenção");
    expect(municipalityFromProfessionalGps({
      city: "Guaiuba", state: "CE", country: "BR",
    })).toBe("Guaiúba");
  });

  it("covers the approved core CE-060 route", () => {
    for (const city of ["Maracanaú","Pacatuba","Guaiúba","Acarape","Redenção","Aracoiaba","Baturité"]) {
      expect(municipalityFromProfessionalGps({city,state:"CE",country:"BR"})).not.toBeNull();
    }
  });

  it("fails closed when Google does not identify Ceará/Brazil, or known municipality", () => {
    expect(municipalityFromProfessionalGps(null)).toBeNull();
    expect(municipalityFromProfessionalGps({city:"Fortaleza",state:"SP",country:"BR"})).toBeNull();
    expect(municipalityFromProfessionalGps({city:"Recife",state:"PE",country:"BR"})).toBeNull();
    expect(municipalityFromProfessionalGps({city:"Fortaleza",state:"CE",country:"AR"})).toBeNull();
    expect(municipalityFromProfessionalGps({city:"Itaitinga",state:"CE",country:"BR"})).toBeNull();
  });

  it("rejects missing, imprecise and invalid browser GPS points", () => {
    const valid={lat:-3.88,lng:-38.62,accuracyM:12,sampledAtMs:Date.now()};
    expect(professionalRadarPointSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [
      {...valid,lat:91},
      {...valid,lng:181},
      {...valid,accuracyM:-1},
      {...valid,accuracyM:5001},
      {...valid,accuracyM:Infinity},
      {...valid,lat:NaN},
      {...valid,sampledAtMs:-1},
      {...valid,sampledAtMs:1.5},
      {lat:-3.88,lng:-38.62},
    ]) {
      expect(professionalRadarPointSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
