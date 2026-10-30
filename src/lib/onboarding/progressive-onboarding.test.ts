import { describe, it, expect } from "vitest";
import { canComplete, institutionForRegion } from "./progressive-onboarding";

describe("cadastro progressivo", () => {
  it("associa apenas as instituições piloto às regiões iniciais", () => {
    expect(institutionForRegion("FORTALEZA")).toBe("UNIFOR");
    expect(institutionForRegion("MACICO_BATURITE")).toBe("UNILAB");
    expect(institutionForRegion("OTHER")).toBeNull();
  });
  it("exige perfil e vínculo, sem exigir rota ou WhatsApp", () => {
    expect(canComplete({region_code:"FORTALEZA",institution_code:"UNIFOR",affiliation_type:"ESTUDANTE",usage_role:"PASSAGEIRO"})).toBe(true);
    expect(canComplete({region_code:"FORTALEZA",institution_code:null,affiliation_type:"ESTUDANTE",usage_role:"PASSAGEIRO"})).toBe(false);
    expect(canComplete({region_code:"OTHER",institution_code:null,affiliation_type:"COMUNIDADE",usage_role:"AMBOS"})).toBe(true);
  });
});
