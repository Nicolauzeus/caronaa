import { describe, expect, it } from "vitest";
import { prepareStsRideDraft, publicationDetailsSchema, type StsRideSeed } from "./ride-activation";

const now = new Date("2026-10-07T12:00:00-03:00");
const seed: StsRideSeed = {
  submissionId: "b51c1e71-59d8-4aab-850a-af4a584fc103",
  intent: "PASSAGEIRO",
  origin: "Centro de Eventos do Ceará",
  destination: "Aldeota",
  createdAt: "2026-10-07T10:00:00-03:00",
  raw: {
    eventPresenceDays: ["DIA_08"],
    departureTime: "20:00",
    passengerCount: 1,
    passengerFairPrice: 10,
  },
};
describe("Conversão STS para publicação", () => {
  it("ignora preço do browser; o payload de formulário não carrega tarifa", () => {
    const details = publicationDetailsSchema.parse({
      origin: "Centro",
      destination: "Aldeota",
      rideDate: "2026-10-08",
      departureTime: "20:00",
      count: 1,
      price: 999,
    });
    expect(details).not.toHaveProperty("price");
  });
  it("prepara passageiro sem converter gasto de pesquisa em preço da carona", () => {
    const draft = prepareStsRideDraft(seed, "request", now);
    expect(draft.classification).toBe("sufficient");
    expect(draft.details).toMatchObject({
      rideDate: "2026-10-08",
      departureTime: "20:00",
      count: 1,
    });
    expect(seed.raw.passengerFairPrice).toBe(10);
    expect(draft.details).not.toHaveProperty("price");
  });
  it("prepara motorista sem exigir um preço manual", () => {
    expect(
      prepareStsRideDraft(
        {
          ...seed,
          intent: "MOTORISTA",
          raw: { ...seed.raw, availableSeats: 2, totalPrice: 20, audience: "ANY" },
        },
        "offer",
        now,
      ).classification,
    ).toBe("sufficient");
  });
  it("não transforma janela em horário nem preço por vaga em valor total", () => {
    const draft = prepareStsRideDraft(
      {
        ...seed,
        raw: {
          eventPresenceDays: ["DIA_08"],
          departureWindow: "19_20",
          availableSeats: 2,
          driverPrice: 10,
        },
      },
      "offer",
      now,
    );
    expect(draft.classification).toBe("partial");
    expect(draft.missing).toEqual(expect.arrayContaining(["departureTime", "audience"]));
    expect(draft.missing).not.toContain("price");
  });
  it("não escolhe um dia quando existem vários", () => {
    expect(
      prepareStsRideDraft(
        { ...seed, raw: { ...seed.raw, eventPresenceDays: ["DIA_07", "DIA_08"] } },
        "request",
        now,
      ).details.rideDate,
    ).toBeUndefined();
  });
  it("usa o dia da inscrição para HOJE, não o dia do login", () => {
    expect(
      prepareStsRideDraft(
        { ...seed, raw: { ...seed.raw, eventPresenceDays: ["HOJE"] } },
        "request",
        new Date("2026-10-08T12:00:00-03:00"),
      ).classification,
    ).toBe("expired");
  });
  it("não ativa data passada ou evento encerrado", () => {
    expect(
      prepareStsRideDraft(seed, "request", new Date("2026-10-10T10:00:00-03:00")).classification,
    ).toBe("expired");
  });
  it("classifica ausência de rota como insuficiente", () => {
    expect(
      prepareStsRideDraft({ ...seed, origin: null, destination: "", raw: {} }, "request", now)
        .classification,
    ).toBe("insufficient");
  });
  it("preserva coordenadas reais inclusive zero", () => {
    expect(
      prepareStsRideDraft(
        { ...seed, raw: { ...seed.raw, originLocation: { lat: 0, lng: -38.5 } } },
        "request",
        now,
      ).details,
    ).toMatchObject({ originLat: 0, originLng: -38.5 });
  });
  it("os papéis são por viagem, não por conta", () => {
    const raw = { ...seed.raw, totalPrice: 20, availableSeats: 2, audience: "ANY" };
    expect(
      prepareStsRideDraft({ ...seed, intent: "MOTORISTA", raw }, "request", now).classification,
    ).toBe("sufficient");
    expect(
      prepareStsRideDraft({ ...seed, intent: "PASSAGEIRO", raw }, "offer", now).classification,
    ).toBe("sufficient");
  });
});
