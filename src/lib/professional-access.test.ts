import { describe, expect, it } from "vitest";
import { canApproveProfessionalRequest, isValidBrazilianPlate, parseMissingError, professionalAccessMissing, STATUS_LABELS } from "./professional-access";

const ok = { avatarUrl: "https://x/a.jpg", fullName: "Ana Souza", vehicleBrand: "Fiat", vehicleDescription: "Argo",
  vehicleColor: "Branco", vehiclePlate: "ABC1D23", vehicleType: "CAR" as const, carCategory: "HATCH" as const, seats: 3, municipality: "Fortaleza" };

describe("professional access validation", () => {
  it("blocks approval when an obligation is missing", () => expect(canApproveProfessionalRequest("PENDING", ["PHOTO"])).toBe(false));
  it("allows only complete pending requests", () => {
    expect(canApproveProfessionalRequest("PENDING", [])).toBe(true);
    expect(canApproveProfessionalRequest("APPROVED", [])).toBe(false);
  });
  it("fails closed if missing-data validation is absent", () => expect(canApproveProfessionalRequest("PENDING", undefined)).toBe(false));
  it("accepts complete data", () => expect(professionalAccessMissing(ok)).toEqual([]));
  it("requires a photo", () => expect(professionalAccessMissing({ ...ok, avatarUrl: null })).toContain("PHOTO"));
  it("requires vehicle color", () => expect(professionalAccessMissing({ ...ok, vehicleColor: "" })).toContain("VEHICLE_COLOR"));
  it("requires brand and model separately", () => expect(professionalAccessMissing({ ...ok, vehicleBrand: "" })).toContain("VEHICLE_MODEL"));
  it("requires first and last name", () => expect(professionalAccessMissing({ ...ok, fullName: "Ana" })).toContain("FULL_NAME"));
  it("validates old and Mercosul plates", () => {
    expect(isValidBrazilianPlate("abc-1234")).toBe(true);
    expect(isValidBrazilianPlate("ABC1D23")).toBe(true);
    expect(isValidBrazilianPlate("AB12345")).toBe(false);
  });
  it("never accepts zero seats", () => expect(professionalAccessMissing({ ...ok, seats: 0 })).toContain("SEATS"));
  it("caps seats at 7", () => expect(professionalAccessMissing({ ...ok, carCategory: "MINIVAN", seats: 8 })).toContain("SEATS"));
  it("hatch allows at most 4", () => expect(professionalAccessMissing({ ...ok, seats: 5 })).toContain("SEATS"));
  it("moto allows exactly 1 and no category", () => {
    expect(professionalAccessMissing({ ...ok, vehicleType: "MOTO", carCategory: null, seats: 1 })).toEqual([]);
    expect(professionalAccessMissing({ ...ok, vehicleType: "MOTO", carCategory: null, seats: 2 })).toContain("SEATS");
  });
  it("car requires category", () => expect(professionalAccessMissing({ ...ok, carCategory: null })).toContain("CAR_CATEGORY"));
  it("parses database pending error", () => expect(parseMissingError("Dados pendentes: PHOTO,PLATE")).toEqual(["PHOTO", "PLATE"]));
  it("approved means platform eligibility, not legal license verification", () => expect(STATUS_LABELS.APPROVED).toBe("Habilitado para receber corridas"));
});
