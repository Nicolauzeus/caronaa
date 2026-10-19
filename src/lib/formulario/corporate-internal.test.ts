import { describe, expect, it } from "vitest";
import { RESEARCH_TEMPLATES, freshTemplate } from "./research-templates";
import { inspectSchema, isVisible, cleanAnswers } from "./research-schema";
import { parseResearchConfiguration } from "./research-configuration";
import { initialResearchJourney } from "@/components/research/ResearchJourneyFields";
import {
  CORPORATE_INTERNAL_KEY, corporateInternalTemplate, corporateInternalPreset,
  corporateInternalIntro, validateCorporateInternalConfiguration, validateCorporateInternalAnswers,
  corporateCanOffer, validateCorporateInternalJourney,
} from "./corporate-internal";

describe("Modelo 05 — CARONAA Corporativo Interno", () => {
  const config = () => ({
    ...corporateInternalPreset(),
    institutionId: "EMPRESA_TESTE",
    institutionName: "Empresa Exemplo",
    publicName: "Mobilidade interna · Empresa Exemplo",
    campus: "Unidade Industrial",
    region: "Fortaleza",
    address: "Avenida Industrial, 100",
  });
  const schema=()=>freshTemplate(corporateInternalTemplate);
  const answersFor=(s:ReturnType<typeof schema>,partial:Record<string,string>)=>{
    const ids=Object.fromEntries(s.sections.flatMap(sec=>sec.questions)
      .map(q=>[q.semanticCode,q.id]).filter(([semantic])=>Boolean(semantic)));
    return Object.fromEntries(Object.entries(partial).map(([key,v])=>[ids[key],v]));
  };

  it("registers one reusable, valid EMPRESA template",()=>{
    expect(RESEARCH_TEMPLATES.filter(t=>t.key===CORPORATE_INTERNAL_KEY)).toHaveLength(1);
    expect(RESEARCH_TEMPLATES.find(t=>t.key===CORPORATE_INTERNAL_KEY)).toEqual(corporateInternalTemplate);
    expect(corporateInternalTemplate.nature).toBe("EMPRESA");
    expect(corporateInternalTemplate.estimatedMinutes).toBe(4);
    expect(inspectSchema(corporateInternalTemplate.schema)).toEqual([]);
  });

  it("enforces company employees without relying on email domains or research badges",()=>{
    const c=parseResearchConfiguration(config());
    expect(c.accessPolicy).toBe("COLABORADORES_DA_EMPRESA");
    expect(c.modes).toEqual(["CARONA"]);
    expect(c.serviceState).toBe("PLANEJADO");
    expect(c.partnershipConfirmed).toBe(false);
    expect(c.launchDate).toBeNull();
    expect(c.pricing.referencePerTrip).toBeNull();
    expect(validateCorporateInternalConfiguration(c)).toEqual([]);
    expect(validateCorporateInternalConfiguration({...c,accessPolicy:"PESQUISA_PUBLICA"}).join(" ")).toMatch(/acesso restrito/i);
    expect(validateCorporateInternalConfiguration({...c,modes:["TRANSPORTE_PROFISSIONAL_INTERESSE"]}).length).toBeGreaterThan(0);
  });

  it("requires real company, unit and location in the admin configuration",()=>{
    const invalid=corporateInternalPreset();
    expect(validateCorporateInternalConfiguration(invalid).length).toBeGreaterThan(0);
    expect(validateCorporateInternalConfiguration({...config(),campus:""})).not.toEqual([]);
    expect(validateCorporateInternalConfiguration({...config(),address:""})).not.toEqual([]);
  });

  it("mentions shifts, verified staff, estimated launch and privacy accurately",()=>{
    const intro=corporateInternalIntro({...config(),launchDate:"2027-08-01",serviceState:"PLANEJADO"});
    expect(intro).toContain("Empresa Exemplo");
    expect(intro).toContain("Unidade Industrial");
    expect(intro).toContain("previsto");
    expect(intro).toContain("colaboradores autorizados");
    expect(intro).not.toMatch(/confirmada a corrida|mais barato|viagem reservada/i);
    expect(corporateInternalIntro({...config(),serviceState:"ADIADO"})).toContain("adiado");
  });

  it("preserves conditional questions and remaps cloned IDs",()=>{
    const a=schema(),b=schema();
    expect(a.sections[0].questions[0].id).not.toBe(b.sections[0].questions[0].id);
    const q=a.sections.flatMap(s=>s.questions);
    const driver=q.find(x=>x.semanticCode==="CORP_DRIVES_CAR")!;
    const offer=q.find(x=>x.semanticCode==="RIDE_OFFER_INTENT")!;
    const seats=q.find(x=>x.semanticCode==="SEATS_AVAILABLE")!;
    expect(offer.showWhen?.questionId).toBe(driver.id);
    expect(seats.showWhen?.questionId).toBe(driver.id);
    expect(isVisible(seats,{[driver.id]:"SIM"})).toBe(true);
    expect(isVisible(seats,{[driver.id]:"NAO"})).toBe(false);
    const hidden=cleanAnswers(a,{[driver.id]:"NAO",[offer.id]:"SIM",[seats.id]:"4"});
    expect(hidden[seats.id]).toBeUndefined();
    expect(hidden[offer.id]).toBeUndefined();
  });

  it("never treats non-drivers, zero seats or refusal as available drivers",()=>{
    const s=schema();
    for(const parts of [
      {CORP_DRIVES_CAR:"NAO",RIDE_OFFER_INTENT:"SIM",SEATS_AVAILABLE:"2"},
      {CORP_DRIVES_CAR:"SIM",RIDE_OFFER_INTENT:"SIM",SEATS_AVAILABLE:"0"},
      {CORP_DRIVES_CAR:"SIM",RIDE_OFFER_INTENT:"NAO",SEATS_AVAILABLE:"3"},
    ]){
      const answers=answersFor(s,parts);
      expect(corporateCanOffer(s,answers)).toBe(false);
      expect(validateCorporateInternalJourney(s,answers,{...initialResearchJourney(config()),profile:"MOTORISTA"}).length).toBeGreaterThan(0);
    }
    expect(validateCorporateInternalAnswers(s,answersFor(s,{
      CORP_DRIVES_CAR:"SIM",RIDE_OFFER_INTENT:"SIM",SEATS_AVAILABLE:"0",
    })).join(" ")).toMatch(/pelo menos um lugar/);
  });

  it("accepts a voluntary, eligible driver and both-directions route",()=>{
    const s=schema();
    const answers=answersFor(s,{CORP_DRIVES_CAR:"SIM",RIDE_OFFER_INTENT:"SIM",SEATS_AVAILABLE:"3"});
    expect(corporateCanOffer(s,answers)).toBe(true);
    expect(validateCorporateInternalAnswers(s,answers)).toEqual([]);
    const trip=initialResearchJourney(config());
    expect(validateCorporateInternalJourney(s,answers,{...trip,profile:"MOTORISTA"})).toEqual([]);
    expect(validateCorporateInternalJourney(s,answers,{...trip,profile:"AMBOS",direction:"IDA_E_VOLTA"})).toEqual([]);
  });

  it("does not use survey declarations as operational payments or rides",()=>{
    const qs=corporateInternalTemplate.schema.sections.flatMap(s=>s.questions);
    expect(qs.find(q=>q.semanticCode==="RIDE_OFFER_INTENT")?.type).toBe("yes_no");
    expect(qs.find(q=>q.semanticCode==="BOOKING_INTENT")?.type).toBe("yes_no");
    expect(qs.find(q=>q.semanticCode==="SEATS_AVAILABLE")?.type).toBe("number");
    expect(qs.some(q=>q.semanticCode==="QUOTE_ACCEPTANCE_INTENT"||q.semanticCode==="PAYMENT_CONFIRMED")).toBe(false);
    expect(new Set(qs.map(q=>q.semanticCode)).size).toBe(qs.length);
  });
});
