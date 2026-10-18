import { describe, expect, it } from "vitest";
import {
  effectiveResearchSchedule,
  exportResearchSummary,
  launchMessage,
  newResearchConfiguration,
  parseResearchConfiguration,
  validateJourney,
} from "./research-configuration";
import { freshTemplate, type ResearchTemplate } from "./research-templates";
import { cleanAnswers, getNumberBounds, inspectSchema } from "./research-schema";
import { initialResearchJourney } from "@/components/research/ResearchJourneyFields";

const config = () => ({
  ...newResearchConfiguration(),
  institutionId: "INST_A",
  institutionName: "Instituição A",
  publicName: "Pesquisa A",
  region: "Fortaleza",
  usagePolicy: "Participação voluntária sem reserva automática.",
});
describe("Reusable research configuration", () => {
  it("does not invent institution, launch, price or partnership data", () => {
    const value = newResearchConfiguration();
    expect(value.institutionName).toBe("");
    expect(value.launchDate).toBeNull();
    expect(value.priceReference).toBe("");
    expect(value.partnershipConfirmed).toBe(false);
    expect(() => parseResearchConfiguration(value)).toThrow();
    expect(parseResearchConfiguration(config()).serviceState).toBe("PLANEJADO");
  });
  it("validates dates, time zones, coordinates, days and partnership authority", () => {
    for (const patch of [
      { launchDate: "2027-02-31" },
      { timezone: "Not/AZone" },
      { latitude: 5 },
      { days: [1, 1] },
      { outboundTimes: ["26:15"] },
      { partnershipDescription: "Parceria ainda não autorizada" },
    ]) {
      expect(() => parseResearchConfiguration({ ...config(), ...patch })).toThrow();
    }
    expect(
      launchMessage({ ...config(), launchDate: "2027-01-10", serviceState: "ADIADO" }),
    ).toContain("10/01/2027");
  });
  it("clones all identifiers and dependencies without mutating the model or losing numeric rules", () => {
    const template: ResearchTemplate = {
      key: "TEST",
      nature: "OUTRA",
      label: "Teste",
      description: "Teste",
      estimatedMinutes: 1,
      schema: {
        sections: [
          {
            id: "old-section",
            title: "Teste",
            questions: [
              {
                id: "parent",
                label: "Perfil de teste",
                type: "single_choice",
                required: true,
                options: ["SIM", "NAO"],
              },
              {
                id: "days",
                label: "Dias por semana",
                type: "number",
                required: true,
                options: [],
                showWhen: { questionId: "parent", equals: "SIM" },
              },
            ],
          },
        ],
      },
    };
    const first = freshTemplate(template),
      second = freshTemplate(template);
    const [parent, child] = first.sections[0].questions;
    expect(parent.id).not.toBe("parent");
    expect(child.id).not.toBe("days");
    expect(child.showWhen?.questionId).toBe(parent.id);
    expect(second.sections[0].questions[0].id).not.toBe(parent.id);
    expect(getNumberBounds(child)).toEqual({ min: 0, max: 7, integerOnly: true });
    expect(template.schema.sections[0].questions[1].showWhen?.questionId).toBe("parent");
    expect(inspectSchema(first)).toEqual([]);
  });
  it("removes stale conditional descendants transitively", () => {
    const schema = {
      sections: [
        {
          title: "Teste",
          questions: [
            {
              id: "a",
              label: "Pergunta A",
              type: "single_choice" as const,
              required: true,
              options: ["SIM", "NAO"],
            },
            {
              id: "b",
              label: "Pergunta B",
              type: "single_choice" as const,
              required: false,
              options: ["SIM", "NAO"],
              showWhen: { questionId: "a", equals: "SIM" },
            },
            {
              id: "c",
              label: "Pergunta C",
              type: "short_text" as const,
              required: false,
              options: [],
              showWhen: { questionId: "b", equals: "SIM" },
            },
          ],
        },
      ],
    };
    expect(cleanAnswers(schema, { a: "NAO", b: "SIM", c: "stale" })).toEqual({ a: "NAO" });
  });
  it("preserves chosen times and validates explicit custom hours and profile schedules", () => {
    const settings = config();
    const base = {
      ...initialResearchJourney(settings),
      days: [1],
      originArea: "Aldeota",
      outboundTime: "08:30",
    };
    expect(() => validateJourney(base, settings)).toThrow(/Outro horário/);
    expect(validateJourney({ ...base, otherOutboundTime: true }, settings).outboundTime).toBe(
      "08:30",
    );
    settings.profileSchedules = [
      {
        profile: "PASSAGEIRO",
        days: [2],
        outboundTimes: ["08:30"],
        returnTimes: [],
        flexibilityMinutes: 5,
      },
    ];
    expect(effectiveResearchSchedule(settings, "PASSAGEIRO").days).toEqual([2]);
    expect(() => validateJourney({ ...base, days: [1] }, settings)).toThrow(/dias/);
    expect(validateJourney({ ...base, days: [2] }, settings).outboundTime).toBe("08:30");
    expect(() => validateJourney({ ...base, days: [2], flexibilityMinutes: 10 }, settings)).toThrow(
      /flexibilidade/,
    );
  });
  it("does not assign payment semantics to a different question type", () => {
    expect(
      inspectSchema({
        sections: [
          {
            title: "Teste",
            questions: [
              {
                id: "q",
                type: "number",
                label: "Valor pago",
                required: false,
                options: [],
                semanticCode: "WILLINGNESS_TO_PAY",
              },
            ],
          },
        ],
      }),
    ).toContain(
      "Seção 1, pergunta 1: a classificação analítica não corresponde ao tipo da pergunta.",
    );
  });
  it("uses return slots for a return-only journey without rewriting the time", () => {
    const settings = { ...config(), outboundTimes: ["07:00"], returnTimes: ["18:00"] };
    const journey = {
      ...initialResearchJourney(settings),
      originArea: "Campus",
      destinationArea: "Aldeota",
      days: [1],
      direction: "VOLTA" as const,
      outboundTime: "18:00",
    };
    expect(validateJourney(journey, settings).outboundTime).toBe("18:00");
    expect(() => validateJourney({ ...journey, outboundTime: "07:00" }, settings)).toThrow(
      /Outro horário/,
    );
  });
  it("exports aggregate columns only and neutralizes spreadsheet formulas", () => {
    const csv = exportResearchSummary([
      {
        version_id: "v1",
        semantic_code: "ADOPTION_INTENT",
        category: "=SUM(A1)",
        eligible: 10,
        answered: 8,
        total: 7,
        private_contact: "secret@example.test",
        receipt: "secret",
      },
    ]);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).not.toContain("secret");
    expect(csv).toContain("eligible,answered,total");
  });
});
