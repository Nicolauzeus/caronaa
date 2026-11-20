import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration=readFileSync("drizzle/migrations/0216_flash_presence_gps_queue_fix.sql","utf8");
const service=readFileSync("src/services/flash-driver-service.ts","utf8");
const realtime=readFileSync("src/lib/quick-rides/use-quick-ride-realtime.ts","utf8");
describe("Flash GPS dispatch and queue contract",()=>{
  it("uses server supported names and checks backend acknowledgment",()=>{
    for(const arg of ["p_is_online:true","p_dispatch_mode:mode","p_available_seats:seats","p_route_geojson:geometry"]){
      expect(service).toContain(arg);
    }
    expect(service).toContain("record(data)?.is_online!==true");
    expect(service).toContain("record(data)?.is_online!==false");
    expect(service).toContain("p_municipality:municipality");
  });
  it("publishes one live GPS heartbeat to Flash and professional radar atomically",()=>{
    for(const table of ["public.flash_driver_presence","public.professional_presence","public.professional_driver_locations"]){
      expect(migration).toContain(table);
    }
    expect(migration).toContain("last_sampled_at=now()");
    expect(migration).toContain("sampled_at=now()");
    expect(migration).toContain("p_accuracy_m <= 150");
    expect(migration).toContain("is_online=true");
  });
  it("reconciles queue even when realtime reports SUBSCRIBED",()=>{
    expect(realtime).toContain("if(!document.hidden)signal()");
    expect(realtime).not.toContain("if(!subscribed && !document.hidden)signal()");
  });
});
