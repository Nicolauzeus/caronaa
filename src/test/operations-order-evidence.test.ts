import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read=(name:string)=>readFileSync("drizzle/migrations/"+name,"utf8");
const cancel=read("0248_order_passenger_cancel_evidence.sql");
const notification=read("0249_order_notification_receipts.sql");
const report=read("0250_admin_operations_order_evidence.sql");

describe("order evidence contracts",()=>{
 it("records only an authenticated passenger's cancellation and preserves the existing lifecycle",()=>{
  expect(cancel).toContain("auth.uid() IS DISTINCT FROM v_passenger");
  expect(cancel).toContain("AFTER UPDATE OF status");
  expect(cancel).toContain("passenger_id=auth.uid()");
  expect(cancel).toContain("AND reason_code IS NULL");
  expect(cancel).toContain("ON CONFLICT(service,request_id) DO NOTHING");
  expect(cancel).not.toMatch(/UPDATE public\.(professional_quick_rides|ride_requests)/i);
 });
 it("keeps durable view receipts independent of live radar removal",()=>{
  expect(notification).toContain("AFTER INSERT OR UPDATE ON public.quick_ride_driver_views");
  expect(notification).toContain("least(h.first_viewed_at,excluded.first_viewed_at)");
  expect(notification).toContain("greatest(h.last_viewed_at,excluded.last_viewed_at)");
  expect(notification).not.toContain("DELETE FROM public.quick_ride_driver_views");
 });
 it("restricts dispatch receipts and distinguishes provider acceptance from delivery",()=>{
  expect(notification).toContain("auth.role() IS DISTINCT FROM 'service_role'");
  expect(notification).toContain("TO service_role;");
  expect(notification).toContain("'provider_accepted','delivery_confirmed'");
  expect(notification).toContain("ON CONFLICT(service,request_id,driver_id,channel,dispatch_key,stage) DO NOTHING");
 });
 it("reports only observed evidence and avoids counting live views twice",()=>{
  expect(report).toContain("public.has_role(auth.uid(),'admin'::public.app_role)");
  expect(report).toContain("IS DISTINCT FROM 'quick_ride_driver_views'");
  expect(report).toContain("count(DISTINCT driver_id)");
  expect(report).toContain("partial_or_unavailable");
  expect(report).toContain("caronaa_order_passenger_cancellations");
 });
});
