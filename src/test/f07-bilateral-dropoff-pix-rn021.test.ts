import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const sql=readFileSync("drizzle/migrations/0215_f07_bilateral_dropoff_and_independent_pix.sql","utf8");
const sheet=readFileSync("src/components/caronaa/shell/FlashDriverActiveSheet.tsx","utf8");
const flash=readFileSync("src/components/caronaa/shell/DriverFlashPlanner.tsx","utf8");
const queue=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const checkout=readFileSync("src/components/caronaa/QuickRidePixCard.tsx","utf8");
const settlement=readFileSync("src/components/caronaa/QuickRideDriverSettlement.tsx","utf8");

const functionSql=(name:string,next:string)=>{
  const a=sql.indexOf("CREATE OR REPLACE FUNCTION public."+name);
  const b=sql.indexOf("CREATE OR REPLACE FUNCTION public."+next,a+1);
  if(a<0||b<a)throw new Error("SQL boundary not found: "+name);
  return sql.slice(a,b);
};

describe("RN021 bilateral dropoff and exact-price Pix",()=>{
  it("records a non-operational pending request without unilateral completion or GPS gate",()=>{
    const request=functionSql("quick_ride_request_dropoff","quick_ride_request_manual_review");
    expect(request).toContain("q.driver_id IS DISTINCT FROM auth.uid()");
    expect(request).toContain("q.pickup_confirmed_at IS NULL");
    expect(request).toContain("participant_only,completion_request_method");
    expect(request).toContain("SET status='PENDING_REVIEW',completed_at=NULL");
    expect(request).not.toContain("RAISE EXCEPTION 'DROPOFF_GPS_UNVERIFIED'");
    expect(request).not.toContain("RAISE EXCEPTION 'DROPOFF_TOO_FAR_FROM_DESTINATION'");
    expect(request).not.toContain("SET status='COMPLETED'");
    expect(request).not.toContain("quick_ride_declare_manual_pix");
  });
  it("allows a passenger to confirm late without administrative approval",()=>{
    const respond=functionSql("quick_ride_respond_dropoff","admin_quick_ride_disputes");
    expect(respond).toContain("q.passenger_id IS DISTINCT FROM auth.uid()");
    expect(respond).toContain("q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW')");
    expect(respond).toContain("d.admin_decision IS NOT NULL");
    expect(respond).not.toContain("d.deadline_at<=now()");
    expect(respond).toContain("THEN 'COMPLETED'");
    expect(respond).toContain("WHEN p_response='NOT_YET' THEN 'IN_PROGRESS'");
    expect(respond).toContain("ON CONFLICT (ride_id,event_type) DO NOTHING");
  });
  it("does not flood the admin dispute queue with regular unanswered confirmations",()=>{
    const admin=functionSql("admin_quick_ride_disputes","get_completed_quick_ride_pix");
    expect(admin).toContain("d.passenger_response='CONTESTED' OR d.participant_only=false");
    expect(admin).toContain("public.has_role(auth.uid(),'admin')");
  });
  it("freezes a single quote and receiver for both QR and copy-and-paste",()=>{
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.quick_ride_pix_checkout_snapshot");
    expect(sql).toContain("ride_id uuid PRIMARY KEY");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    const pix=functionSql("get_completed_quick_ride_pix","quick_ride_declare_manual_pix");
    expect(pix).toContain("r.status<>'COMPLETED'");
    expect(pix).toContain("q.customer_pays_cents <> q.driver_receives_cents+q.platform_commission_cents");
    expect(pix).toContain("ON CONFLICT(ride_id) DO NOTHING");
    expect(pix).toContain("'amountCents',q.customer_pays_cents");
    expect(pix).toContain("'key',s.recipient_key");
    expect(pix).toContain("'automaticConfirmation',false");
  });
  it("keeps payment acknowledgments independent and does not claim bank settlement",()=>{
    const passengerPayment=functionSql("quick_ride_declare_manual_pix","quick_ride_acknowledge_manual_pix");
    const driverPayment=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.quick_ride_acknowledge_manual_pix"));
    expect(passengerPayment).toContain("coalesce(");
    expect(driverPayment).toContain("driver_acknowledged_at=coalesce(");
    expect(driverPayment).not.toContain("passenger_declared_at IS NOT NULL");
    expect(sql).toContain("ON CONFLICT DO NOTHING"); // existing unique payment events
    expect(sql).not.toContain("UPDATE public.driver_platform_fees");
  });
  it("removes driver essays, offers persistent passenger consent and the intended Pix order",()=>{
    expect(sheet).not.toContain("<textarea");
    expect(sheet).not.toContain("manualCloseReason");
    expect(queue).not.toContain("manualReviewOpen");
    expect(flash).not.toContain("requestManualClose");
    expect(passenger).toContain("Confirmar desembarque");
    expect(passenger).toContain("Ainda estou na viagem");
    expect(passenger).toContain("Relatar problema no desembarque");
    expect(passenger).toContain('dropoffRide?.id');
    expect(checkout).toContain('copy("payload")');
    expect(checkout).toContain('copy("key")');
    expect(checkout).toContain("Copiar Pix Copia e Cola");
    expect(settlement).toContain("Mostre este QR Pix ao passageiro");
    expect(settlement).toContain("pix?.available&&!received");
  });
});
