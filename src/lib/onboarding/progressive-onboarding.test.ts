import { describe, expect, it } from "vitest";
import { canComplete, institutionForRegion } from "./progressive-onboarding";

describe("cadastro progressivo CARONAA", () => {
  it("sugere instituições somente nas duas regiões piloto", () => {
    expect(institutionForRegion("FORTALEZA")).toBe("UNIFOR");
    expect(institutionForRegion("MACICO_BATURITE")).toBe("UNILAB");
    expect(institutionForRegion("OTHER")).toBeNull();
  });

  it("conclui um perfil acadêmico sem exigir rota ou WhatsApp", () => {
    expect(canComplete({
      region_code: "FORTALEZA", institution_code: "UNIFOR",
      affiliation_type: "ESTUDANTE", usage_role: "PASSAGEIRO",
    })).toBe(true);
  });

  it("impede associação de universidade de região incompatível", () => {
    expect(canComplete({
      region_code: "FORTALEZA", institution_code: "UNILAB",
      affiliation_type: "PROFESSOR", usage_role: "AMBOS",
    })).toBe(false);
  });

  it("permite comunidade sem universidade vinculada", () => {
    expect(canComplete({
      region_code: "MACICO_BATURITE", institution_code: null,
      affiliation_type: "COMUNIDADE", usage_role: "MOTORISTA",
    })).toBe(true);
  });

  it("não conclui sem papel de mobilidade", () => {
    expect(canComplete({
      region_code: "FORTALEZA", institution_code: "UNIFOR",
      affiliation_type: "ESTUDANTE", usage_role: null,
    })).toBe(false);
  });

  it("aceita expansão regional sem criar filiação institucional automática", () => {
    expect(canComplete({
      region_code: "OTHER", institution_code: null,
      affiliation_type: "COLABORADOR", usage_role: "PASSAGEIRO",
    })).toBe(true);
  });
});
