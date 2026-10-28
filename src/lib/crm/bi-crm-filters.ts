import type { UnifiedCrmContact } from "./unified-crm-service";
import { summarizeCrmParticipation } from "./crm-presentation";

export type BiCrmFilter = {
  source?: string;
  mobility?: string;
  pain?: string;
  origin?: string;
  destination?: string;
  time?: string;
  fare?: string;
};

const params = ["source","mobility","pain","origin","destination","time","fare"] as const;
const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

/** Never accept URLs, SQL fragments or arbitrary fields as query filters. */
export function parseBiCrmFilters(query: string): BiCrmFilter {
  const values = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const output: BiCrmFilter = {};
  for (const key of params) {
    const value = values.get(key)?.trim();
    if (value && value.length <= 120) output[key] = value;
  }
  return output;
}

export function buildBiCrmLink(filters: BiCrmFilter): string {
  const query = new URLSearchParams();
  for (const key of params) {
    const value = filters[key]?.trim();
    if (value && value.length <= 120) query.set(key,value);
  }
  const suffix = query.toString();
  return "/admin/relacionamentos" + (suffix ? "?" + suffix : "");
}

/** A single participation must satisfy all criteria: never join separate journeys. */
export function matchBiCrmContact(contact: UnifiedCrmContact, filters: BiCrmFilter): boolean {
  return contact.participations.some(p => {
    if (filters.source && p.source_form !== filters.source && p.source_label !== filters.source) return false;
    if (filters.mobility && p.mobility_role !== filters.mobility &&
      !(p.mobility_role === "AMBOS" && ["MOTORISTA","PASSAGEIRO"].includes(filters.mobility))) return false;
    if (filters.pain && !p.pains.includes(filters.pain)) return false;
    if (filters.origin && !norm(p.route_origin ?? "").includes(norm(filters.origin))) return false;
    if (filters.destination && !norm(p.route_destination ?? "").includes(norm(filters.destination))) return false;
    if (filters.time && !(p.outbound_time ?? "").startsWith(filters.time)) return false;
    if (filters.fare) {
      const summary = summarizeCrmParticipation(p);
      if (!summary.fit.some(field => /orçamento|preço|pagar/i.test(field.label) &&
        norm(field.value) === norm(filters.fare!))) return false;
    }
    return true;
  });
}
