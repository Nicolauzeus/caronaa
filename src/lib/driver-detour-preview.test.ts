import { describe, expect, it } from "vitest";
import { calculateDriverDetour } from "./driver-detour";

describe("Google Routes: desvio informado ao motorista", () => {
  it("usa duração rodoviária e não diferença de horários", () => {
    expect(calculateDriverDetour(20, 12, 24, 14.5, 30)).toEqual({
      detourMinutes: 4, detourKm: 2.5, combinedAddedMinutes: 10, withinLimits: true,
    });
  });
  it("não considera aumento de duração negativo como desvio", () => {
    expect(calculateDriverDetour(20, 12, 18, 11, 19)).toEqual({
      detourMinutes: 0, detourKm: 0, combinedAddedMinutes: 0, withinLimits: true,
    });
  });
  it("bloqueia pedido acima de 6 minutos mesmo abaixo de 15 agregados", () => {
    expect(calculateDriverDetour(20, 12, 26.1, 14, 33).withinLimits).toBe(false);
  });
  it("bloqueia rota agregada acima de 15 minutos", () => {
    expect(calculateDriverDetour(20, 12, 25, 14, 35.1).withinLimits).toBe(false);
  });
  it("aceita os limiares exatos", () => {
    expect(calculateDriverDetour(20, 12, 26, 13, 35).withinLimits).toBe(true);
  });
});
