import { describe, expect, it } from "vitest";
import { freshTemplate } from "./research-templates";
import {
  URBAN_UNIVERSITY_KEY,
  urbanUniversityIntro,
  urbanUniversityPreset,
  urbanUniversityTemplate,
  validateUrbanUniversityAnswers,
} from "./urban-university";
import { isVisible } from "./research-schema";

describe("Modelo 01 — universidade urbana", () => {
  it("creates a configured reusable campus model with no fabricated launch, partnership or price", () => {
    const preset = urbanUniversityPreset();
    expect(preset.templateKey).toBe(URBAN_UNIVERSITY_KEY);
    expect(preset.serviceState).toBe("PLANEJADO");
    expect(preset.launchDate).toBeNull();
    expect(preset.partnershipConfirmed).toBe(false);
    expect(preset.pricing.referencePerTrip).toBeNull();
    expect(preset.modes).toEqual(["CARONA"]);
    expect(preset.outboundTimes.length).toBeGreaterThan(1);
  });
  it("remaps conditional question IDs per form without losing semantic codes", () => {
    const first = freshTemplate(urbanUniversityTemplate);
    const second = freshTemplate(urbanUniversityTemplate);
    const all = first.sections.flatMap((section) => section.questions);
    const offer = all.find((q) => q.semanticCode === "RIDE_OFFER_INTENT")!;
    const seats = all.find((q) => q.semanticCode === "SEATS_AVAILABLE")!;
    expect(seats.showWhen?.questionId).toBe(offer.id);
    expect(isVisible(seats, { [offer.id]: "NAO" })).toBe(false);
    expect(isVisible(seats, { [offer.id]: "SIM" })).toBe(true);
    expect(first.sections[0].questions[0].id).not.toBe(second.sections[0].questions[0].id);
    expect(all.find((q) => q.semanticCode === "MOBILITY_PAINS")?.maxValue).toBe(2);
  });
  it("does not allow three pains or a principal pain outside the selected answers", () => {
    const schema = freshTemplate(urbanUniversityTemplate);
    const qs = schema.sections.flatMap((s) => s.questions);
    const key = (semantic: string) => qs.find((q) => q.semanticCode === semantic)!.id;
    const pains = key("MOBILITY_PAINS");
    const principal = key("URBAN_PRIMARY_PAIN");
    expect(validateUrbanUniversityAnswers(schema, {
      [pains]: ["DOR_01","DOR_02","DOR_03"], [principal]: "DOR_01",
    })).toContain("Selecione no máximo duas dificuldades.");
    expect(validateUrbanUniversityAnswers(schema, {
      [pains]: ["DOR_01","DOR_02"], [principal]: "DOR_06",
    }).join(" ")).toMatch(/principal/);
    expect(validateUrbanUniversityAnswers(schema, {
      [pains]: ["DOR_01","DOR_02"], [principal]: "DOR_01",
    })).toEqual([]);
  });
  it("prevents impossible passenger capacity on a motorcycle", () => {
    const schema = freshTemplate(urbanUniversityTemplate);
    const qs = schema.sections.flatMap((s) => s.questions);
    const vehicle = qs.find((q) => q.semanticCode === "URBAN_OFFER_VEHICLE")!.id;
    const seats = qs.find((q) => q.semanticCode === "SEATS_AVAILABLE")!.id;
    expect(validateUrbanUniversityAnswers(schema, { [vehicle]: "MOTO", [seats]: "2" }).join(" "))
      .toMatch(/motocicleta/);
    expect(validateUrbanUniversityAnswers(schema, { [vehicle]: "MOTO", [seats]: "1" })).toEqual([]);
  });
  it("reuses the real institution name in the introduction without promising lower fares", () => {
    const text = urbanUniversityIntro({institutionName:"Universidade Exemplo",campus:"Campus Principal"});
    expect(text).toContain("Universidade Exemplo");
    expect(text).toContain("Campus Principal");
    expect(text).not.toMatch(/mais barato|mais seguro|reservada|garantida/i);
  });
});
