import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const migration=readFileSync("drizzle/migrations/0217_f07_bilateral_dropoff_dispute_and_posttrip.sql","utf8");
const prompt=readFileSync("src/components/caronaa/QuickRidePendingDropoffPrompt.tsx","utf8");
const admin=readFileSync("src/components/admin/QuickRideDisputesAdmin.tsx","utf8");
const checkout=readFileSync("src/components/caronaa/QuickRidePostTripFlow.tsx","utf8");
const driver=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");

describe("F07: contestacao fundamentada e pos-corrida persistente",()=>{
  it("does not auto-complete on silence or GPS",()=>{
    expect(migration).not.toContain("UPDATE public.professional_quick_rides\n    SET status='COMPLETED'");
    expect(migration).toContain("Leaves the existing live quick_ride_respond_dropoff");
    expect(migration).toContain("This is NEVER proof of Pix");
  });
  it("keeps NOT_YET separate from dispute and saves its motive",()=>{
    expect(migration).toContain("'PASSENGER_NOT_YET'");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_open_dropoff_dispute");
    expect(migration).toContain("RETURN public.quick_ride_respond_dropoff(p_id,'CONTESTED')");
    expect(prompt).toContain('rpc("quick_ride_open_dropoff_dispute"');
    expect(prompt).toContain('respond("NOT_YET")');
    expect(prompt).toContain('setDisputeOpen(true)');
  });
  it("distinguishes no-response and dispute",()=>{
    expect(migration).toContain("'case_kind', CASE");
    expect(migration).toContain("'DISPUTED'");
    expect(migration).toContain("'NO_RESPONSE'");
    expect(admin).toContain('passenger_dispute_reason_code');
    expect(admin).toContain('Sem resposta');
    expect(driver).toContain('Desembarque contestado');
  });
  it("persists post-trip acknowledgement per user without paying",()=>{
    expect(migration).toContain("public.quick_ride_my_posttrip_pending()");
    expect(migration).toContain("public.quick_ride_ack_posttrip(p_id uuid)");
    expect(checkout).toContain('rpc("quick_ride_my_posttrip_pending")');
    expect(checkout).toContain('rpc("quick_ride_ack_posttrip"');
  });
});
