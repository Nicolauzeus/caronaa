import { describe, expect, it } from "vitest";
import { RESEARCH_TEMPLATES, freshTemplate } from "./research-templates";
import { cleanAnswers, inspectSchema, isVisible } from "./research-schema";
import {
  REGIONAL_UNIVERSITY_KEY,
  regionalUniversityTemplate,
  regionalUniversityPreset,
  regionalUniversityIntro,
  validateRegionalUniversityAnswers,
} from "./regional-university";

describe("Modelo 02 — Universidade Regional", () => {
  const config = regionalUniversityPreset();

  it("registers a unique, valid and reusable institutional template", () => {
    const t = RESEARCH_TEMPLATES.find((x) => x.key === REGIONAL_UNIVERSITY_KEY);
    expect(t?.nature).toBe("EDUCACAO");
    expect(t).toEqual(regionalUniversityTemplate);
    expect(RESEARCH_TEMPLATES.filter((x) => x.key === REGIONAL_UNIVERSITY_KEY)).toHaveLength(1);
    expect(inspectSchema(regionalUniversityTemplate.schema)).toEqual([]);
  });

  it("uses existing secure journey schedules and distinguishes professional interest from rides", () => {
    expect(config.templateKey).toBe(REGIONAL_UNIVERSITY_KEY);
    expect(config.days.length).toBeGreaterThan(0);
    expect(config.outboundTimes.length).toBeGreaterThan(0);
    expect(config.modes).toEqual(["CARONA", "TRANSPORTE_PROFISSIONAL_INTERESSE"]);
    expect(config.serviceState).toBe("PLANEJADO");
    expect(config.launchDate).toBeNull();
    expect(config.partnershipConfirmed).toBe(false);
    expect(config.pricing.referencePerTrip).toBeNull();
    expect(config.accessPolicy).toBe("PESQUISA_PUBLICA");
  });

  it("does not invent a mototaxi partnership or promise a confirmed start", () => {
    const intro = regionalUniversityIntro({
      ...config,
      institutionName: "Universidade Exemplo",
      campus: "Campus Central",
    });
    expect(intro).toContain("Universidade Exemplo");
    expect(intro).toContain("Campus Central");
    expect(intro).toMatch(/não há parceria confirmada/);
    expect(intro).not.toMatch(/mais barato|serviço garantido|corrida confirmada/i);
    expect(regionalUniversityIntro({
      ...config,
      institutionName: "Universidade Exemplo",
      campus: "Campus Central",
      modes: ["CARONA"],
    })).not.toContain("mototaxistas locais");
  });

  it("clones questions with fresh IDs and preserves branch dependencies", () => {
    const first = freshTemplate(regionalUniversityTemplate);
    const second = freshTemplate(regionalUniversityTemplate);
    const questions = first.sections.flatMap((section) => section.questions);
    const q = (semantic: string) => questions.find((question) => question.semanticCode === semantic)!;
    const offered = q("REGIONAL_OFFER_POSSIBLE");
    const seats = q("SEATS_AVAILABLE");
    const professional = q("REGIONAL_PROFESSIONAL_ROLE");
    const professionalInterest = q("REGIONAL_PROFESSIONAL_INTEREST");
    expect(first.sections[0].questions[0].id).not.toBe(second.sections[0].questions[0].id);
    expect(seats.showWhen?.questionId).toBe(offered.id);
    expect(isVisible(seats, { [offered.id]: "SIM" })).toBe(true);
    expect(isVisible(seats, { [offered.id]: "NAO" })).toBe(false);
    expect(professionalInterest.showWhen?.questionId).toBe(professional.id);
    expect(isVisible(professionalInterest, { [professional.id]: "SIM" })).toBe(true);
    expect(isVisible(professionalInterest, { [professional.id]: "NAO" })).toBe(false);
    expect(inspectSchema(first)).toEqual([]);
  });

  it("does not retain professional answers when the user is not a mototaxi professional", () => {
    const schema = freshTemplate(regionalUniversityTemplate);
    const qs = schema.sections.flatMap((section) => section.questions);
    const yesNo = qs.find((q) => q.semanticCode === "REGIONAL_PROFESSIONAL_ROLE")!;
    const answer = qs.find((q) => q.semanticCode === "REGIONAL_PROFESSIONAL_INTEREST")!;
    const clean = cleanAnswers(schema, {
      [yesNo.id]: "NAO",
      [answer.id]: "SIM",
    });
    expect(clean[answer.id]).toBeUndefined();
  });

  it("rejects inconsistent pain rankings", () => {
    const schema = freshTemplate(regionalUniversityTemplate);
    const qs = schema.sections.flatMap((section) => section.questions);
    const pains = qs.find((q) => q.semanticCode === "MOBILITY_PAINS")!;
    const primary = qs.find((q) => q.semanticCode === "REGIONAL_PRIMARY_PAIN")!;
    const errors = validateRegionalUniversityAnswers(schema, {
      [pains.id]: ["DOR_01", "DOR_02", "DOR_03"],
      [primary.id]: "DOR_06",
    });
    expect(errors.join(" ")).toMatch(/duas dificuldades/);
    expect(errors.join(" ")).toMatch(/dificuldade principal/);
  });

  it("enforces motorcycle capacity but allows a car with multiple seats", () => {
    const schema = freshTemplate(regionalUniversityTemplate);
    const qs = schema.sections.flatMap((section) => section.questions);
    const q = (code: string) => qs.find((it) => it.semanticCode === code)!.id;
    const base = { [q("REGIONAL_OFFER_POSSIBLE")]: "SIM" };
    expect(validateRegionalUniversityAnswers(schema, {
      ...base, [q("REGIONAL_OFFER_VEHICLE")]: "MOTO", [q("SEATS_AVAILABLE")]: "2",
    }).join(" ")).toMatch(/um lugar/);
    expect(validateRegionalUniversityAnswers(schema, {
      ...base, [q("REGIONAL_OFFER_VEHICLE")]: "CARRO", [q("SEATS_AVAILABLE")]: "3",
    })).toEqual([]);
  });

  it("keeps inferred professional role separate from legal credentials", () => {
    const schema = freshTemplate(regionalUniversityTemplate);
    const qs = schema.sections.flatMap((section) => section.questions);
    const p = qs.find((q) => q.semanticCode === "REGIONAL_PROFESSIONAL_ROLE")!;
    const interest = qs.find((q) => q.semanticCode === "REGIONAL_PROFESSIONAL_INTEREST")!;
    expect(validateRegionalUniversityAnswers(schema, {
      [p.id]: "NAO", [interest.id]: "SIM",
    }).join(" ")).toMatch(/exclusivo/);
    expect(interest.helpText).toMatch(/credenciamento/i);
  });

  it("does not reuse or misclassify survey declarations as price quotes and payments", () => {
    const qs = regionalUniversityTemplate.schema.sections.flatMap((s) => s.questions);
    expect(qs.find((q) => q.semanticCode === "ACCEPTABLE_FARE_RANGE")?.type).toBe("money_range");
    expect(qs.find((q) => q.semanticCode === "BOOKING_INTENT")?.type).toBe("yes_no");
    expect(qs.find((q) => q.semanticCode === "LAUNCH_PARTICIPATION_INTENT")?.type).toBe("yes_no");
    expect(qs.some((q) => q.semanticCode === "QUOTE_ACCEPTANCE_INTENT")).toBe(false);
    expect(qs.some((q) => q.semanticCode === "PAYMENT_CONFIRMED")).toBe(false);
    const codes = qs.map((q) => q.semanticCode).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
