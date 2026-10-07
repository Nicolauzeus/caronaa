import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { createUuid, uuidSchema } from "@/lib/uuid";
import { getAnonymousSessionId } from "@/lib/funnel-events";
import { TRUST_FACTORS, type CaronaaStsFormData, type TrustFactor } from "./types";
import { caronaaStsFormSchema, trustFactorSchema } from "./schema";
import { prepareSubmission } from "./submission";
import { buildFormSubmissionRow, saveFormSubmission } from "./form-submission-service";
import { loadFormDraft, saveFormDraft } from "./draft-storage";
import { getFormConversionDraft, FORM_CONVERSION_STORAGE_KEY } from "./conversion";

const base: CaronaaStsFormData = {
  source: "sts-2026",
  originNeighborhood: "Aldeota",
  destinationNeighborhood: "UNIFOR",
  departureWindow: "19_20",
  occupation: "ESTUDANTE",
  name: "Ana Silva",
  whatsapp: "85999999999",
  termsAccepted: true,
  privacyAccepted: true,
  passengerTransports: ["ONIBUS"],
  passengerDifficulties: ["DEMORA"],
  passengerFairPrice: 10,
  passengerIntention: "TALVEZ",
  passengerTrustFactors: ["MESMO_GENERO"],
  vehicleType: "CARRO_PROPRIO",
  availableSeats: 2,
  driverPrice: 10,
  driverRealValidation: "COM_CERTEZA",
  driverTrustFactors: ["MESMO_GENERO"],
  driverComfortFactors: ["MESMO_GENERO"],
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("form trust and submission identity", () => {
  it("keeps the TypeScript and Zod trust factor lists identical", () => {
    const factor: TrustFactor = "MESMO_GENERO";
    expect(trustFactorSchema.parse(factor)).toBe(factor);
    expect(trustFactorSchema.options).toEqual([...TRUST_FACTORS]);
    expect(TRUST_FACTORS).toHaveLength(12);
  });
  it.each(["PASSAGEIRO", "MOTORISTA", "AMBOS"] as const)(
    "accepts MESMO_GENERO through the final %s payload",
    (intent) => {
      const data = { ...base, intent, dualPriority: "PEGAR" as const, submissionId: createUuid() };
      const validation = caronaaStsFormSchema.safeParse(data);
      expect(validation.success, JSON.stringify(validation)).toBe(true);
      const payload = prepareSubmission(data);
      if (intent !== "MOTORISTA") expect(payload.passengerTrustFactors).toContain("MESMO_GENERO");
      if (intent !== "PASSAGEIRO") expect(payload.driverTrustFactors).toContain("MESMO_GENERO");
      const row = buildFormSubmissionRow(payload);
      expect(uuidSchema.safeParse(row.submission_id).success).toBe(true);
      expect(row.submissionId).toBe(payload.submissionId);
    },
  );
  it("generates UUIDs with native crypto and a cryptographically secure fallback", () => {
    vi.stubGlobal("crypto", webcrypto);
    expect(uuidSchema.safeParse(createUuid()).success).toBe(true);
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    expect(createUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  it("fails clearly instead of using Math.random without secure crypto", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createUuid).toThrow("geração segura de UUID");
  });
  it("repairs and persists a legacy draft ID once", () => {
    sessionStorage.setItem(
      "caronaa-formulario-draft-v1",
      JSON.stringify({
        data: { ...base, intent: "PASSAGEIRO", submissionId: "1791407267769-szw81qxpsk" },
        step: "CONTACT",
        savedAt: Date.now(),
      }),
    );
    const first = loadFormDraft()!;
    expect(uuidSchema.safeParse(first.data.submissionId).success).toBe(true);
    expect(loadFormDraft()?.data.submissionId).toBe(first.data.submissionId);
    const payload = prepareSubmission({ ...base, ...first.data, intent: "PASSAGEIRO" });
    saveFormDraft({ ...base, intent: "PASSAGEIRO", submissionId: payload.submissionId }, "CONTACT");
    const retried = prepareSubmission({ ...base, ...loadFormDraft()!.data, intent: "PASSAGEIRO" });
    expect(retried.submissionId).toBe(payload.submissionId);
  });
  it("repairs a legacy ID passed directly to payload preparation", () => {
    const payload = prepareSubmission({
      ...base,
      intent: "PASSAGEIRO",
      submissionId: "1791407267769-szw81qxpsk",
    });
    expect(uuidSchema.safeParse(payload.submissionId).success).toBe(true);
  });
  it("does not send an invalid submission ID to Supabase", async () => {
    const payload = prepareSubmission({ ...base, intent: "PASSAGEIRO" });
    await expect(
      saveFormSubmission({ ...payload, submissionId: "legacy-invalid" }, null),
    ).rejects.toBeInstanceOf(ZodError);
    expect(() => buildFormSubmissionRow({ ...payload, submissionId: "legacy-invalid" })).toThrow();
  });
  it("replaces legacy anonymous-session identifiers once", () => {
    localStorage.setItem("caronaa-anonymous-session-id", "1791407267769-szw81qxpsk");
    const id = getAnonymousSessionId();
    expect(uuidSchema.safeParse(id).success).toBe(true);
    expect(getAnonymousSessionId()).toBe(id);
  });
  it("never invents a foreign key for a legacy completed conversion", () => {
    sessionStorage.setItem(
      FORM_CONVERSION_STORAGE_KEY,
      JSON.stringify({ submissionId: "1791407267769-szw81qxpsk", name: "Ana" }),
    );
    expect(getFormConversionDraft()).toMatchObject({ submissionId: null, name: "Ana" });
    expect(JSON.parse(sessionStorage.getItem(FORM_CONVERSION_STORAGE_KEY)!)).toHaveProperty(
      "submissionId",
      null,
    );
  });
});
