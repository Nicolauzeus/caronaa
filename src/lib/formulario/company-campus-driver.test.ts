import { describe, expect, it } from "vitest";
import { RESEARCH_TEMPLATES, freshTemplate } from "./research-templates";
import { cleanAnswers, inspectSchema, isVisible } from "./research-schema";
import { parseResearchConfiguration, newResearchConfiguration } from "./research-configuration";
import { initialResearchJourney } from "@/components/research/ResearchJourneyFields";
import {
  COMPANY_CAMPUS_DRIVER_KEY, companyCampusDriverTemplate,
  companyCampusDriverPreset, companyCampusDriverIntro,
  companyCampusSuggestedProfile, validateCompanyCampusConfiguration,
  validateCompanyCampusAnswers, validateCompanyCampusJourney,
} from "./company-campus-driver";

describe("Modelo 04 — Empresa próxima ao campus", () => {
  const config = () => ({
    ...companyCampusDriverPreset(),
    institutionId: "EMPRESA_CAMPUS",
    institutionName: "Empresa Exemplo",
    campus: "Unidade Norte",
    nearbyUniversity: "Universidade Exemplo",
    region: "Fortaleza",
    address: "Avenida Principal 100, Fortaleza",
    publicName: "Mobilidade Empresa Exemplo e Universidade Exemplo",
    campaignName: "Piloto Empresa 01",
  });

  it("registers one valid short template of nature EMPRESA", () => {
    const t = RESEARCH_TEMPLATES.find((v) => v.key === COMPANY_CAMPUS_DRIVER_KEY);
    expect(t).toEqual(companyCampusDriverTemplate);
    expect(t?.nature).toBe("EMPRESA");
    expect(t?.estimatedMinutes).toBe(4);
    expect(t?.schema.sections.flatMap(s=>s.questions)).toHaveLength(11);
    expect(inspectSchema(companyCampusDriverTemplate.schema)).toEqual([]);
  });

  it("keeps the company location separate from the adjacent university", () => {
    const settings = parseResearchConfiguration(config());
    expect(settings.campus).toBe("Unidade Norte");
    expect(settings.address).toContain("Avenida Principal");
    expect(settings.nearbyUniversity).toBe("Universidade Exemplo");
    expect(settings.partnershipConfirmed).toBe(false);
    expect(settings.launchDate).toBeNull();
    expect(settings.pricing.referencePerTrip).toBeNull();
    expect(settings.accessPolicy).toBe("PESQUISA_PUBLICA");
    expect(settings.modes).toEqual(["CARONA"]);
    expect(settings.profiles).toContain("PASSAGEIRO");
    expect(settings.profiles).toContain("MOTORISTA");
    expect(validateCompanyCampusConfiguration(settings)).toEqual([]);
  });

  it("does not send the new field in legacy research settings before migration 0098", () => {
    const existing=parseResearchConfiguration({
      ...newResearchConfiguration("UNIVERSIDADE_URBANA_CARONAA"),
      institutionId:"UNIVERSIDADE_EXEMPLO",
      institutionName:"Universidade Exemplo",
      publicName:"Mobilidade universitária",
      region:"Fortaleza",
      usagePolicy:"Pesquisa de mobilidade, respostas usadas de forma agregada.",
    });
    expect(Object.prototype.hasOwnProperty.call(existing, "nearbyUniversity")).toBe(false);
  });

  it("blocks creation when company, adjacent school or route metadata is missing", () => {
    const incomplete=companyCampusDriverPreset();
    expect(validateCompanyCampusConfiguration(incomplete).length).toBeGreaterThan(2);
    expect(validateCompanyCampusConfiguration({...config(), nearbyUniversity:""})).toContain(
      "Informe a universidade ou o instituto próximo."
    );
    expect(validateCompanyCampusConfiguration({
      ...config(), modes:["TRANSPORTE_PROFISSIONAL_INTERESSE"]
    }).join(" ")).toMatch(/somente a modalidade/);
  });

  it("explains an exploratory partnership without pretending price, approval or a ride", () => {
    const intro=companyCampusDriverIntro(config());
    expect(intro).toContain("Empresa Exemplo");
    expect(intro).toContain("Universidade Exemplo");
    expect(intro).toContain("pesquisa exploratória");
    expect(intro).toMatch(/não há parceria institucional confirmada/);
    expect(intro).not.toMatch(/mais barato|carona confirmada|reservado/i);
    expect(companyCampusDriverIntro({
      ...config(), launchDate:"2027-08-01", serviceState:"PLANEJADO",
    })).toContain("sujeito a confirmação");
  });

  it("remaps conditional dependencies without duplicating respondent answers", () => {
    const a=freshTemplate(companyCampusDriverTemplate);
    const b=freshTemplate(companyCampusDriverTemplate);
    expect(a.sections[0].questions[0].id).not.toBe(b.sections[0].questions[0].id);
    const q=a.sections.flatMap(s=>s.questions);
    const drives=q.find(v=>v.semanticCode==="COMPANY_DRIVES_CAR")!;
    const seats=q.find(v=>v.semanticCode==="SEATS_AVAILABLE")!;
    const interest=q.find(v=>v.semanticCode==="RIDE_OFFER_INTENT")!;
    expect(seats.showWhen?.questionId).toBe(drives.id);
    expect(interest.showWhen?.questionId).toBe(drives.id);
    expect(isVisible(interest,{[drives.id]:"NAO"})).toBe(false);
    expect(isVisible(interest,{[drives.id]:"SIM"})).toBe(true);
    const sanitized=cleanAnswers(a,{[drives.id]:"NAO",[seats.id]:"4",[interest.id]:"SIM"});
    expect(sanitized[seats.id]).toBeUndefined();
    expect(sanitized[interest.id]).toBeUndefined();
    expect(inspectSchema(a)).toEqual([]);
  });

  it("never treats a worker with no available seat as an eligible driver", () => {
    const schema=freshTemplate(companyCampusDriverTemplate);
    const q=schema.sections.flatMap(s=>s.questions);
    const id=(code:string)=>q.find(v=>v.semanticCode===code)!.id;
    const bad={
      [id("COMPANY_DRIVES_CAR")]:"SIM",
      [id("SEATS_AVAILABLE")]:"0",
      [id("RIDE_OFFER_INTENT")]:"SIM",
    };
    expect(validateCompanyCampusAnswers(schema,bad).join(" ")).toMatch(/pelo menos um lugar/);
    expect(companyCampusSuggestedProfile(schema,bad)).toBe("PASSAGEIRO");
    expect(validateCompanyCampusJourney(schema,bad,{
      ...initialResearchJourney(config()), profile:"MOTORISTA",
    }).join(" ")).toMatch(/Se​​lecione passageiro|Selecione passageiro/);
  });

  it("allows a driver with seats and expressed interest to prepare a driving route", () => {
    const schema=freshTemplate(companyCampusDriverTemplate);
    const q=schema.sections.flatMap(s=>s.questions);
    const id=(code:string)=>q.find(v=>v.semanticCode===code)!.id;
    const answers={
      [id("COMPANY_DRIVES_CAR")]:"SIM",
      [id("SEATS_AVAILABLE")]:"2",
      [id("RIDE_OFFER_INTENT")]:"SIM",
    };
    expect(validateCompanyCampusAnswers(schema,answers)).toEqual([]);
    expect(companyCampusSuggestedProfile(schema,answers)).toBe("MOTORISTA");
    const journey={...initialResearchJourney(config()),profile:"MOTORISTA" as const};
    expect(validateCompanyCampusJourney(schema,answers,journey)).toEqual([]);
    expect(validateCompanyCampusJourney(schema,answers,{...journey,profile:"AMBOS"})).toEqual([]);
  });

  it("does not allow a non-driver to register a driver/ambos route", () => {
    const schema=freshTemplate(companyCampusDriverTemplate);
    const drives=schema.sections.flatMap(s=>s.questions).find(v=>v.semanticCode==="COMPANY_DRIVES_CAR")!;
    const answers={[drives.id]:"NAO"};
    const journey=initialResearchJourney(config());
    expect(companyCampusSuggestedProfile(schema,answers)).toBe("PASSAGEIRO");
    expect(validateCompanyCampusJourney(schema,answers,{...journey,profile:"MOTORISTA"}).length).toBe(1);
    expect(validateCompanyCampusJourney(schema,answers,{...journey,profile:"PASSAGEIRO"})).toEqual([]);
  });

  it("keeps interest, trust and capacity distinct from a published offer, payment or booking", () => {
    const q=companyCampusDriverTemplate.schema.sections.flatMap(s=>s.questions);
    expect(q.find(v=>v.semanticCode==="RIDE_OFFER_INTENT")?.type).toBe("yes_no");
    expect(q.find(v=>v.semanticCode==="SEATS_AVAILABLE")?.type).toBe("number");
    expect(q.find(v=>v.semanticCode==="TRUST_FACTORS")?.type).toBe("single_choice");
    expect(q.some(v=>v.semanticCode==="QUOTE_ACCEPTANCE_INTENT")).toBe(false);
    expect(q.some(v=>v.semanticCode==="PAYMENT_CONFIRMED")).toBe(false);
    expect(new Set(q.map(v=>v.semanticCode)).size).toBe(q.length);
  });
});
