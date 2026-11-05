import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const safety = readFileSync("src/components/caronaa/RideSafetyPanel.tsx", "utf8");
const pix = readFileSync("src/components/caronaa/DriverPix.tsx", "utf8");
const chooser = readFileSync("src/components/caronaa/RidePaymentChoices.tsx", "utf8");
const route = readFileSync("src/routes/_authenticated/viagem.$rideId.tsx", "utf8");
const sql = readFileSync("drizzle/migrations/0130_manual_driver_pix.sql", "utf8");

describe("Manual driver Pix is limited to completed-ride participants", () => {
  it("shows Pix to both participants after completing the ride", () => {
    expect(safety).toContain('currentStatus === "COMPLETED" && (role === "driver" || role === "passenger")');
    expect(safety).toContain("<RidePaymentChoices rideId={rideId} role={role} />");
    expect(chooser).toContain("<CompletedRidePix rideId={rideId} role={role} />");
    expect(chooser).toContain('choice.method === "MANUAL_PIX"');
    expect(chooser).toContain('choice.method === "ASAAS_PIX"');
    expect(pix).toContain("Pix direto para o motorista");
    expect(pix).toContain("Vagas livres do motorista não entram neste valor.");
    expect(route).not.toContain("<AsaasCheckoutPreview");
  });
  it("does not fake receipt or mark the trip paid", () => {
    expect(pix).toContain("não verifica recebimento");
    expect(pix).not.toContain('status: "PAID"');
    expect(sql).toContain("'automaticConfirmation', false");
  });
  it("checks authenticated participation and requested seat count on server", () => {
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("r.passenger_user_id");
    expect(sql).toContain("r.driver_user_id");
    expect(sql).toContain("rr.passenger_count");
    expect(sql).toContain("r.passenger_group_total IS DISTINCT FROM v_total");
    expect(sql).toContain("r.status <> 'COMPLETED'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_ride_pix(uuid) TO authenticated");
    expect(sql).not.toMatch(/\bUPDATE\s+public\.rides\b/i);
  });
});
