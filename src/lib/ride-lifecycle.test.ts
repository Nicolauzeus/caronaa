import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transitionRide } from "./ride-lifecycle";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0016_ride_lifecycle_and_payment_model.sql"),
  "utf8",
);

const confirmed = { hasPersistedMatch: true, isParticipant: true, confirmedByBoth: true };

describe("ride lifecycle", () => {
  it("requires both participants to accept before confirming a match", () => {
    expect(transitionRide("MATCHED", "CONFIRMED", confirmed)).toBe("CONFIRMED");
    expect(() =>
      transitionRide("MATCHED", "CONFIRMED", { ...confirmed, confirmedByBoth: false }),
    ).toThrow("Both ride participants must accept");
    expect(transitionRide("CONFIRMED", "CONFIRMED", confirmed)).toBe("CONFIRMED");
  });

  it("allows completion only from IN_PROGRESS after both participants confirm", () => {
    expect(transitionRide("IN_PROGRESS", "COMPLETED", confirmed)).toBe("COMPLETED");
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, confirmedByBoth: false }),
    ).toThrow();
  });

  it("rejects duplicate completion because COMPLETED is terminal", () => {
    expect(() => transitionRide("COMPLETED", "COMPLETED", confirmed)).toThrow(
      "Invalid ride transition",
    );
  });

  it("rejects completion without a persisted match", () => {
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, hasPersistedMatch: false }),
    ).toThrow("persisted match");
  });

  it("rejects completion after cancellation", () => {
    expect(() => transitionRide("CANCELLED", "COMPLETED", confirmed)).toThrow(
      "Invalid ride transition",
    );
  });

  it("rejects client attempts when caller is not a ride participant", () => {
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, isParticipant: false }),
    ).toThrow("participants");
  });

  it("allows cancellation from MATCHED, CONFIRMED, and IN_PROGRESS", () => {
    expect(transitionRide("MATCHED", "CANCELLED", confirmed)).toBe("CANCELLED");
    expect(transitionRide("CONFIRMED", "CANCELLED", confirmed)).toBe("CANCELLED");
    expect(transitionRide("IN_PROGRESS", "CANCELLED", confirmed)).toBe("CANCELLED");
  });

  it("treats CANCELLED to CANCELLED as idempotent", () => {
    expect(transitionRide("CANCELLED", "CANCELLED", confirmed)).toBe("CANCELLED");
  });

  it("rejects transitions once cancelled or completed", () => {
    expect(() => transitionRide("CANCELLED", "CONFIRMED", confirmed)).toThrow(
      "Invalid ride transition",
    );
    expect(() => transitionRide("COMPLETED", "CANCELLED", confirmed)).toThrow(
      "Invalid ride transition",
    );
  });

  it("provides correct nextActions for driver and passenger without redundant confirmation", async () => {
    const { getRideNextActions } = await import("./ride-lifecycle");
    const bilateralAcceptance = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0053_passenger_first_match_acceptance.sql"),
      "utf8",
    );

    // Passenger must accept first. Driver may only act after that acceptance.
    const matchedDriverActions = getRideNextActions("MATCHED", "driver");
    expect(matchedDriverActions).toEqual([
      { label: "Recusar combinação", status: "CANCELLED", variant: "outline" },
    ]);
    expect(getRideNextActions("MATCHED", "driver", { acceptedByOther: true })).toEqual([
      { label: "Aceitar combinação", status: "CONFIRMED" },
      { label: "Recusar combinação", status: "CANCELLED", variant: "outline" },
    ]);

    const matchedPassengerActions = getRideNextActions("MATCHED", "passenger");
    expect(matchedPassengerActions).toEqual([
      { label: "Aceitar combinação", status: "CONFIRMED" },
      { label: "Recusar combinação", status: "CANCELLED", variant: "outline" },
    ]);

    expect(getRideNextActions("MATCHED", "passenger", { acceptedByViewer: true })).toEqual([
      { label: "Retirar aceite", status: "CANCELLED", variant: "outline" },
    ]);
    expect(bilateralAcceptance).toContain(
      "DROP TRIGGER IF EXISTS a_accept_published_offer_fare ON public.rides",
    );
    expect(bilateralAcceptance).toContain(
      "IF caller = r.driver_user_id AND r.passenger_accepted_at IS NULL THEN",
    );
    expect(bilateralAcceptance).toContain("PASSENGER_ACCEPTED");
    expect(bilateralAcceptance).toContain("RIDE_CONFIRMED");
    expect(bilateralAcceptance).toContain("PROPOSAL_EXPIRED");
    expect(bilateralAcceptance).toContain("'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED'");
    expect(bilateralAcceptance).toContain("SET status = 'CANCELLED', transit_stage = 'CANCELLED'");

    // O inicio exige PIN no painel de seguranca; as acoes comuns permitem cancelar.
    const confirmedDriverActions = getRideNextActions("CONFIRMED", "driver");
    expect(confirmedDriverActions).toEqual([
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ]);

    const confirmedPassengerActions = getRideNextActions("CONFIRMED", "passenger");
    expect(confirmedPassengerActions).toEqual([
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ]);

    // IN_PROGRESS: motorista e passageiro podem concluir ou cancelar
    const inProgressActions = getRideNextActions("IN_PROGRESS", "driver");
    expect(inProgressActions).toEqual([
      { label: "Concluir viagem", status: "COMPLETED" },
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ]);

    // Estados terminais: sem ações
    expect(getRideNextActions("COMPLETED", "driver")).toEqual([]);
    expect(getRideNextActions("CANCELLED", "passenger")).toEqual([]);
  });

  it("denies browser insertion of completion/payment domain events and payment writes", () => {
    expect(migration).toContain("'RIDE_COMPLETED', 'PAYMENT_COMPLETED'");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.rides");
    expect(migration).toContain(
      "public.ride_completion_confirmations, public.payments FROM anon, authenticated",
    );
    expect(migration).toContain(
      "CREATE TRIGGER ride_status_event AFTER UPDATE OF status ON public.rides",
    );
    expect(migration).toContain("CREATE UNIQUE INDEX product_events_ride_completed_once_idx");
  });

  it("verifies migration 0022 guarantees idempotent ride status transitions", () => {
    const migration0022 = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0022_idempotent_ride_confirmation.sql"),
      "utf8",
    );
    expect(migration0022).toContain("IF ride_row.status = p_next_status THEN");
    expect(migration0022).toContain("RETURN p_next_status;");
  });
});
