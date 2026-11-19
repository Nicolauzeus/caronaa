import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const shell=readFileSync("src/components/caronaa/shell/ShellJourneyPlanner.tsx","utf8");
const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");
const passengerMap=readFileSync("src/components/caronaa/GoogleHomeRideMap.tsx","utf8");
const mapSurface=readFileSync("src/components/caronaa/GoogleMapSurface.tsx","utf8");
const rideMap=readFileSync("src/components/caronaa/QuickRideOperationalMap.tsx","utf8");
const driverPage=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const driverQueue=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const realtime=readFileSync("src/lib/quick-rides/use-quick-ride-realtime.ts","utf8");

describe("CARONAA F07 - mobile map stability, API costs and subscriptions",()=>{
  it("preserves a single passenger cockpit instance across peek, half and full",()=>{
    expect(shell.match(/\{flashOperationalPanel\}/g)).toHaveLength(1);
    expect(shell).toContain('serviceType==="FLASH"&&<div className={');
    expect(shell).toContain('flashRideActive?"min-h-0 flex-1 overflow-y-auto overscroll-contain"');
    expect(shell).toContain('flashRideActive?"hidden"');
  });

  it("moves existing Home radar pins rather than removing/recreating on GPS pulses",()=>{
    expect(passengerMap).toContain('const markers = useRef<Map<string,any>>(new Map())');
    expect(passengerMap).toContain('const existing=markers.current.get(key)');
    expect(passengerMap).toContain('existing.setPosition(location)');
    expect(passengerMap).toContain('visible.has(key)');
    expect(passengerMap).toContain('circle.current.setCenter(center)');
  });

  it("preserves road geometry during GPS updates and does not refit on sheet resize",()=>{
    expect(mapSurface).toContain('const lineArtifacts = useRef<Map<string');
    expect(mapSurface).toContain('if(existing?.fingerprint!==fingerprint)');
    expect(mapSurface).toContain('lineArtifacts.current.set(key,{fingerprint,polyline})');
    expect(mapSurface).toContain('fitMode === "once"');
    expect(mapSurface).not.toContain('map.current.fitBounds(lastBounds.current');
    expect(passengerMap).not.toContain('routeManagedExternally,plannedRoute,routeBottomInset,routeLeftInset]');
  });

  it("keeps the driver's map and marker stable while GPS publication state changes",()=>{
    expect(mapSurface).toContain('const markerKey = point.id || point.title');
    expect(driverPage).toContain('!activeRide&&<section aria-label="Mapa do motorista"');
    expect(driverPage).toContain('id:"self-professional"');
    expect(driverPage).toContain('fitMode="once" smoothTracking');
    expect(driverPage).toContain('fitKey="professional-home-position"');
    expect(rideMap).toContain('id:"assigned-professional"');
    expect(rideMap).toContain('id:"ride-pickup"');
    expect(rideMap).toContain('id:"ride-destination"');
  });

  it("deduplicates route requests per trip while location and labels stay fresh",()=>{
    expect(rideMap).toContain('const tripRouteRequests=new Map');
    expect(rideMap).toContain('cachedTripRoute(cacheKey,()=>readRouteRef.current(');
    expect(rideMap).toContain('readMapRef.current({data:{rideId}})');
    expect(rideMap).toContain('lastDriverFix.current');
    expect(rideMap).toContain('Última posição conhecida (não ao vivo)');
    expect(rideMap).toContain('Date.now()-last.at<=30000');
    expect(rideMap).toContain('fitMode="once" fitKey=');
  });

  it("follows the driver GPS in both phases and lets the driver pull the sheet up or down",()=>{
    expect(mapSurface).toContain('followPoint?: {lat:number;lng:number}|null;');
    expect(mapSurface).toContain('map.current.addListener("dragstart"');
    expect(mapSurface).toContain('map.current.panTo(center)');
    expect(mapSurface).toContain("Retomar acompanhamento do GPS");
    expect(rideMap).toContain('followPoint={driverPhase||passengerTracking?driverPoint:null}');
    expect(rideMap).toContain('driverNavigationPhase(statusNow)');
    expect(rideMap).toContain('estimateDriverRouteRemaining(driverPoint,currentDriverRoute)');
    expect(rideMap).toContain('Abrir orientação por voz no Google Maps');
    expect(driverPage).toContain('onTouchStart={event=>');
    expect(driverPage).toContain('onTouchEnd={event=>');
    expect(driverPage).toContain('aria-expanded={sheetOpen}');
    expect(driverPage).toContain('if(activeRide.status==="ARRIVED")setSheetExpanded(true)');
    expect(driverPage).toContain('else if(activeRide.status==="ACCEPTED"||activeRide.status==="IN_PROGRESS")');
  });

  it("explicit driver CTA returns to the GPS map without waiting for phase transitions",()=>{
    expect(driverQueue).toContain('onFollowMap?.(active.id)');
    expect(driverQueue).toContain('Acompanhar embarque no mapa');
    expect(driverQueue).toContain('Acompanhar destino no mapa');
    expect(driverPage).toContain('onFollowMap={followRideOnMap}');
    expect(driverPage).toContain('setSheetExpanded(false)');
    expect(driverPage).toContain('setNavigationFocusRequest(previous=>previous+1)');
    expect(driverPage).toContain('navigationFocusRequest={navigationFocusRequest}');
    expect(rideMap).toContain('navigationFocusRequest=0');
    expect(rideMap).toContain('followKey={driverPhase?`${rideId}:${driverPhase}:${navigationFocusRequest}`:');
    expect(mapSurface).toContain('map.current.panTo(centered)');
    expect(mapSurface).toContain('followPointRef.current');
  });

  it("limits radar discovery to the waiting state and avoids display flicker",()=>{
    expect(home).toContain('if(passengerRide){');
    expect(home).toContain('if(!loadedOnce)setQuickDriverLoading(true)');
    expect(home).toContain('if(!alive||inFlight||document.hidden)return');
    expect(home).toContain('setQuickDrivers(previous=>');
    expect(home).toContain('driver.driver_key===next.driver_key');
  });

  it("uses Supabase WebSocket for queue status, not Google or an open browser webhook",()=>{
    expect(realtime).toContain('.on("postgres_changes"');
    expect(realtime).toContain('table:"caronaa_quick_queue_events"');
    expect(realtime).toContain('if(!subscribed && !document.hidden)signal()');
    expect(realtime).toContain('removeChannel(channel)');
    expect(rideMap).toContain('getQuickRideMapContext');
    expect(rideMap).toContain('getMapDrivingRoute');
    expect(rideMap).toContain('getQuickRideNavigation');
    expect(rideMap).toContain('navigationMode={Boolean(driverPhase)}');
    expect(mapSurface).toContain('map.current.setTilt(45)');
    expect(mapSurface).toContain('snapVisualDriverPosition');
  });
});
