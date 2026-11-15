import { RoleSwitchHeader } from "@/components/caronaa/shell/RoleSwitchHeader";
import { QuickVehicleModal } from "@/components/caronaa/shell/QuickVehicleModal";
import { InteractiveBottomSheet, type SheetSnap } from "@/components/caronaa/shell/InteractiveBottomSheet";
import type { ServiceType } from "@/components/caronaa/shell/ServiceTypeDock";
import { ShellJourneyPlanner, type ShellRoute } from "@/components/caronaa/shell/ShellJourneyPlanner";
import { UnifiedMyTripsPanel, type UnifiedTrip } from "@/components/caronaa/shell/UnifiedMyTripsPanel";
import { DriverScheduledPlanner } from "@/components/caronaa/shell/DriverScheduledPlanner";
import { DriverFlashPlanner } from "@/components/caronaa/shell/DriverFlashPlanner";
import type { FlashDriverRide } from "@/services/flash-driver-service";
import { DriverScheduledTripsPanel } from "@/components/caronaa/shell/DriverScheduledTripsPanel";
import type { OnRouteMatch } from "@/types/ride";
import { useActiveRole, type ActiveRole, type VehicleMissingField } from "@/lib/role/use-active-role";
import { canSwitchCaronaaRole } from "@/lib/role/role-switch-guard";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/caronaa/AppShell";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";
import { QuickRideHomePanel } from "@/components/caronaa/QuickRideHomePanel";
import type { QuickRideCoverage } from "@/lib/quick-rides/quick-ride.functions";
import { QuickRideOperationalMap } from "@/components/caronaa/QuickRideOperationalMap";
import { CaronaaPerformanceDiagnostic, beginCaronaaPhase, endCaronaaPhase } from "@/components/caronaa/CaronaaPerformanceDiagnostic";
import type { FormLocationDetails } from "@/lib/location/types";
import { useProfileGender } from "@/lib/use-profile-gender";
import { useUserLocation } from "@/lib/location/use-user-location";
import { isTrustedGpsFix } from "@/lib/location/gps-trust";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { sessionRequest } from "@/lib/session-request-cache";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: z.object({ intent: z.enum(["offer"]).optional() }),
  // Parent route already verifies login and applies institution waiting gates.
  // Resolve role before any passenger/driver dashboard renders.
  beforeLoad: async () => {
    beginCaronaaPhase("home-before-load");
    try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return;
    if (getAdminAppPreview(data.user.id)) return;
    const destination = await getMyAdminEntry();
    if (destination) throw redirect({ to: destination as "/admin", replace: true });
    const progress = await readOnboarding();
    if (progress?.status !== "BASIC_COMPLETED") {
      throw redirect({ to: "/onboarding", replace: true });
    }
    const next = await resolvePostOnboardingDestination();
    if (next !== "/home") throw redirect({ to: next, replace: true });
    } finally {endCaronaaPhase("home-before-load");beginCaronaaPhase("home-first-render");}
  },
  head: () => ({
    meta: [
      { title: "Início — CARONAA" },
      {
        name: "description",
        content: "Peça ou ofereça uma carona pelo seu trajeto.",
      },
      { property: "og:title", content: "Início — CARONAA" },
      {
        property: "og:description",
        content: "Peça ou ofereça uma carona pelo seu trajeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});


function Home() {
  useEffect(()=>{endCaronaaPhase("home-first-render");},[]);
  const activeRoleState=useActiveRole();
  const gender=useProfileGender();
  const location=useUserLocation({autoLocate:true});
  const reverseGeocode=useServerFn(reverseGeocodeServerFn);

  const [sheetSnap,setSheetSnap]=useState<SheetSnap>("peek");
  const [serviceType,setServiceType]=useState<ServiceType>("FLASH");
  const [tripsPanelOpen,setTripsPanelOpen]=useState(false);
  const [tripsRefreshKey,setTripsRefreshKey]=useState(0);
  const [driverTripsRefreshKey,setDriverTripsRefreshKey]=useState(0);
  const lastPlanningSnap=useRef<SheetSnap>("peek");

  const [shellRoute,setShellRoute]=useState<ShellRoute|null>(null);
  const [shellRouteOrigin,setShellRouteOrigin]=useState<{lat:number;lng:number}|null>(null);
  const [shellDestinationLocation,setShellDestinationLocation]=useState<FormLocationDetails>();
  const [shellSelectedDestination,setShellSelectedDestination]=useState(false);
  const [selectedOnRouteMatch,setSelectedOnRouteMatch]=useState<OnRouteMatch|null>(null);
  const [shellOriginRevision,setShellOriginRevision]=useState(0);
  const [driverFlashRide,setDriverFlashRide]=useState<FlashDriverRide|null>(null);
  const [passengerRide,setPassengerRide]=useState<{id:string;status:string;municipality:string}|null>(null);
  const [quickVehicle,setQuickVehicle]=useState<"CAR"|"MOTO">("CAR");
  const [quickMunicipality,setQuickMunicipality]=useState("");
  const [quickDriverCount,setQuickDriverCount]=useState(0);
  const [quickDriverLoading,setQuickDriverLoading]=useState(false);
  const [quickDriverError,setQuickDriverError]=useState("");
  const onQuickCoverage=useCallback((value:QuickRideCoverage|null)=>setQuickMunicipality(value?.radar&&value.municipality?value.municipality:""),[]);
  const onPassengerRide=useCallback((ride:{id:string;status:string;municipality:string}|null)=>setPassengerRide(ride),[]);
  const onPassengerPhase=useCallback((status:string|null)=>{
    if(status&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(status)){
      setTripsPanelOpen(false);setSheetSnap("full");
    }
  },[]);

  const [vehicleModalOpen,setVehicleModalOpen]=useState(false);
  const [missingVehicleFields,setMissingVehicleFields]=useState<VehicleMissingField[]>([]);
  const [selectingOrigin,setSelectingOrigin]=useState(false);
  const [origin,setOrigin]=useState("");
  const [originLocation,setOriginLocation]=useState<FormLocationDetails>();
  const [resolvedAddress,setResolvedAddress]=useState<FormLocationDetails|null>(null);
  const [originSource,setOriginSource]=useState<"CURRENT_LOCATION"|"MANUAL_ORIGIN">("CURRENT_LOCATION");
  const originWasManuallySelected=useRef(false);
  const originLookupSequence=useRef(0);
  const lastGpsLookup=useRef<{lat:number;lng:number;at:number}|null>(null);

  const showTrips=()=>{
    lastPlanningSnap.current=sheetSnap;
    setSheetSnap("full");
    setTripsPanelOpen(true);
  };
  const closeTrips=()=>{
    setTripsPanelOpen(false);
    setSheetSnap(lastPlanningSnap.current);
  };
  const handleShellRouteChange=useCallback((route:ShellRoute|null,from:{lat:number;lng:number}|null)=>{
    setShellRoute(route);
    setShellRouteOrigin(from);
  },[]);
  const [passengerDestinationLabel,setPassengerDestinationLabel]=useState("");
  const handleDestinationChange=useCallback((_label:string,details?:FormLocationDetails)=>{
    setPassengerDestinationLabel(_label);
    setSelectedOnRouteMatch(null);
    setShellDestinationLocation(details);
    setShellSelectedDestination(details?.lat!=null&&details?.lng!=null);
    setShellRoute(null);
  },[]);

  useEffect(()=>{
    // Avoid carrying stale passenger/scheduled geometry across role changes.
    setShellRoute(null);
    setShellRouteOrigin(null);
    setShellSelectedDestination(false);
    setShellDestinationLocation(undefined);
    setSelectedOnRouteMatch(null);
  },[activeRoleState.activeRole,serviceType]);
  useEffect(()=>{
    const expand=()=>setSheetSnap("half");
    document.addEventListener("caronaa-shell-expand",expand);
    return()=>document.removeEventListener("caronaa-shell-expand",expand);
  },[]);
  // GPS fixes update the map position, but a manually chosen pickup must
  // never drift to the next GPS reading.
  useEffect(()=>{
    if(originSource!=="CURRENT_LOCATION"||originWasManuallySelected.current)return;
    if(!location.addressPosition||!isTrustedGpsFix(location.addressPosition)){
      setOriginLocation(undefined);
      if(location.failure)setOrigin("");
      return;
    }
    const {lat,lng,accuracy}=location.addressPosition;
    const addressIsNear=resolvedAddress?.lat!=null&&resolvedAddress.lng!=null&&
      Math.abs(resolvedAddress.lat-lat)<0.0003&&Math.abs(resolvedAddress.lng-lng)<0.0003;
    const label=addressIsNear?resolvedAddress?.formattedAddress||"Minha localização atual":"Minha localização atual";
    setOrigin(label);
    setOriginLocation({rawText:label,formattedAddress:label,lat,lng,isApproximate:accuracy>100});
  },[originSource,location.addressPosition,location.failure,resolvedAddress]);

  // Preserve the existing throttled reverse lookup for the operational city;
  // never trigger it from every GPS watchPosition sample.
  useEffect(()=>{
    const fix=location.addressPosition;
    if(originSource!=="CURRENT_LOCATION"||!fix||!isTrustedGpsFix(fix)||location.locating)return;
    const previous=lastGpsLookup.current;
    const distance=previous?111195*Math.hypot(fix.lat-previous.lat,
      (fix.lng-previous.lng)*Math.cos(fix.lat*Math.PI/180)):Infinity;
    if(previous&&distance<75&&Date.now()-previous.at<120000)return;
    lastGpsLookup.current={lat:fix.lat,lng:fix.lng,at:Date.now()};
    const version=++originLookupSequence.current;
    void sessionRequest("home-reverse:"+fix.lat.toFixed(3)+":"+fix.lng.toFixed(3),
      ()=>reverseGeocode({data:{lat:fix.lat,lng:fix.lng}}),120000)
      .then(value=>{if(version===originLookupSequence.current)setResolvedAddress(value);})
      .catch(()=>{if(version===originLookupSequence.current)lastGpsLookup.current=null;});
  },[location.addressPosition,location.locating,originSource,reverseGeocode]);

  const chooseOriginOnMap=useCallback((point:{lat:number;lng:number})=>{
    const request=++originLookupSequence.current;
    originWasManuallySelected.current=true;
    setOriginSource("MANUAL_ORIGIN");
    const fallback="Ponto selecionado no mapa";
    setOrigin(fallback);
    setOriginLocation({rawText:fallback,formattedAddress:fallback,lat:point.lat,lng:point.lng});
    setResolvedAddress(null);
    setSelectingOrigin(false);
    setShellOriginRevision(value=>value+1);
    setSheetSnap("half");
    // Explicit tap: request an address only once; preserve exact clicked point.
    void reverseGeocode({data:point})
      .then(details=>{
        if(request!==originLookupSequence.current||!details)return;
        const label=details.formattedAddress||fallback;
        setOrigin(label);
        setResolvedAddress(details);
        setOriginLocation({...details,rawText:label,formattedAddress:label,lat:point.lat,lng:point.lng});
      }).catch(()=>undefined);
  },[reverseGeocode]);

  const handleShellRoleSwitch=async(target:ActiveRole)=>{
    const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
    if(!check.allowed){
      toast[check.reason==="ACTIVE_RIDE"?"info":"error"](
        check.reason==="ACTIVE_RIDE"
          ?"Não é possível alternar de papel durante uma corrida em andamento"
          :"Não foi possível verificar suas corridas. Tente novamente.");
      return;
    }
    const result=await activeRoleState.switchRole(target);
    if(result.needsVehicleModal){
      setMissingVehicleFields(result.missingFields);
      setVehicleModalOpen(true);
    }
  };

  useEffect(()=>{
    if(activeRoleState.activeRole!=="PASSAGEIRO"||serviceType!=="FLASH"||!quickMunicipality){setQuickDriverCount(0);setQuickDriverError("");setQuickDriverLoading(false);return;}
    let alive=true;
    const refresh=async()=>{
      if(alive)setQuickDriverLoading(true);
      try{
        const {data,error}=await (supabase as any).rpc("discover_caronaa_quick_drivers",{p_municipality:quickMunicipality,p_vehicle:quickVehicle});
        if(!alive)return;
        if(error)throw error;
        setQuickDriverCount((Array.isArray(data)?data:[]).filter((item:any)=>!item.is_self).length);
        setQuickDriverError("");
      }catch{if(alive){setQuickDriverCount(0);setQuickDriverError("Radar indisponível. Tente novamente.");}}
      finally{if(alive)setQuickDriverLoading(false);}
    };
    void refresh();
    const timer=window.setInterval(refresh,15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[activeRoleState.activeRole,serviceType,quickMunicipality,quickVehicle]);
  const mapOrigin=shellSelectedDestination&&shellRouteOrigin
    ?shellRouteOrigin:originLocation??location.position??undefined;
  const currentDestination=shellSelectedDestination?shellDestinationLocation:undefined;
  const driverRole=activeRoleState.activeRole==="MOTORISTA";
  const shouldShowOperationalMap=driverRole&&serviceType==="FLASH"&&driverFlashRide!=null;
  const shouldShowPassengerMap=!driverRole&&serviceType==="FLASH"&&passengerRide!==null;

  return <AppShell mapLayout>
    <CaronaaPerformanceDiagnostic/>
    <div className="relative isolate h-full min-h-0 min-w-0 overflow-hidden bg-[#121212] font-[family-name:var(--font-sans)] text-white">
      <div className="absolute inset-0">
        {shouldShowPassengerMap&&passengerRide?
          <QuickRideOperationalMap rideId={passengerRide.id} status={passengerRide.status} role="PASSENGER" immersive/>:
        shouldShowOperationalMap&&driverFlashRide?
          <QuickRideOperationalMap
            rideId={driverFlashRide.id} status={driverFlashRide.status}
            role="DRIVER" vehicleType={driverFlashRide.vehicleType} immersive/>:
          <HomeRideMap
            immersive
            userPosition={location.position}
            plannedRoute={shellSelectedDestination?shellRoute:null}
            routeManagedExternally={shellSelectedDestination}
            onRouteMeeting={selectedOnRouteMatch&&shellRouteOrigin?{
              origin:shellRouteOrigin,
              pickup:{lat:selectedOnRouteMatch.pickupMeeting.lat,
                lng:selectedOnRouteMatch.pickupMeeting.lng,
                poiName:selectedOnRouteMatch.pickupMeeting.poiName},
            }:null}
            routeBottomInset={shellSelectedDestination?
              Math.round((typeof window==="undefined"?800:window.innerHeight)*
                (sheetSnap==="peek"?0.15:sheetSnap==="half"?0.50:0.85))+24:undefined}
            origin={mapOrigin}
            destination={currentDestination}
            originIsCurrent={originSource==="CURRENT_LOCATION"}
            originAccuracyM={location.originAccuracyM}
            following={originSource==="CURRENT_LOCATION"&&
              isTrustedGpsFix(location.position)&&location.isFollowingUser}
            recenterVersion={location.recenterVersion}
            locating={location.locating}
            selectingOrigin={selectingOrigin}
            onPickOrigin={chooseOriginOnMap}
            onDrag={()=>location.setFollowing(false)}
            onRecenter={location.locate}
          />}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3 pt-[env(safe-area-inset-top)]">
        <RoleSwitchHeader activeRole={activeRoleState.activeRole}
          disabled={activeRoleState.loading||activeRoleState.busy}
          onSwitch={handleShellRoleSwitch}/>
      </div>
      <QuickVehicleModal open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}
        missingFields={missingVehicleFields}
        initialType={activeRoleState.vehicleType}
        initialSeats={activeRoleState.vehicleSeats}
        onSave={async vehicle=>{
          const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
          if(!check.allowed)throw new Error(check.reason==="ACTIVE_RIDE"
            ?"Não é possível alternar durante uma corrida."
            :"Não foi possível verificar suas corridas.");
          await activeRoleState.saveVehicle(vehicle);
        }}/>
      <InteractiveBottomSheet value={sheetSnap} onChange={setSheetSnap}
        title="Casca Única CARONAA"
        headerAction={!tripsPanelOpen?
          <button type="button" onClick={showTrips}
            className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#FFBB00]">
            {driverRole?"Agendados":"Minhas Viagens"}
          </button>:undefined}>
        {tripsPanelOpen&&driverRole&&
          <DriverScheduledTripsPanel onClose={closeTrips} refreshKey={driverTripsRefreshKey}/>}
        {tripsPanelOpen&&!driverRole&&
          <UnifiedMyTripsPanel onClose={closeTrips} refreshKey={tripsRefreshKey}
            onShowOnMap={(trip:UnifiedTrip)=>{
              if(trip.operationalRideId!==passengerRide?.id){
                toast.info("O acompanhamento desta viagem no mapa ainda não está disponível.");
                return;
              }
              closeTrips();
              setSheetSnap("peek");
            }}/>}
        <div style={{display:tripsPanelOpen?"none":undefined}}>
          {driverRole&&serviceType==="FLASH"?
            <DriverFlashPlanner
              snap={sheetSnap} onSnapChange={setSheetSnap}
              serviceType={serviceType} onServiceTypeChange={setServiceType}
              vehicleType={activeRoleState.vehicleType==="moto"?"MOTO":"CAR"}
              municipality={resolvedAddress?.city??""}
              originPoint={originLocation&&typeof originLocation.lat==="number"&&typeof originLocation.lng==="number"?{lat:originLocation.lat,lng:originLocation.lng}:location.position}
              originLabel={origin||"Localização atual (GPS)"}
              originRevision={shellOriginRevision}
              onAdjustOrigin={()=>{setSelectingOrigin(true);setSheetSnap("half");}}
              onRouteChange={handleShellRouteChange}
              onActiveRideChange={setDriverFlashRide}
              onDestinationChange={handleDestinationChange}
            />:driverRole?
            <DriverScheduledPlanner
              snap={sheetSnap} onSnapChange={setSheetSnap}
              serviceType={serviceType} onServiceTypeChange={setServiceType}
              vehicleType={activeRoleState.vehicleType==="moto"?"MOTO":"CAR"}
              maxSeats={activeRoleState.vehicleSeats}
              gender={gender}
              originPoint={originLocation}
              originLabel={origin}
              originRevision={shellOriginRevision}
              onAdjustOrigin={()=>{setSelectingOrigin(true);setSheetSnap("peek");}}
              onRouteChange={handleShellRouteChange}
              onDestinationChange={handleDestinationChange}
              onPublished={()=>setDriverTripsRefreshKey(value=>value+1)}
              onOpenTrips={showTrips}
            />:
            <ShellJourneyPlanner
              snap={sheetSnap} onSnapChange={setSheetSnap}
              serviceType={serviceType} onServiceTypeChange={setServiceType}
              originPoint={originLocation}
              originLabel={origin}
              originRevision={shellOriginRevision}
              originMunicipality={resolvedAddress?.city??""}
              gender={gender}
              onFlashVehicleChange={setQuickVehicle}
              flashOperationalPanel={
                <QuickRideHomePanel
                  origin={origin||"Minha localização atual"}
                  destination={passengerDestinationLabel}
                  originPoint={shellRouteOrigin ? {...originLocation,rawText:originLocation?.rawText??origin,lat:shellRouteOrigin.lat,lng:shellRouteOrigin.lng} : originLocation}
                  destinationPoint={shellDestinationLocation}
                  vehicle={quickVehicle}
                  onVehicleChange={setQuickVehicle}
                  driverCount={quickDriverCount}
                  driverLoading={quickDriverLoading}
                  driverError={quickDriverError}
                  gpsOriginIsImprecise={Boolean(location.addressPosition&&!isTrustedGpsFix(location.addressPosition))&&originSource==="CURRENT_LOCATION"}
                  onCoverage={onQuickCoverage}
                  onOperationalRideChange={onPassengerRide}
                  onRidePhaseChange={onPassengerPhase}
                  onOpenOperational={()=>setSheetSnap("full")}
                  shellMode shellSnap={sheetSnap}
                />
              }
              onAdjustOrigin={()=>{setSelectingOrigin(true);setSheetSnap("peek");}}
              onRouteChange={handleShellRouteChange}
              onOnRouteMatchSelected={setSelectedOnRouteMatch}
              onDestinationChange={handleDestinationChange}
              onScheduled={()=>setTripsRefreshKey(value=>value+1)}
            />}
        </div>
      </InteractiveBottomSheet>
      {selectingOrigin&&
        <div role="status" className="absolute inset-x-3 top-3 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-[#FFBB00]/50 bg-[#121212]/95 p-3 text-sm shadow-xl backdrop-blur-xl sm:inset-x-5">
          <p><strong className="text-[#FFBB00]">Definir saída:</strong> toque no ponto correto do mapa.</p>
          <button type="button" onClick={()=>setSelectingOrigin(false)}
            className="min-h-11 shrink-0 rounded-lg border border-white/30 px-3 font-semibold">Cancelar</button>
        </div>}
    </div>
  </AppShell>;
}
