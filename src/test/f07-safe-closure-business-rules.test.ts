import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const migration=readFileSync(
  "drizzle/migrations/0210_f07_safe_dropoff_completion_and_review.sql","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const driver=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const flashDriver=readFileSync("src/components/caronaa/shell/DriverFlashPlanner.tsx","utf8");
const admin=readFileSync("src/components/admin/QuickRideDisputesAdmin.tsx","utf8");
const guard=readFileSync("src/lib/role/role-switch-guard.ts","utf8");
const passengerHistory=readFileSync("src/components/caronaa/QuickRideTripHistory.tsx","utf8");
const driverHistory=readFileSync("src/routes/_authenticated/viagens-profissionais.tsx","utf8");
const checkout=readFileSync("src/components/caronaa/QuickRidePostTripFlow.tsx","utf8");

const sqlFunction=(name:string,next:string)=>{
  const start=migration.indexOf("CREATE OR REPLACE FUNCTION public."+name);
  const end=migration.indexOf("CREATE OR REPLACE FUNCTION public."+next,start+1);
  if(start<0||end<start)throw new Error("Missing SQL function boundary: "+name);
  return migration.slice(start,end);
};

describe("F07 lifecycle: transport end != payment or customer confirmation",()=>{
  it("uses a separate non-billing pending state in the server status constraint",()=>{
    expect(migration).toContain("'PENDING_REVIEW','COMPLETED','CANCELLED','EXPIRED'");
    expect(migration).toContain("quick_ride_completion_events");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.quick_ride_completion_events FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("UNIQUE (ride_id,event_type)");
    expect(migration.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("verifies driver location near the destination, with a bounded 120s deadline",()=>{
    const request=sqlFunction("quick_ride_request_dropoff","quick_ride_request_manual_review");
    expect(request).toContain("q.pickup_confirmed_at IS NULL");
    expect(request).toContain("l.accuracy_m>0 AND l.accuracy_m<=150");
    expect(request).toContain("l.sampled_at >= now()-interval '90 seconds'");
    expect(request).toContain("l.updated_at >= now()-interval '90 seconds'");
    expect(request).toContain("v_allowed:=greatest(150.0,least(250.0,v_accuracy+100.0))");
    expect(request).toContain("DROPOFF_TOO_FAR_FROM_DESTINATION");
    expect(request).toContain("DROPOFF_GPS_UNVERIFIED");
    expect(request).toContain("RETURN d.resolved_at IS NULL AND d.passenger_response IS NULL");
    expect(request).toContain("now()+interval '120 seconds'");
    expect(request).not.toContain("SET deadline_at=now()");
  });

  it("manual fallback releases only to admin review, never marks a ride as paid",()=>{
    const manual=sqlFunction("quick_ride_request_manual_review","quick_ride_respond_dropoff");
    expect(manual).toContain("char_length(v_reason) NOT BETWEEN 20 AND 1000");
    expect(manual).toContain("q.driver_id IS DISTINCT FROM auth.uid()");
    expect(manual).toContain("q.pickup_confirmed_at IS NULL");
    expect(manual).toContain("now()+interval '120 seconds'");
    expect(manual).toContain("'MANUAL_REVIEW',v_reason");
    expect(manual).toContain("RETURN d.resolved_at IS NULL AND d.passenger_response IS NULL");
    expect(manual).not.toContain("SET status='COMPLETED'");
    expect(manual).not.toContain("SET status='PENDING_REVIEW'");
    expect(manual).not.toContain("payment_status");
  });

  it("confirmed passenger response completes; contests go to review",()=>{
    const respond=sqlFunction("quick_ride_respond_dropoff","quick_ride_finalize_after_timeout");
    expect(respond).toContain("q.passenger_id IS DISTINCT FROM auth.uid()");
    expect(respond).toContain("d.deadline_at<=now()");
    expect(respond).toContain("(p_response IS NULL OR p_response NOT IN ('CONFIRMED','CONTESTED'))");
    expect(respond).toContain("THEN 'COMPLETED' ELSE 'PENDING_REVIEW' END");
    expect(respond).toContain("PASSENGER_CONTESTED");
    expect(respond).toContain("ON CONFLICT (ride_id,event_type) DO NOTHING");
  });

  it("never interprets passenger silence as consent to pay or platform fee",()=>{
    const timeout=sqlFunction("quick_ride_finalize_after_timeout","quick_ride_my_requests");
    expect(timeout).toContain("d.deadline_at>now()");
    expect(timeout).toContain("d.passenger_response IS NOT NULL");
    expect(timeout).toContain("d.resolved_at IS NOT NULL");
    expect(timeout).toContain("SET status='PENDING_REVIEW',completed_at=NULL");
    expect(timeout).toContain("TIMEOUT_PENDING_REVIEW");
    expect(timeout).not.toContain("SET status='COMPLETED'");
    expect(timeout).not.toContain("quick_ride_declare_manual_pix");
    expect(timeout).not.toContain("caronaa_accrue_completed_quick_ride_fee");
  });

  it("reconciles overdue cases securely on a participant's next visit",()=>{
    const own=sqlFunction("quick_ride_my_requests","admin_quick_ride_disputes");
    expect(own).toContain("LANGUAGE plpgsql VOLATILE SECURITY DEFINER");
    expect(own).toContain("q.driver_id=auth.uid() OR q.passenger_id=auth.uid()");
    expect(own).toContain("d.deadline_at<=now()");
    expect(own).toContain("PERFORM public.quick_ride_finalize_after_timeout(v_id)");
    expect(own).toContain("'PENDING_REVIEW','COMPLETED','CANCELLED','EXPIRED'");
  });

  it("admin decision is auditable, role-guarded and distinct from a payment declaration",()=>{
    const resolve=migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.admin_resolve_quick_ride_dispute"));
    expect(resolve).toContain("public.has_role(auth.uid(),'admin')");
    expect(resolve).toContain("p_decision IS NULL");
    expect(resolve).toContain("d.resolved_at IS NULL");
    expect(resolve).toContain("quick_ride_dispute_audit");
    expect(resolve).toContain("ADMIN_COMPLETE");
    expect(resolve).toContain("ADMIN_CANCEL");
    expect(resolve).not.toContain("quick_ride_declare_manual_pix");
    expect(resolve).not.toContain("quick_ride_acknowledge_manual_pix");
  });

  it("keeps new requests available while pending cases stay reviewable",()=>{
    expect(guard).toContain('"PENDING_REVIEW"');
    expect(passenger).toContain('r.status==="PENDING_REVIEW"');
    expect(passenger).toContain("Confirmação de desembarque pendente");
    expect(driver).toContain('r.status==="PENDING_REVIEW"');
    expect(driver).toContain("quick_ride_request_manual_review");
    expect(flashDriver).toContain("quick_ride_request_manual_review");
    expect(passengerHistory).toContain('case "PENDING_REVIEW"');
    expect(driverHistory).toContain('PENDING_REVIEW: "Encerramento em análise"');
    expect(admin).toContain('item.status==="PENDING_REVIEW"');
  });

  it("only opens Pix and rating on a confirmed COMPLETED status",()=>{
    expect(checkout).toContain("<QuickRidePixCard rideId={rideId} />");
    expect(checkout).toContain("<QuickRideDriverSettlement rideId={rideId} />");
    expect(passenger).toContain('r.status==="COMPLETED"');
    expect(driver).toContain('r.status==="COMPLETED"');
    expect(passengerHistory).toContain('ride.status === "COMPLETED"');
    expect(driverHistory).toContain('ride.status === "COMPLETED"');
  });
});
