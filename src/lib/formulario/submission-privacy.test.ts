import { describe, expect, it } from "vitest";
import { prepareSubmission, sanitizeSubmissionRawPayload } from "./submission";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("submission raw payload minimization", () => {
  it("removes structured PII and fields from new raw payloads", () => {
    const submission = prepareSubmission({
      source: "test",
      intent: "PASSAGEIRO",
      destinationNeighborhood: "Centro",
      departureWindow: "19_20",
      name: "Ana Silva",
      whatsapp: "85999999999",
      email: "ana@example.com",
      occupation: "ESTUDANTE",
      originNeighborhood: "Sul",
      weeklyFrequency: "1_2",
      currentTransport: "ONIBUS",
      routeCostRange: "6_10",
      costPeriod: "POR_DIA",
      passengerInterest: "TALVEZ",
      painPoints: ["DOR_01"],
      mainPainPoint: "DOR_01",
      mainPainIntensity: 3,
    });
    const raw = sanitizeSubmissionRawPayload(submission);
    expect(raw).not.toHaveProperty("name");
    expect(raw).not.toHaveProperty("whatsapp");
    expect(raw).not.toHaveProperty("email");
    expect(raw).not.toHaveProperty("destinationNeighborhood");
    expect(raw).toHaveProperty("painPoints");
    expect(raw).toHaveProperty("mainPainIntensity", 3);
    expect(raw).not.toHaveProperty("source");
    expect(raw).not.toHaveProperty("createdAt");
    expect(raw).not.toHaveProperty("submissionId");
  });

  it("keeps PII in structured columns, not the raw JSON payload", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/lib/formulario/form-submission-service.ts"),
      "utf8",
    );
    expect(service).toContain("nome: payload.name");
    expect(service).toContain("whatsapp: payload.whatsapp");
    expect(service).toContain("email: payload.email");
    expect(service).toContain("raw_payload: sanitizeSubmissionRawPayload(payload)");
  });

  it("guarantees non-null passengerInterest when intent is PASSAGEIRO or AMBOS even if missing in form data", () => {
    const passengerSubmission = prepareSubmission({
      source: "test",
      intent: "PASSAGEIRO",
      destinationNeighborhood: "Centro",
      departureWindow: "19_20",
      name: "Ana Silva",
      whatsapp: "85999999999",
      passengerIntention: "COM_CERTEZA_HOJE",
    });
    expect(passengerSubmission.passengerInterest).toBe("USARIA_HOJE");

    const driverSubmission = prepareSubmission({
      source: "test",
      intent: "MOTORISTA",
      destinationNeighborhood: "Centro",
      departureWindow: "19_20",
      name: "Carlos Souza",
      whatsapp: "85988888888",
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 3,
      driverPrice: 12.0,
      driverRealValidation: "COM_CERTEZA",
    });
    expect(driverSubmission.driverInterest).toBe("USARIA_HOJE");
  });
});
