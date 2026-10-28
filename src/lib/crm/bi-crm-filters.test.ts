import { describe, expect, it } from "vitest";
import { buildBiCrmLink, parseBiCrmFilters, matchBiCrmContact } from "./bi-crm-filters";
import type { UnifiedCrmContact } from "./unified-crm-service";

const participant = (origin: string, destination: string, hour: string) => ({
  id: origin, source_type: "RESEARCH" as const, source_form: "UNILAB-1",
  source_label: "UNILAB", created_at: "2026-10-26T12:00:00Z",
  academic_role: "ESTUDANTE", mobility_role: "PASSAGEIRO",
  route_origin: origin, route_destination: destination, outbound_time: hour,
  vehicle_type: null, seats: null, pains: ["DOR_04"], raw_payload: {},
});
const contact = { participations: [
  participant("Redenção", "Liberdade", "07:00"),
  participant("Fortaleza", "Messejana", "18:00"),
] } as UnifiedCrmContact;

describe("BI to CRM filter bridge", () => {
  it("round trips allowed filters in a shareable link", () => {
    const url = buildBiCrmLink({source:"UNILAB-1",origin:"Redenção",time:"07:00",pain:"DOR_04"});
    expect(url.startsWith("/admin/relacionamentos?")).toBe(true);
    expect(parseBiCrmFilters(url.slice(url.indexOf("?")))).toEqual({
      source:"UNILAB-1",origin:"Redenção",time:"07:00",pain:"DOR_04",
    });
  });

  it("matches a single participation rather than combining incompatible journeys", () => {
    expect(matchBiCrmContact(contact,{origin:"Redenção",destination:"Liberdade",time:"07:00"})).toBe(true);
    expect(matchBiCrmContact(contact,{origin:"Redenção",destination:"Messejana",time:"07:00"})).toBe(false);
    expect(matchBiCrmContact(contact,{source:"UNIFOR",origin:"Redenção"})).toBe(false);
    expect(matchBiCrmContact(contact,{pain:"DOR_03"})).toBe(false);
    expect(matchBiCrmContact(contact,{origin:"redencao"})).toBe(true);
  });

  it("rejects unrecognized URL parameters and excessively long values", () => {
    expect(parseBiCrmFilters("?unknown=x&origin="+ "a".repeat(121)+"&pain=DOR_04")).toEqual({pain:"DOR_04"});
  });
});
