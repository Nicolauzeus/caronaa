import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const sql=readFileSync("drizzle/migrations/0148_f07_realtime_safe_queue_events.sql","utf8");
const cockpit=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const queue=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const hook=readFileSync("src/lib/quick-rides/use-quick-ride-realtime.ts","utf8");
const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");
const flash=readFileSync("src/components/caronaa/shell/ShellJourneyPlanner.tsx","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const map=readFileSync("src/components/caronaa/QuickRideOperationalMap.tsx","utf8");
const surface=readFileSync("src/components/caronaa/GoogleMapSurface.tsx","utf8");
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
    expect(server).toContain('resolvePilotCivic(data.lat, data.lng)');
    expect(server).not.toContain('verifiedGpsCity');
    expect(server).not.toContain('await clearStaleLocation();\n      return { published: false, reason: "LOCATION_UNKNOWN"');
  });
  it("places driver queue and trip controls inside existing GPS cockpit",()=>{
    expect(cockpit).toContain('<QuickRideDriverQueue');
    expect(cockpit).toContain('gpsReady={fresh}');
    expect(cockpit).not.toContain('Ver pedidos de corrida');
    expect(queue).toContain("quick_ride_accept");
    expect(queue).toContain('Solicitação indisponível: pode ter expirado ou sido aceita por outro motorista.');
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
  it("delegates the passenger Flash CTA to the real quoted dispatch and Realtime",()=>{
    expect(home).toContain('<QuickRideHomePanel');
    expect(home).toContain('flashOperationalPanel={');
    expect(flash).toContain('flashOperationalPanel');
    expect(flash).not.toContain('setSecondsLeft');
    expect(flash).not.toContain('setPhase("SEARCHING")');
    expect(passenger).toContain('await submitFn({data:{quoteId:currentQuote.quoteId}})');
    expect(passenger).toContain('id:submitted.rideId');
    expect(passenger).toContain('useQuickRideRealtime(');
    expect(passenger).toContain('quick_ride_transition');
  });
  it("retains real dropoff deadline, payment and optional rating independently",()=>{
    expect(queue).toContain('quick_ride_dropoff_state');
    expect(queue).toContain('Solicitar confirmação de desembarque');
    expect(queue).toContain('Aguardando confirmação do passageiro');
    expect(passenger).toContain('quick_ride_respond_dropoff');
    expect(passenger).toContain('onDropoffPendingChange');
    expect(passenger).toContain('Confirmar desembarque no destino');
    expect(passenger).toContain('Ainda não desembarquei / Contestar');
    expect(passenger).toContain('<QuickRidePixCard rideId={completedRide.id}/>');
    expect(passenger).toContain('Avaliar viagem (opcional)');
    expect(passenger).not.toContain('onClose={()=>{releaseCompletedRide();');
    expect(queue).not.toContain('onClose={releaseCompleted}');
    expect(queue).toContain('Liberar tela para novos chamados');
  });
  it("uses stage-specific Google map routes without animating over reduced-motion preference",()=>{
    expect(map).toContain('color:"#2563eb"');
    expect(map).toContain('color:"#FFBB00"');
    expect(map).toContain('const routeStart={lat:context.driver.lat,lng:context.driver.lng};');
    expect(map).toContain('fitMode="once" fitKey=');
    expect(surface).toContain('prefers-reduced-motion: reduce');
  });

});
