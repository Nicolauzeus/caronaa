import { describe, expect, it } from "vitest";
import { normalizeStsSource, getCampaignAttribution, STS_2026_SOURCE } from "@/lib/funnel-events";
import { prepareSubmission } from "@/lib/formulario/submission";
import { buildFormSubmissionRow } from "@/lib/formulario/form-submission-service";
import { saveFormConversionDraft, getFormConversionDraft } from "@/lib/formulario/conversion";
import {
  getVerificationLabel,
  getVerificationDescription,
  isUniforEmail,
  type UserVerification,
} from "@/lib/user-verifications";
import type { CaronaaStsFormData } from "@/lib/formulario/types";

describe("Selo STS 2026 - Padronização do identificador oficial e fluxo de verificação", () => {
  it("padroniza o identificador oficial para sts-2026", () => {
    expect(STS_2026_SOURCE).toBe("sts-2026");
    expect(normalizeStsSource(undefined)).toBe("direct");
    expect(normalizeStsSource(null)).toBe("direct");
    expect(normalizeStsSource("")).toBe("direct");
  });

  it("substitui variações legadas (sts2026, sts_2026, STS-2026) por sts-2026", () => {
    expect(normalizeStsSource("sts2026")).toBe("sts-2026");
    expect(normalizeStsSource("sts_2026")).toBe("sts-2026");
    expect(normalizeStsSource("sts-2026")).toBe("sts-2026");
    expect(normalizeStsSource("STS2026")).toBe("sts-2026");
    expect(normalizeStsSource("STS_2026")).toBe("sts-2026");
    expect(normalizeStsSource("STS-2026")).toBe("sts-2026");
    expect(normalizeStsSource("  sts2026  ")).toBe("sts-2026");
  });

  it("preserva fontes de tráfego que não são variações do STS", () => {
    expect(normalizeStsSource("instagram")).toBe("instagram");
    expect(normalizeStsSource("linkedin")).toBe("linkedin");
    expect(normalizeStsSource("qr")).toBe("qr");
  });

  it("garante que novas submissões do formulário são preparadas com source = 'sts-2026'", () => {
    const baseFormData: CaronaaStsFormData = {
      source: "sts2026", // simulando dado de entrada legado
      intent: "PASSAGEIRO",
      destinationNeighborhood: "Aldeota",
      originNeighborhood: "Centro de Eventos do Ceará",
      departureWindow: "21_22",
      name: "Maria Participante",
      whatsapp: "85999990000",
      email: "participante@evento.com",
      passengerInterest: "USARIA_HOJE",
      termsAccepted: true,
      privacyAccepted: true,
    };

    const submission = prepareSubmission(baseFormData);
    expect(submission.source).toBe("sts-2026");

    const dbRow = buildFormSubmissionRow(submission);
    expect(dbRow.source).toBe("sts-2026");
    expect(dbRow.email).toBe("participante@evento.com");
  });

  it("garante que o rascunho de conversão para cadastro salva source = 'sts-2026'", () => {
    sessionStorage.clear();

    saveFormConversionDraft({
      source: "sts_2026",
      name: "João STS",
      email: "joao@evento.com",
      whatsapp: "85988887777",
      intent: "MOTORISTA",
    });

    const draft = getFormConversionDraft();
    expect(draft?.source).toBe("sts-2026");
    expect(draft?.email).toBe("joao@evento.com");
  });

  it("garante o alinhamento com a regra do banco (0018_create_user_verifications): 'sts-2026'", () => {
    // A regra da migration 0018 exige:
    // lower(btrim(fs.source)) = 'sts-2026'
    // e tipo de verificação STS_2026 com instituição Siará Tech Summit 2026
    const expectedDbSource = "sts-2026";
    const normalizedInput = normalizeStsSource("sts2026").toLowerCase().trim();

    expect(normalizedInput).toBe(expectedDbSource);

    // Valida que o selo STS_2026 está configurado corretamente
    expect(getVerificationLabel("STS_2026")).toBe("STS 2026");
    expect(getVerificationDescription("STS_2026")).toContain("Siará Tech Summit 2026");

    const mockVerification: UserVerification = {
      id: "v-1",
      user_id: "u-1",
      type: "STS_2026",
      status: "VERIFIED",
      source: "EVENT_FORM",
      institution_name: "Siará Tech Summit 2026",
      verified_email: "participante@evento.com",
      source_reference_id: "sub-1",
      verified_at: "2026-10-06T20:00:00Z",
      created_at: "2026-10-06T20:00:00Z",
      updated_at: "2026-10-06T20:00:00Z",
    };

    expect(mockVerification.type).toBe("STS_2026");
    expect(mockVerification.status).toBe("VERIFIED");
    expect(mockVerification.source).toBe("EVENT_FORM");
  });

  it("não altera a regra da UNIFOR", () => {
    expect(isUniforEmail("aluno@unifor.br")).toBe(true);
    expect(isUniforEmail("professor@edu.unifor.br")).toBe(true);
    expect(isUniforEmail("participante@evento.com")).toBe(false);
    expect(isUniforEmail("qualquer@gmail.com")).toBe(false);
    expect(getVerificationLabel("UNIFOR")).toBe("UNIFOR");
    expect(getVerificationDescription("UNIFOR")).toContain("UNIFOR");
  });
});
