import { describe, expect, it } from "vitest";
import { RESEARCH_TEMPLATES, freshTemplate } from "./research-templates";
import { inspectSchema, isVisible, cleanAnswers } from "./research-schema";
import { initialResearchJourney } from "@/components/research/ResearchJourneyFields";
import {
  EVENT_EXIT_MATCH_KEY, eventExitMatchTemplate, eventExitMatchPreset,
  eventExitMatchIntro, validateEventConfiguration, validateEventExitAnswers,
  validateEventExitJourney, eventRideActionLinks,
} from "./event-exit-match";

describe("Modelo 03 — pesquisa rápida e match de saída", () => {
  const config=eventExitMatchPreset();
  const ready={...config,institutionId:"EVENTO_TESTE",institutionName:"Encontro de Tecnologia",campus:"Centro de Eventos",
    address:"Av. de Exemplo 100",region:"Fortaleza",campaignName:"Evento Teste",
    safeMeetingPoints:["Entrada principal"],launchDate:"2027-03-12" as string|null};

  it("registers a compact valid template with independent IDs and a configured journey", () => {
    expect(RESEARCH_TEMPLATES.filter(x=>x.key===EVENT_EXIT_MATCH_KEY)).toHaveLength(1);
    expect(eventExitMatchTemplate.schema.sections).toHaveLength(1);
    expect(eventExitMatchTemplate.schema.sections[0].questions).toHaveLength(7);
    expect(inspectSchema(eventExitMatchTemplate.schema)).toEqual([]);
    const a=freshTemplate(eventExitMatchTemplate),b=freshTemplate(eventExitMatchTemplate);
    expect(a.sections[0].questions[0].id).not.toBe(b.sections[0].questions[0].id);
  });
  it("does not fabricate an event date, partnership, availability or price", () => {
    expect(config.campaignType).toBe("EVENTO");
    expect(config.launchDate).toBeNull();
    expect(config.partnershipConfirmed).toBe(false);
    expect(config.pricing.referencePerTrip).toBeNull();
    expect(config.modes).toEqual(["CARONA"]);
    expect(validateEventConfiguration(config).length).toBeGreaterThan(0);
    expect(validateEventConfiguration(ready)).toEqual([]);
    const text=eventExitMatchIntro(ready);
    expect(text).toContain("Encontro de Tecnologia");
    expect(text).not.toMatch(/garantida|mais barata|confirmada/i);
  });
  it("requires a real event date, venue, safe pickup and campaign", () => {
    const bad={...ready,launchDate:null,campus:"",safeMeetingPoints:[],campaignName:""};
    const errs=validateEventConfiguration(bad);
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
  it("uses a single event day and defaults to an outbound event-exit route", () => {
    const j=initialResearchJourney(ready);
    expect(j.direction).toBe("VOLTA");
    expect(j.originArea).toBe("Centro de Eventos");
    expect(j.destinationArea).toBe("");
    expect(j.days).toHaveLength(1);
    expect(j.mode).toBe("CARONA");
  });
  it("preserves offer/vehicle branching and strips hidden fields", () => {
    const s=freshTemplate(eventExitMatchTemplate);
    const q=s.sections[0].questions;
    const offer=q.find(x=>x.semanticCode==="EVENT_OFFER_POSSIBLE")!;
    const seats=q.find(x=>x.semanticCode==="EVENT_OFFER_SEATS")!;
    expect(seats.showWhen?.questionId).toBe(offer.id);
    expect(isVisible(seats,{[offer.id]:"SIM"})).toBe(true);
    expect(isVisible(seats,{[offer.id]:"NAO"})).toBe(false);
    expect(cleanAnswers(s,{[offer.id]:"NAO",[seats.id]:"4"})[seats.id]).toBeUndefined();
  });
  it("rejects two primary pains or impossible motorcycle seating", () => {
    const schema=freshTemplate(eventExitMatchTemplate),q=schema.sections[0].questions;
    const id=(code:string)=>q.find(x=>x.semanticCode===code)!.id;
    expect(validateEventExitAnswers(schema,{
      [id("MOBILITY_PAINS")]:["DOR_01","DOR_03"],
    }).join(" ")).toMatch(/única dificuldade/);
    expect(validateEventExitAnswers(schema,{
      [id("EVENT_OFFER_POSSIBLE")]:"SIM",
      [id("EVENT_OFFER_VEHICLE")]:"MOTO",[id("EVENT_OFFER_SEATS")]:"2",
    }).join(" ")).toMatch(/motocicleta/i);
  });
  it("does not permit driver registration after declaring that no seats can be offered", () => {
    const s=freshTemplate(eventExitMatchTemplate),off=s.sections[0].questions.find(x=>x.semanticCode==="EVENT_OFFER_POSSIBLE")!;
    const j=initialResearchJourney(ready);
    expect(validateEventExitJourney(s,{[off.id]:"NAO"},{...j,profile:"MOTORISTA"}).length).toBe(1);
    expect(validateEventExitJourney(s,{[off.id]:"NAO"},{...j,profile:"PASSAGEIRO"})).toEqual([]);
    expect(validateEventExitJourney(s,{[off.id]:"SIM"},{...j,profile:"MOTORISTA",direction:"IDA"}).join(" ")).toMatch(/evento/);
  });
  it("only creates real-flow links for operational and nonexpired event exits", () => {
    const j={...initialResearchJourney(ready),destinationArea:"Meireles"};
    expect(eventRideActionLinks({...ready,serviceState:"PLANEJADO"},j,"2027-03-10")).toBeNull();
    expect(eventRideActionLinks({...ready,serviceState:"EM_OPERACAO"},j,"2027-03-13")).toBeNull();
    const links=eventRideActionLinks({...ready,serviceState:"EM_OPERACAO"},j,"2027-03-10",3)!;
    const find=new URL(links.search,"https://caronaa.example");
    const offer=new URL(links.offer,"https://caronaa.example");
    expect(find.pathname).toBe("/buscar");
    expect(find.searchParams.get("origem")).toBe("Centro de Eventos");
    expect(find.searchParams.get("destino")).toBe("Meireles");
    expect(find.searchParams.get("data")).toBe("2027-03-12");
    expect(find.searchParams.get("horario")).toBe(j.outboundTime);
    expect(find.searchParams.get("tolerancia")).toBe("5");
    expect(offer.searchParams.get("tolerancia")).toBe("5");
    expect(offer.pathname).toBe("/oferecer");
    expect(offer.searchParams.get("vagas")).toBe("3");
    expect(links.search).not.toMatch(/lat|lng|email|receipt|submissionKey/);
  });
  it("never builds matching links for a journey going to the event", () => {
    const j={...initialResearchJourney(ready),destinationArea:"Meireles",direction:"IDA" as const};
    expect(eventRideActionLinks({...ready,serviceState:"EM_OPERACAO"},j,"2027-03-12")).toBeNull();
  });
});
