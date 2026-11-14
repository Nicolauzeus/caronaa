import { describe, expect, it } from "vitest";
import { quickRideSubmissionError } from "./quick-ride-errors";

describe("F07: mensagens seguras no envio da corrida", () => {
  it("separa cotação expirada de destino sem verificação", () => {
    expect(quickRideSubmissionError("Quote expired")).toMatch(/expirou/);
    expect(quickRideSubmissionError("Quote destination is not verified")).toMatch(/município de destino/);
    expect(quickRideSubmissionError("Quote expired or missing verified destination")).toMatch(/expirou/);
  });
  it("informa bloqueios operacionais sem expor detalhes do banco", () => {
    expect(quickRideSubmissionError("Destination not approved for this mode")).toMatch(/não está habilitado/);
    expect(quickRideSubmissionError("Origin, tariff or intermunicipal dispatch unavailable")).toMatch(/tarifa/);
    expect(quickRideSubmissionError("Pilot dispatch window has ended")).toMatch(/testes/);
    expect(quickRideSubmissionError("relation secret_table does not exist")).not.toContain("secret_table");
  });
});
