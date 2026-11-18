import { describe, expect, it } from "vitest";
import { caronaaHomeTarget, resolveCaronaaHomeSurface } from "./role-home";

describe("CARONAA role-dependent Home navigation", () => {
  it("keeps guests on the public landing", () => {
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated: false, activeRole: "MOTORISTA", professionalAuthorized: true,
    }))).toEqual({to:"/"});
  });
  it("routes passengers to the trip search Home", () => {
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated: true, activeRole: "PASSAGEIRO",
    }))).toEqual({to:"/home"});
  });
  it("routes newly registered drivers to availability even before F07 authorization", () => {
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated: true, activeRole: "MOTORISTA", professionalAuthorized: false,
    }))).toEqual({to:"/disponibilidade-profissional"});
  });
  it("routes authorized professional drivers to their operational availability panel", () => {
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated: true, activeRole: "MOTORISTA", professionalAuthorized: true,
    }))).toEqual({to:"/disponibilidade-profissional"});
  });
  it("does not infer F07 access from a professional authorization if role is passenger", () => {
    expect(resolveCaronaaHomeSurface({
      authenticated: true, activeRole: "PASSAGEIRO", professionalAuthorized: true,
    })).toBe("passenger");
  });
  it("keeps campaign waiting navigation unchanged", () => {
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated: true, activeRole: "MOTORISTA", professionalAuthorized: false, prelaunchMode: true,
    }))).toEqual({to:"/aguardando"});
  });
});
