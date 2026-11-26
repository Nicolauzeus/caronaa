import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("drizzle/migrations/0224_f07_reconnect_pin_atomic_claim.sql","utf8");
const accept=readFileSync("drizzle/migrations/0209_f07_accept_queue_event_schema_and_radius.sql","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const passengerSheet=readFileSync("src/components/caronaa/shell/FlashPassengerLiveSheet.tsx","utf8");
const driverPresence=readFileSync("src/hooks/use-flash-driver-presence.ts","utf8");
const root=readFileSync("src/routes/__root.tsx","utf8");
const auth=readFileSync("src/lib/auth-context.tsx","utf8");
const map=readFileSync("src/components/caronaa/QuickRideOperationalMap.tsx","utf8");

describe("F07 offline recovery and atomic claims",()=>{
  it("serializes claims and prevents two assigned active drivers per passenger",()=>{
    expect(accept).toContain("WHERE id=p_ride_id FOR UPDATE");
    expect(accept).toContain("WHERE id=p_ride_id AND status='SEARCHING' AND expires_at>now()");
    expect(migration).toContain("uq_f07_one_active_ride_per_passenger");
    expect(migration).toContain("uq_f07_one_active_ride_per_driver");
    expect(migration).toContain("F07_ACTIVE_PASSENGER_DUPLICATES");
    expect(migration).toContain("F07_ACTIVE_DRIVER_DUPLICATES");
    expect(migration).not.toMatch(/DELETE FROM public\.professional_quick_rides/i);
  });

  it("issues boarding PIN on ACCEPTED without weakening the driver validation",()=>{
    expect(migration).toContain("q.status NOT IN ('ACCEPTED','ARRIVED')");
    expect(migration).toContain("q.passenger_id IS DISTINCT FROM auth.uid()");
    expect(migration).toContain("pin_hash=encode(sha256");
    expect(passenger).toContain("caronaa:boarding:");
    expect(passenger).toContain("boardingPending.current");
    expect(passenger).toContain('window.addEventListener("online",retry)');
    expect(passengerSheet).toContain("boardingReady&&");
  });

  it("preserves the mounted screen while offline and refreshes when connected",()=>{
    expect(root).toContain("Sua corrida e esta tela serão preservadas");
    expect(root).toContain('window.dispatchEvent(new Event("caronaa:app-refresh"))');
    expect(auth).toContain('event === "SIGNED_OUT" && !navigator.onLine');
    expect(auth).toContain("identityChanged");
    expect(passenger).toContain("rideRefreshInFlight.current");
    expect(passenger).toContain("Promise.race");
    expect(map).toContain('window.addEventListener("online",onVisible)');
  });

  it("does not deliberately mark driver offline due only to failed heartbeat",()=>{
    // The explicit offline action is the only call site, and stale checks never invoke it.
    expect(driverPresence.match(/\bawait setFlashDriverOffline\(/g)).toHaveLength(1);
    const staleCheck=driverPresence.slice(driverPresence.indexOf("staleTimer.current=setInterval"),driverPresence.indexOf("},4000)"));
    expect(staleCheck).toContain("gpsConnected:false");
    expect(staleCheck).not.toContain("markOffline(");
    expect(staleCheck).not.toContain("setFlashDriverOffline(");
    expect(driverPresence).toContain('window.addEventListener("online",resume)');
    expect(driverPresence).not.toContain('error:"Sem GPS por mais de 60 segundos. Disponibilidade encerrada."');
  });
});
