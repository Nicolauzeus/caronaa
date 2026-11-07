import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0131_manual_payment_and_driver_fee_gate.sql", "utf8");
const pix = readFileSync("src/components/caronaa/DriverPix.tsx", "utf8");
const fees = readFileSync("src/components/caronaa/DriverPlatformFees.tsx", "utf8");
const finance = readFileSync("src/components/admin/PlatformFeeFinance.tsx", "utf8");
const shell = readFileSync("src/components/caronaa/AppShell.tsx", "utf8");
const home = readFileSync("src/routes/_authenticated/home.tsx", "utf8");
const offer = readFileSync("src/routes/_authenticated/oferecer.tsx", "utf8");

describe("Manual payments and platform fee policy", () => {
  it("requires both completed-ride participants to affirm receipt and counts one debt per ride", () => {
    expect(migration).toContain("v_ride.status <> 'COMPLETED'");
    expect(migration).toContain("v_user IS DISTINCT FROM v_ride.passenger_user_id");
    expect(migration).toContain("v_user IS DISTINCT FROM v_ride.driver_user_id");
    expect(migration).toContain("v_status.passenger_confirmed_at IS NOT NULL AND v_status.driver_confirmed_at IS NOT NULL");
    expect(migration).toContain("ON CONFLICT(ride_id) DO NOTHING");
    expect(migration).toContain("round(v_gross*0.15,2)");
    expect(pix).toContain("Já fiz o Pix");
    expect(pix).toContain("Recebi o Pix no banco");
  });
  it("does not assume settlement from a claimed transfer", () => {
    expect(migration).toContain("status='CLAIMED'");
    expect(migration).toContain("status='SETTLED'");
    expect(migration).toContain("has_admin_department_access('finance',true)");
    expect(migration).toContain("public.verify_driver_platform_fee");
    expect(fees).toContain("Enviei o repasse");
    expect(finance).toContain("Recebimento conferido");
    expect(migration).not.toContain("UPDATE public.payments SET status='PAID'");
  });
  it("blocks new driver activity after three unpaid trips without blocking passenger journeys", () => {
    expect(migration).toContain("f.status <> 'SETTLED') < 3");
    for (const name of [
      "ride_offer_driver_debt",
      "ride_routine_driver_debt",
      "ride_match_driver_debt",
      "presence_driver_debt",
      "professional_location_driver_debt",
      "quick_ride_accept_driver_debt",
    ]) expect(migration).toContain(name);
    expect(migration).toContain("professional_presence SET is_available=false");
    expect(migration).toContain("DELETE FROM public.professional_driver_locations");
    expect(offer).toContain("driverAllowed !== true");
  });
  it("exposes an explicit four-tab navigation and distinct roles", () => {
    expect(shell).toContain('label: "Oferecer"');
    expect(shell).toContain('label: "Viagens"');
    expect(shell).toContain('"grid-cols-4"');
    expect(home).toContain("Confirmar Carona");
    expect(home).not.toContain("Vou dirigindo");
    expect(offer).toContain("Vagas disponíveis");
    expect(offer).toContain("Publicar Viagem");
  });
});

