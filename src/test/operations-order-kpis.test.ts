import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const facts=readFileSync("drizzle/migrations/0251_operational_order_facts.sql","utf8");
const kpis=readFileSync("drizzle/migrations/0252_admin_operational_order_kpis.sql","utf8");
describe("operational KPI SQL contract",()=>{
 it("aggregates all shared attempts without multiplying requests or quotes",()=>{
  expect(facts).toContain("LEFT JOIN LATERAL");
  expect(facts).toContain("bool_or");
  expect(facts).toContain("count(DISTINCT f.customer_pays_cents)");
  expect(facts).toContain("LIMIT 1");
  expect(facts).toContain("SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)");
 });
 it("keeps never accepted separate from terminal unmet demand",()=>{
  expect(kpis).toContain("(o.cancelled OR o.expired) AND NOT o.accepted");
  expect(kpis).toContain("never_accepted");
  expect(kpis).toContain("cancelled_after_acceptance");
  expect(kpis).toContain("status='SEARCHING'");
 });
 it("uses safe denominators and observed wait samples",()=>{
  expect(kpis).toContain("nullif(count(*),0)");
  expect(kpis).toContain("first_accepted_at>=o.requested_at");
  expect(kpis).toContain("count(wait_seconds)");
  expect(kpis).toContain("percentile_cont(0.5)");
 });
 it("never equates gross quoted amount with platform revenue",()=>{
  expect(kpis).toContain("unserved_unknown_fare");
  expect(kpis).toContain("not platform revenue");
 });
 it("protects facts and separates observed notification stages",()=>{
  expect(facts).toContain("FROM PUBLIC,anon,authenticated,service_role");
  expect(kpis).toContain("public.has_role(auth.uid(),'admin'::public.app_role)");
  expect(kpis).toContain("count(DISTINCT (n.service,n.request_id,n.driver_id))");
  expect(kpis).toContain("absent stage means unknown");
 });
});
