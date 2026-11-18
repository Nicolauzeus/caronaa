import { describe, expect, it } from "vitest";
import { canComplete, institutionForRegion } from "./progressive-onboarding";

describe("cadastro universal CARONAA", () => {
  it("mantém sugestões regionais apenas quando região for informada", () => {
    expect(institutionForRegion("FORTALEZA")).toBe("UNIFOR");
    expect(institutionForRegion("MACICO_BATURITE")).toBe("UNILAB");
    expect(institutionForRegion("OTHER")).toBeNull();
  });

  it.each(["PASSAGEIRO", "MOTORISTA", "AMBOS"] as const)(
    "conclui com intenção %s mesmo sem região ou vínculo",
    usage_role => expect(canComplete({usage_role})).toBe(true),
  );

  it("não conclui sem perfil escolhido", () => {
    expect(canComplete({usage_role:null})).toBe(false);
  });

  it("não confunde autorização operacional com preferência declarada", () => {
    // This helper only determines whether the basic profile is complete.
    expect(canComplete({usage_role:"MOTORISTA"})).toBe(true);
  });
});
