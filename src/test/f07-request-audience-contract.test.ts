import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = (name:string)=>readFileSync(name,"utf8");
const migration=file("drizzle/migrations/0214_f07_request_viewers_and_profiles.sql");
const card=file("src/components/caronaa/shell/FlashIncomingOrderCard.tsx");
const queue=file("src/components/caronaa/QuickRideDriverQueue.tsx");
const passenger=file("src/components/caronaa/QuickRideHomePanel.tsx");
const audio=file("src/lib/notification-sound.ts");
const viewer=file("src/components/caronaa/QuickRidePassengerIdentity.tsx");
const audience=file("src/components/caronaa/QuickRideSearchActivity.tsx");

describe("F07 incoming-call and genuine audience contracts",()=>{
  it("rings for 30s and immediately stops on decline, acceptance or removal",()=>{
    expect(audio).toContain("now + 30_000");
    expect(audio).toContain('stopLoop(orderId)');
    expect(card).toContain("Date.now()+30000");
    expect(card).toContain("stopLoop(order.id)");
    expect(queue).toContain("stopLoop(ride.id)");
    expect(card).toContain("QuickRidePassengerIdentity");
    expect(queue).toContain("QuickRidePassengerIdentity");
  });
  it("records genuine visible-card views without exposing general driver presence",()=>{
    expect(viewer).toContain("IntersectionObserver");
    expect(viewer).toContain("markQuickRideRequestViewed(rideId)");
    expect(migration).toContain("quick_ride_driver_views");
    expect(migration).toContain("last_viewed_at>now()-interval '12 seconds'");
    expect(migration).toContain("v_ride.passenger_id IS DISTINCT FROM auth.uid()");
    expect(migration).toContain("q.driver_id");
    expect(migration).toContain("professional_mototaxi_profiles");
    expect(migration).toContain("quick_ride_stop_view");
    expect(migration).not.toContain("GRANT SELECT ON public.quick_ride_driver_views TO authenticated");
  });
  it("shows sequential genuine drivers and the actual accepted driver",()=>{
    expect(passenger).toContain('<QuickRideSearchActivity rideId={liveRide.id} status={liveRide.status}/>');
    expect(audience).toContain("audience.watchingCount");
    expect(audience).toContain("audience.viewers");
    expect(audience).toContain("audience.acceptedDriver");
    expect(audience).toContain("index%Math.max(1,audience.viewers.length)");
    expect(audience).toContain("Matrícula informada");
  });
});
