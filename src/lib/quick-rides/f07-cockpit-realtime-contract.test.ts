import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const sql=readFileSync("drizzle/migrations/0148_f07_realtime_safe_queue_events.sql","utf8");
const cockpit=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const queue=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const hook=readFileSync("src/lib/quick-rides/use-quick-ride-realtime.ts","utf8");
const google=readFileSync("src/lib/location/google-places.ts","utf8");
const token=readFileSync("src/components/formulario/LocationAutocomplete.tsx","utf8");
const server=readFileSync("src/lib/professional-radar.functions.ts","utf8");

describe("F07 GPS, cockpit and secure realtime regression",()=>{
  it("no longer requests quota-limited geocoding v4 for reverse GPS",()=>{
    expect(google).not.toContain("geocode.googleapis.com/v4");
    expect(google).toContain('API + ":searchNearby"');
    expect(google).toContain('"places.id,places.formattedAddress,places.addressComponents,places.location"');
    expect(google).toContain('maxResultCount: 1');
    expect(google).toContain('radius: 150.0');
    expect(google).toContain('reverseQuotaCooldownUntil');
    expect(server).toContain('verifiedGpsCity(context.userId,point)');
    expect(server).toContain('rememberVerifiedGpsCity(context.userId,point,city)');
    expect(server).not.toContain('await clearStaleLocation();\n      return { published: false, reason: "LOCATION_UNKNOWN"');
  });
  it("places driver queue and trip controls inside existing GPS cockpit",()=>{
    expect(cockpit).toContain('<QuickRideDriverQueue');
    expect(cockpit).toContain('gpsReady={fresh}');
    expect(cockpit).not.toContain('Ver pedidos de corrida');
    expect(queue).toContain("quick_ride_accept");
    expect(queue).toContain('Corrida já aceita por outro motorista da região.');
    expect(queue).toContain('"ARRIVED"');
    expect(queue).toContain('"IN_PROGRESS"');
    expect(queue).toContain('"COMPLETED"');
  });
  it("uses RLS-protected municipal invalidations without publishing private rides",()=>{
    expect(sql).toContain("caronaa_quick_queue_events");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("caronaa_quick_event_allowed");
    expect(sql).toContain("l.updated_at>now()-interval '90 seconds'");
    expect(sql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.caronaa_quick_queue_events");
    expect(sql).not.toContain("ADD TABLE public.professional_quick_rides");
    expect(hook).toContain('table:"caronaa_quick_queue_events"');
    expect(hook).toContain('},60_000)');
    expect(hook).toContain('visibilitychange');
    expect(hook).toContain('removeChannel(channel)');
  });
  it("keeps one Google UUID per typed session and follows through Place Details",()=>{
    expect(token).toContain('nextVal.trim().length >= 1');
    expect(token).toContain('selectedToken = sug.source === "google" ? sessionTokenRef.current');
    expect(token).toContain('data: { placeId: sug.providerId, sessionToken: selectedToken }');
  });
});
