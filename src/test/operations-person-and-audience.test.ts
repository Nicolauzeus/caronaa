import {describe,it,expect,vi} from "vitest";
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
import {audienceSchema,createOperationsService,type OperationalOverview} from "@/services/operations-service";
import {buildOperationalFindings} from "@/components/admin/OperationsAudienceDiagnostics";
const id="10000000-0000-4000-8000-000000000001";
const period={from:"2025-01-15",to:"2025-01-15",service:"all" as const};
const audience={flash_orders:3,snapshot_known:2,snapshot_unknown:1,snapshot_zero:1,snapshot_with_candidates:1,unserved_snapshot_zero:1,unserved_snapshot_with_candidates:1,unserved_snapshot_unknown:0,orders_with_queue_signal:3,orders_with_app_ack:1,app_ack_driver_order_pairs:1};
const data={kpis:{summary:{unserved:2,requested:3},hours:[{hour:18,requests:2,unserved:2}]},audience,diagnostics:{notification_diagnostics:{orders_with_observed_send_failure:0,unserved_with_observed_send_failure:0}}} as unknown as OperationalOverview;
describe("individual histories and evidence diagnostics",()=>{
 it("validates the observed audience and rejects fabricated zero coverage",()=>{
  expect(audienceSchema.safeParse(audience).success).toBe(true);
  expect(audienceSchema.safeParse({...audience,snapshot_zero:2}).success).toBe(false);
 });
 it("separates known zero, known candidates and unknown coverage in findings",()=>{
  expect(buildOperationalFindings(data).map(x=>x.id)).toEqual(["unserved","zero","with-candidates","unknown","hour"]);
  expect(buildOperationalFindings({...data,audience:null}).map(x=>x.id)).toEqual(["unserved","hour"]);
 });
 it("does not infer notification failure from missing telemetry",()=>{
  const findings=buildOperationalFindings(data);
  expect(findings.some(f=>f.id==="send")).toBe(false);
  expect(buildOperationalFindings({...data,diagnostics:{...data.diagnostics,notification_diagnostics:{...data.diagnostics.notification_diagnostics,orders_with_observed_send_failure:1,unserved_with_observed_send_failure:1}}}).some(f=>f.id==="send")).toBe(true);
 });
 it("uses scoped account history with server-side pagination",async()=>{
  const rpc=vi.fn(async()=>({data:null,error:null}));
  const service=createOperationsService({rpc});
  expect(await service.getPersonHistory(id,"driver",period,10,20)).toBeNull();
  expect(rpc).toHaveBeenCalledWith("admin_operational_person_history",{p_from:period.from,p_to:period.to,p_service:"all",p_person_id:id,p_role:"driver",p_limit:10,p_offset:20});
 });
 it("stores an attempt reason separately from a terminal request reason",async()=>{
  const rpc=vi.fn(async()=>({data:true,error:null}));
  const service=createOperationsService({rpc});
  expect(await service.recordSharedAttemptReason(id,"PRICE")).toBe(true);
  expect(rpc).toHaveBeenCalledWith("caronaa_record_shared_attempt_cancel_reason",{p_ride_id:id,p_reason_code:"PRICE"});
 });
});
