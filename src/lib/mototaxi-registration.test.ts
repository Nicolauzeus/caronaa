import { describe, expect, it } from "vitest";
import { detailsSchema } from "./mototaxi-registration";

const valid = {
  firstName: "Maria", lastName: "Silva", whatsapp: "(85) 99999-9999",
  region: "MACICO_BATURITE", registrationNumber: "MT-1234",
};

describe("mototaxi simplified registration", () => {
  it("accepts the Maciço registration without plate, CPF, model or university", () => {
    expect(detailsSchema.parse(valid)).toEqual({
      ...valid, whatsapp: "85999999999",
    });
  });
  it("normalizes country prefix and phone mask", () => {
    expect(detailsSchema.parse({ ...valid, whatsapp: "+55 (85) 99999-9999" }).whatsapp).toBe("85999999999");
  });
  it("accepts the selected Fortaleza region", () => {
    expect(detailsSchema.parse({ ...valid, region: "FORTALEZA" }).region).toBe("FORTALEZA");
  });
  it.each([
    [{ ...valid, firstName: "A" }, "short first name"],
    [{ ...valid, lastName: "" }, "missing surname"],
    [{ ...valid, whatsapp: "123" }, "invalid phone"],
    [{ ...valid, registrationNumber: "" }, "missing registration"],
    [{ ...valid, region: "OTHER" }, "unavailable region"],
    [{ ...valid, firstName: "Maria Clara" }, "additional name"],
  ])("rejects %s (%s)", value => {
    expect(detailsSchema.safeParse(value).success).toBe(false);
  });
});
