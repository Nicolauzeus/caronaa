import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid, ensureUuid, uuidSchema } from "@/lib/uuid";
import { loadFormDraft, saveFormDraft } from "./draft-storage";
import { prepareSubmission } from "./submission";
import { buildFormSubmissionRow } from "./form-submission-service";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("UUID da conclusão do formulário", () => {
  it("gera UUIDv4 em HTTP sem randomUUID usando criptografia real", () => {
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const first = createUuid();
    expect(uuidSchema.safeParse(first).success).toBe(true);
    expect(first[14]).toBe("4");
    expect(createUuid()).not.toBe(first);
  });

  it("preserva UUID válido nas novas tentativas", () => {
    const id = createUuid();
    expect(ensureUuid(id)).toBe(id);
  });

  it("recupera o rascunho legado sem perder respostas", () => {
    sessionStorage.setItem("caronaa-formulario-draft-v1", JSON.stringify({
      data: { submissionId: "1791411382447-pvn37gce0g", name: "Participante" },
      step: "CONTACT", savedAt: Date.now(),
    }));
    const draft = loadFormDraft();
    expect(uuidSchema.safeParse(draft?.data.submissionId).success).toBe(true);
    expect(draft?.data.name).toBe("Participante");
    expect(loadFormDraft()?.data.submissionId).toBe(draft?.data.submissionId);
    saveFormDraft(draft!.data, "CONTACT");
    expect(loadFormDraft()?.data.submissionId).toBe(draft?.data.submissionId);
  });

  it("envia o mesmo UUID válido no payload e na coluna do banco", () => {
    const payload = prepareSubmission({
      source: "sts-2026",
      intent: "PASSAGEIRO", destinationNeighborhood: "Aldeota",
      departureWindow: "19_20", name: "Participante", whatsapp: "85999999999",
      submissionId: "1791411382447-pvn37gce0g",
    });
    expect(uuidSchema.safeParse(payload.submissionId).success).toBe(true);
    expect(buildFormSubmissionRow(payload).submission_id).toBe(payload.submissionId);
  });

  it("falha explicitamente quando não existe criptografia segura", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createUuid).toThrow("geração segura de UUID");
  });
});
