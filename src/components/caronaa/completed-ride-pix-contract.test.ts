import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";

const safety=readFileSync("src/components/caronaa/RideSafetyPanel.tsx","utf8");
const pix=readFileSync("src/components/caronaa/DriverPix.tsx","utf8");
const sql=readFileSync("drizzle/migrations/0111_driver_only_completed_ride_pix.sql","utf8");
const integration=readFileSync("src/test/ride-fare-quote.integration.sql","utf8");

describe("Completed ride Pix is role-specific and never a confirmed Asaas charge",()=>{
 it("shows the legacy QR only for the driver after trip completion",()=>{
   expect(safety).toContain('currentStatus === "COMPLETED" && role === "driver"');
   expect(safety).toContain("<CompletedRidePix rideId={rideId} />");
   expect(safety).toContain('currentStatus === "COMPLETED" && role === "passenger"');
   expect(safety).toContain("nenhuma cobrança automática foi confirmada");
   expect(safety).not.toContain('currentStatus === "COMPLETED" && <CompletedRidePix rideId={rideId} />');
 });
 it("preserves payer-only Asaas preview in the trip route",()=>{
   const route=readFileSync("src/routes/_authenticated/viagem.$rideId.tsx","utf8");
   expect(route).toContain('ride.role === "passenger"');
   expect(route).toContain("<AsaasCheckoutPreview rideId={ride.rideId} />");
   expect(pix).toContain("QR manual legado");
   expect(pix).toContain("não confirma recebimento");
 });
 it("enforces driver authorization at the SQL boundary and does not change ride/payment data",()=>{
   expect(sql).toContain("r.driver_user_id IS DISTINCT FROM auth.uid()");
   expect(sql).toContain("r.status <> 'COMPLETED'");
   expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_ride_pix(uuid)");
   expect(sql).toContain("TO authenticated");
   expect(sql).not.toMatch(/\b(INSERT INTO|DELETE FROM|UPDATE public\.rides|TRUNCATE)\b/);
   expect(integration).toContain("'Pix privado do motorista'");
   expect(integration).toContain("'Driver Pix reflects completed group fare'");
 });
});
