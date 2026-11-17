import { RoleSwitchHeader } from "@/components/caronaa/shell/RoleSwitchHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
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
import type { ApproximateProfessionalDriver } from "@/components/caronaa/HomeRideMap";
import { mapQuickRadarDrivers, QUICK_RADAR_RADIUS_KM } from "@/lib/quick-rides/quick-radar-markers";
import { QuickRideHomePanel } from "@/components/caronaa/QuickRideHomePanel";
import type { QuickRideCoverage, QuickRideFarePreview } from "@/lib/quick-rides/quick-ride.functions";
import { QuickRideOperationalMap } from "@/components/caronaa/QuickRideOperationalMap";
import { CaronaaPerformanceDiagnostic, beginCaronaaPhase, endCaronaaPhase } from "@/components/caronaa/CaronaaPerformanceDiagnostic";
import type { FormLocationDetails } from "@/lib/location/types";
import { useProfileGender } from "@/lib/use-profile-gender";
import { useUserLocation, validPoint, type UserPosition } from "@/lib/location/use-user-location";
import { canPreviewPassengerPickup, needsPassengerPickupConfirmation } from "@/lib/location/passenger-pickup";
import { isTrustedGpsFix } from "@/lib/location/gps-trust";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { sessionRequest } from "@/lib/session-request-cache";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";
import { ensureBasicPassengerOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: z.object({intent:z.enum(["offer"]).optional(),trips:z.enum(["open"]).optional()}),
  beforeLoad:async()=>{
    beginCaronaaPhase("home-before-load");
    try{
      const {data,error}=await supabase.auth.getUser();
      if(error||!data.user)return;
      if(getAdminAppPreview(data.user.id))return;
      const destination=await getMyAdminEntry();
      if(destination)throw redirect({to:destination as "/admin",replace:true});
      const progress=await ensureBasicPassengerOnboarding();
      if(progress?.status!=="BASIC_COMPLETED")throw redirect({to:"/onboarding",replace:true});
      const next=await resolvePostOnboardingDestination();
      if(next!=="/home")throw redirect({to:next,replace:true});
    }finally{endCaronaaPhase("home-before-load");beginCaronaaPhase("home-first-render");}
  },
  head:()=>({meta:[
    {title:"Início — CARONAA"},
    {name:"description",content:"Peça ou ofereça uma carona pelo seu trajeto."},
    {property:"og:title",content:"Início — CARONAA"},
    {property:"og:description",content:"Peça ou ofereça uma carona pelo seu trajeto."},
    {property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},
  ]}),
  component:Home,
});

function Home(){
  const routeSearch=Route.useSearch();
  useEffect(()=>{endCaronaaPhase("home-first-render");},[]);
  const activeRoleState=useActiveRole();
  const gender=useProfileGender();
  const location=useUserLocation({autoLocate:true});
  const reverseGeocode=useServerFn(reverseGeocodeServerFn);
  const [sheetSnap,setSheetSnap]=useState<SheetSnap>("peek");
  useEffect(()=>{if(typeof window!=="undefined"&&window.matchMedia("(min-width: 768px)").matches)setSheetSnap("half");},[]);
  const [serviceType,setServiceType]=useState<ServiceType>("FLASH");
  const [tripsPanelOpen,setTripsPanelOpen]=useState(false);
  useEffect(()=>{if(routeSearch.trips==="open"){setTripsPanelOpen(true);setSheetSnap("full");}},[routeSearch.trips]);
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
  const [passengerPhase,setPassengerPhase]=useState<string|null>(null);
  const [urgentDropoff,setUrgentDropoff]=useState(false);
  const [quickVehicle,setQuickVehicle]=useState<"CAR"|"MOTO">("CAR");
  const [flashFares,setFlashFares]=useState<Partial<Record<"CAR"|"MOTO",QuickRideFarePreview>>>({});
  const [flashFarePending,setFlashFarePending]=useState(false);
  const [flashActionContainer,setFlashActionContainer]=useState<HTMLElement|null>(null);
  const [confirmedPickupKey,setConfirmedPickupKey]=useState("");
  const [flashFare,setFlashFare]=useState<QuickRideFarePreview|null>(null);
  const [quickMunicipality,setQuickMunicipality]=useState("");
  const [quickDriverCount,setQuickDriverCount]=useState(0);
  const [quickDrivers,setQuickDrivers]=useState<ApproximateProfessionalDriver[]>([]);
  const [quickDriverLoading,setQuickDriverLoading]=useState(false);
  const [quickDriverError,setQuickDriverError]=useState("");
  const onQuickCoverage=useCallback((value:QuickRideCoverage|null)=>setQuickMunicipality(value?.radar&&value.municipality?value.municipality:""),[]);
  const onPassengerRide=useCallback((ride:{id:string;status:string;municipality:string}|null)=>setPassengerRide(ride),[]);
  const onUrgentDropoff=useCallback((pending:boolean)=>{setUrgentDropoff(pending);if(pending){setTripsPanelOpen(false);setSheetSnap("full");}},[]);
  const onPassengerPhase=useCallback((status:string|null)=>{
    setPassengerPhase(status);
    if(status&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS","COMPLETED"].includes(status)){setTripsPanelOpen(false);setSheetSnap("full");}
  },[]);
  const [vehicleModalOpen,setVehicleModalOpen]=useState(false);
  const [missingVehicleFields,setMissingVehicleFields]=useState<VehicleMissingField[]>([]);
  const [selectingOrigin,setSelectingOrigin]=useState(false);
  const [pickupDialogOpen,setPickupDialogOpen]=useState(false);
  const [pickupCandidate,setPickupCandidate]=useState<FormLocationDetails|null>(null);
  const [origin,setOrigin]=useState("");
  const [originLocation,setOriginLocation]=useState<FormLocationDetails>();
  const [appliedOriginAccuracy,setAppliedOriginAccuracy]=useState<number|null>(null);
  const [resolvedAddress,setResolvedAddress]=useState<FormLocationDetails|null>(null);
  const [originSource,setOriginSource]=useState<"CURRENT_LOCATION"|"MANUAL_ORIGIN">("CURRENT_LOCATION");
  const originWasManuallySelected=useRef(false);
  const originLookupSequence=useRef(0);
  const lastGpsLookup=useRef<{lat:number;lng:number;at:number}|null>(null);
  // Preserve the real fix used for pricing while live GPS continues on the map.
  const passengerOriginFix=useRef<UserPosition|null>(null);
  const awaitingNewOriginVersion=useRef<number|null>(null);

  const showTrips=()=>{lastPlanningSnap.current=sheetSnap;setSheetSnap("full");setTripsPanelOpen(true);};
  const closeTrips=()=>{setTripsPanelOpen(false);setSheetSnap(lastPlanningSnap.current);};
  const handleShellRouteChange=useCallback((route:ShellRoute|null,from:{lat:number;lng:number}|null)=>{setShellRoute(route);setShellRouteOrigin(from);},[]);
  const [passengerDestinationLabel,setPassengerDestinationLabel]=useState("");
  const handleDestinationChange=useCallback((_label:string,details?:FormLocationDetails)=>{
    setPassengerDestinationLabel(_label);setSelectedOnRouteMatch(null);setShellDestinationLocation(details);
    setShellSelectedDestination(validPoint(details));setShellRoute(null);
  },[]);
  useEffect(()=>{
    setShellRoute(null);setShellRouteOrigin(null);setShellSelectedDestination(false);
    setShellDestinationLocation(undefined);setSelectedOnRouteMatch(null);
    passengerOriginFix.current=null;awaitingNewOriginVersion.current=null;
    setConfirmedPickupKey("");setPickupCandidate(null);setPickupDialogOpen(false);
  },[activeRoleState.activeRole,serviceType]);
  useEffect(()=>{
    const expand=()=>setSheetSnap("half");document.addEventListener("caronaa-shell-expand",expand);
    return()=>document.removeEventListener("caronaa-shell-expand",expand);
  },[]);
  const passengerPreview=activeRoleState.activeRole==="PASSAGEIRO"&&serviceType==="FLASH";
  const scheduledDriverPreview=activeRoleState.activeRole==="MOTORISTA"&&serviceType==="AGENDADA";
  // Traditional rides can preview a real approximate fix, then ask the user
  // to confirm the departure point. Professional Flash keeps its strict GPS.
  const originPreview=passengerPreview||scheduledDriverPreview;
  const usableOriginFix=originPreview?canPreviewPassengerPickup(location.addressPosition):isTrustedGpsFix(location.addressPosition);

  useEffect(()=>{
    if(originSource!=="CURRENT_LOCATION"||originWasManuallySelected.current)return;
    if(originPreview&&awaitingNewOriginVersion.current!==null){
      if(location.recenterVersion===awaitingNewOriginVersion.current)return;
      awaitingNewOriginVersion.current=null;
    }
    const fix=originPreview
      ?passengerOriginFix.current??(canPreviewPassengerPickup(location.addressPosition)?location.addressPosition:null)
      :isTrustedGpsFix(location.addressPosition)?location.addressPosition:null;
    if(!fix){setOriginLocation(undefined);setAppliedOriginAccuracy(null);if(location.failure)setOrigin("");return;}
    if(originPreview&&!passengerOriginFix.current)passengerOriginFix.current={...fix};
    const {lat,lng,accuracy}=fix;
    const addressIsNear=resolvedAddress?.lat!=null&&resolvedAddress.lng!=null&&
      Math.abs(resolvedAddress.lat-lat)<0.0003&&Math.abs(resolvedAddress.lng-lng)<0.0003;
    const label=addressIsNear?resolvedAddress?.formattedAddress||"Minha localização atual":"Minha localização atual";
    setOrigin(label);setAppliedOriginAccuracy(accuracy);
    setOriginLocation({rawText:label,formattedAddress:label,lat,lng,isApproximate:!isTrustedGpsFix(fix)});
  },[originSource,location.addressPosition,location.failure,location.recenterVersion,resolvedAddress,originPreview,usableOriginFix]);

  useEffect(()=>{
    // The same approximate GPS fix used for pickup preview must also be
    // eligible for its human-readable address (without confirming pickup).
    const fix=originPreview
      ? passengerOriginFix.current??location.addressPosition
      : location.addressPosition;
    const usableFix=originPreview?canPreviewPassengerPickup(fix):isTrustedGpsFix(fix);
    if(originSource!=="CURRENT_LOCATION"||!fix||!usableFix||location.locating)return;
    const previous=lastGpsLookup.current;
    const distance=previous?111195*Math.hypot(fix.lat-previous.lat,(fix.lng-previous.lng)*Math.cos(fix.lat*Math.PI/180)):Infinity;
    if(previous&&distance<75&&Date.now()-previous.at<120000)return;
    lastGpsLookup.current={lat:fix.lat,lng:fix.lng,at:Date.now()};
    const version=++originLookupSequence.current;
    void sessionRequest("home-reverse:"+fix.lat.toFixed(3)+":"+fix.lng.toFixed(3),()=>reverseGeocode({data:{lat:fix.lat,lng:fix.lng}}),120000)
      .then(value=>{if(version===originLookupSequence.current)setResolvedAddress(value);})
      .catch(()=>{if(version===originLookupSequence.current)lastGpsLookup.current=null;});
  },[location.addressPosition,location.locating,originSource,originPreview,reverseGeocode]);

  // If the reverse lookup finishes while the pickup dialog is open,
  // refresh only the label, never the point the passenger is confirming.
  useEffect(()=>{
    if(!resolvedAddress?.formattedAddress)return;
    setPickupCandidate(previous=>{
      if(!validPoint(previous)||!validPoint(resolvedAddress))return previous;
      if(Math.abs(previous.lat-resolvedAddress.lat)>0.0003||
         Math.abs(previous.lng-resolvedAddress.lng)>0.0003)return previous;
      if(previous.formattedAddress===resolvedAddress.formattedAddress)return previous;
      const label=resolvedAddress.formattedAddress??previous.rawText;return {...previous,formattedAddress:label,
        rawText:label};
    });
  },[resolvedAddress]);

  const chooseOriginOnMap=useCallback((point:{lat:number;lng:number})=>{
    if(!validPoint(point))return;
    const request=++originLookupSequence.current;
    originWasManuallySelected.current=true;passengerOriginFix.current=null;awaitingNewOriginVersion.current=null;
    setOriginSource("MANUAL_ORIGIN");setAppliedOriginAccuracy(null);setConfirmedPickupKey("");
    const fallback="Ponto selecionado no mapa";
    setOrigin(fallback);setOriginLocation({rawText:fallback,formattedAddress:fallback,lat:point.lat,lng:point.lng});
    setShellRouteOrigin(point);setShellRoute(null);setResolvedAddress(null);setSelectingOrigin(false);
    setShellOriginRevision(value=>value+1);setSheetSnap(scheduledDriverPreview?"half":passengerDestinationLabel?"full":"half");
    void reverseGeocode({data:point}).then(details=>{
      if(request!==originLookupSequence.current||!details)return;
      const label=details.formattedAddress||fallback;
      setOrigin(label);setResolvedAddress(details);
      setOriginLocation({...details,rawText:label,formattedAddress:label,lat:point.lat,lng:point.lng});
    }).catch(()=>undefined);
  },[reverseGeocode,passengerDestinationLabel,scheduledDriverPreview]);

  const plannedPickup=shellSelectedDestination&&validPoint(shellRouteOrigin)?shellRouteOrigin:originLocation;
  const pickupKey=validPoint(plannedPickup)?JSON.stringify([plannedPickup.lat,plannedPickup.lng]):"";
  const pickupMatchesApplied=validPoint(plannedPickup)&&validPoint(originLocation)&&
    plannedPickup.lat===originLocation.lat&&plannedPickup.lng===originLocation.lng;
  // Unknown accuracy is not converted into an invented acceptable GPS value.
  const quotedAccuracy=pickupMatchesApplied?appliedOriginAccuracy:null;
  const quotedOrigin:FormLocationDetails|undefined=validPoint(plannedPickup)?{
    ...originLocation,rawText:originLocation?.rawText||origin||"Minha localização atual",
    lat:plannedPickup.lat,lng:plannedPickup.lng,
  }:undefined;
  const previewablePickup=originSource==="MANUAL_ORIGIN"||
    (validPoint(plannedPickup)&&quotedAccuracy!==null&&canPreviewPassengerPickup({...plannedPickup,accuracy:quotedAccuracy}));
  const pickupNeedsConfirmation=originPreview&&originSource==="CURRENT_LOCATION"&&validPoint(plannedPickup)&&
    (quotedAccuracy===null||needsPassengerPickupConfirmation({...plannedPickup,accuracy:quotedAccuracy}))&&confirmedPickupKey!==pickupKey;
  const locatingPickup=originSource==="CURRENT_LOCATION"&&location.locating&&!validPoint(quotedOrigin);
  const openPickupDialog=()=>{setPickupCandidate(quotedOrigin??null);setPickupDialogOpen(true);};
  const confirmPickup=()=>{
    if(!validPoint(pickupCandidate))return;
    const candidateKey=JSON.stringify([pickupCandidate.lat,pickupCandidate.lng]);
    if(candidateKey!==pickupKey){
      setPickupCandidate(quotedOrigin??null);
      toast.info(scheduledDriverPreview?"O ponto de saída mudou. Confira o local novamente.":"O ponto de embarque mudou. Confira o local novamente.");return;
    }
    // Closing the dialog is not consent. This action never submits a ride.
    ++originLookupSequence.current;originWasManuallySelected.current=true;
    setOriginSource("MANUAL_ORIGIN");setConfirmedPickupKey(candidateKey);
    setOriginLocation({...pickupCandidate,isApproximate:false});setAppliedOriginAccuracy(null);
    setShellRouteOrigin({lat:pickupCandidate.lat,lng:pickupCandidate.lng});
    setPickupDialogOpen(false);setPickupCandidate(null);
  };
  const requestNewPickupLocation=()=>{
    ++originLookupSequence.current;lastGpsLookup.current=null;originWasManuallySelected.current=false;
    passengerOriginFix.current=null;awaitingNewOriginVersion.current=location.recenterVersion;
    setOriginSource("CURRENT_LOCATION");setOrigin("");setOriginLocation(undefined);setResolvedAddress(null);
    setAppliedOriginAccuracy(null);setShellRoute(null);setShellRouteOrigin(null);setConfirmedPickupKey("");
    setShellOriginRevision(value=>value+1);setPickupCandidate(null);setPickupDialogOpen(false);
    location.locate();
  };

  const handleShellRoleSwitch=async(target:ActiveRole)=>{
    if(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS","COMPLETED"].includes(passengerPhase)){
      toast.info("Cancele a solicitação Flash antes de alternar de papel.");setSheetSnap("full");return;
    }
    const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
    if(!check.allowed){toast[check.reason==="ACTIVE_RIDE"?"info":"error"](check.reason==="ACTIVE_RIDE"
      ?"Não é possível alternar de papel durante uma corrida em andamento":"Não foi possível verificar suas corridas. Tente novamente.");return;}
    const result=await activeRoleState.switchRole(target);
    if(result.needsVehicleModal){setMissingVehicleFields(result.missingFields);setVehicleModalOpen(true);}
  };

  const radarPickup=validPoint(originLocation)?{lat:originLocation.lat,lng:originLocation.lng}:location.position??null;
  const radarLat=radarPickup?Math.round(radarPickup.lat*1000)/1000:null;
  const radarLng=radarPickup?Math.round(radarPickup.lng*1000)/1000:null;
  useEffect(()=>{
    if(activeRoleState.activeRole!=="PASSAGEIRO"||serviceType!=="FLASH"||!quickMunicipality){
      setQuickDriverCount(0);setQuickDrivers([]);setQuickDriverError("");setQuickDriverLoading(false);return;
    }
    let alive=true;
    const refresh=async()=>{
      if(alive)setQuickDriverLoading(true);
      try{
        const {data,error}=radarLat!=null&&radarLng!=null
          ?await (supabase as any).rpc("discover_caronaa_quick_drivers",{p_lat:radarLat,p_lng:radarLng,p_vehicle:quickVehicle,p_radius_km:QUICK_RADAR_RADIUS_KM})
          :await (supabase as any).rpc("discover_caronaa_quick_drivers",{p_municipality:quickMunicipality,p_vehicle:quickVehicle});
        if(!alive)return;if(error)throw error;
        const approvedDrivers=mapQuickRadarDrivers(data,quickVehicle);
        setQuickDrivers(approvedDrivers);setQuickDriverCount(approvedDrivers.length);setQuickDriverError("");
      }catch{if(alive){setQuickDriverCount(0);setQuickDrivers([]);setQuickDriverError("Radar indisponível. Tente novamente.");}}
      finally{if(alive)setQuickDriverLoading(false);}
    };
    void refresh();const timer=window.setInterval(refresh,15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[activeRoleState.activeRole,serviceType,quickMunicipality,quickVehicle,radarLat,radarLng]);
  // Live GPS is rendered separately by the map; it is never a fallback pickup.
  const mapOrigin=validPoint(plannedPickup)?plannedPickup:undefined;
  const currentDestination=shellSelectedDestination?shellDestinationLocation:undefined;
  const driverRole=activeRoleState.activeRole==="MOTORISTA";
  const shouldShowOperationalMap=driverRole&&serviceType==="FLASH"&&driverFlashRide!=null;
  const shouldShowPassengerMap=!driverRole&&serviceType==="FLASH"&&passengerRide!==null;

  return <AppShell mapLayout>
    <CaronaaPerformanceDiagnostic/>
    <div className="relative isolate h-full min-h-0 min-w-0 overflow-hidden bg-[#121212] font-[family-name:var(--font-sans)] text-white">
      <div className="absolute inset-0">
        {shouldShowPassengerMap&&passengerRide?<QuickRideOperationalMap rideId={passengerRide.id} status={passengerRide.status} role="PASSENGER" immersive/>:
          shouldShowOperationalMap&&driverFlashRide?<QuickRideOperationalMap rideId={driverFlashRide.id} status={driverFlashRide.status} role="DRIVER" vehicleType={driverFlashRide.vehicleType} immersive/>:
          <HomeRideMap immersive passengerPreview={originPreview}
            professionalDrivers={quickDrivers} userPosition={location.position}
            plannedRoute={shellSelectedDestination?shellRoute:null} routeManagedExternally={shellSelectedDestination}
            onRouteMeeting={selectedOnRouteMatch&&shellRouteOrigin?{origin:shellRouteOrigin,pickup:{lat:selectedOnRouteMatch.pickupMeeting.lat,lng:selectedOnRouteMatch.pickupMeeting.lng,poiName:selectedOnRouteMatch.pickupMeeting.poiName}}:null}
            routeBottomInset={shellSelectedDestination?(typeof window!=="undefined"&&window.innerWidth>=768?72:
              Math.round((typeof window==="undefined"?800:window.innerHeight)*(sheetSnap==="peek"?0.15:sheetSnap==="half"?0.50:0.85))+24):undefined}
            routeLeftInset={typeof window!=="undefined"&&window.innerWidth>=768?480:48}
            origin={mapOrigin} destination={currentDestination} originIsCurrent={originSource==="CURRENT_LOCATION"}
            originAccuracyM={originPreview?(validPoint(plannedPickup)?quotedAccuracy??Number.POSITIVE_INFINITY:null):location.originAccuracyM}
            following={originSource==="CURRENT_LOCATION"&&(originPreview?canPreviewPassengerPickup(location.position):isTrustedGpsFix(location.position))&&location.isFollowingUser}
            recenterVersion={location.recenterVersion} locating={location.locating}
            selectingOrigin={selectingOrigin} onPickOrigin={chooseOriginOnMap}
            onDrag={()=>location.setFollowing(false)} onRecenter={location.locate}/>}
      </div>
      {!selectingOrigin&&<div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3 pt-[env(safe-area-inset-top)]">
        <RoleSwitchHeader activeRole={activeRoleState.activeRole} disabled={activeRoleState.loading||activeRoleState.busy} onSwitch={handleShellRoleSwitch}/>
      </div>}
      <QuickVehicleModal open={vehicleModalOpen} onOpenChange={setVehicleModalOpen} missingFields={missingVehicleFields}
        initialType={activeRoleState.vehicleType} initialSeats={activeRoleState.vehicleSeats}
        onSave={async vehicle=>{
          const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
          if(!check.allowed)throw new Error(check.reason==="ACTIVE_RIDE"?"Não é possível alternar durante uma corrida.":"Não foi possível verificar suas corridas.");
          await activeRoleState.saveVehicle(vehicle);
        }}/>
      <InteractiveBottomSheet value={urgentDropoff?"full":sheetSnap} onChange={snap=>setSheetSnap(urgentDropoff?"full":snap)} title="Casca Única CARONAA"
        headerAction={!tripsPanelOpen?<button type="button" onClick={showTrips} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#FFBB00]">{driverRole?"Agendados":"Minhas Viagens"}</button>:undefined}>
        {tripsPanelOpen&&driverRole&&<DriverScheduledTripsPanel onClose={closeTrips} refreshKey={driverTripsRefreshKey}/>}
        {tripsPanelOpen&&!driverRole&&<UnifiedMyTripsPanel onClose={closeTrips} refreshKey={tripsRefreshKey} onShowOnMap={(trip:UnifiedTrip)=>{
          if(trip.operationalRideId!==passengerRide?.id){toast.info("O acompanhamento desta viagem no mapa ainda não está disponível.");return;}
          closeTrips();setSheetSnap("peek");
        }}/>}
        <div className={tripsPanelOpen?"hidden":"h-full min-h-0"}>
          {driverRole&&serviceType==="FLASH"?<DriverFlashPlanner
            snap={sheetSnap} onSnapChange={setSheetSnap} serviceType={serviceType} onServiceTypeChange={setServiceType}
            vehicleType={activeRoleState.vehicleType==="moto"?"MOTO":"CAR"} municipality={resolvedAddress?.city??""}
            originPoint={(validPoint(originLocation)?{lat:originLocation.lat,lng:originLocation.lng}:location.position)??null}
            originLabel={origin||"Localização atual (GPS)"} originRevision={shellOriginRevision}
            onAdjustOrigin={()=>{setSelectingOrigin(true);setSheetSnap("half");}}
            onRouteChange={handleShellRouteChange} onActiveRideChange={setDriverFlashRide} onDestinationChange={handleDestinationChange}/>:
          driverRole?<DriverScheduledPlanner
            snap={sheetSnap} onSnapChange={setSheetSnap} serviceType={serviceType} onServiceTypeChange={setServiceType}
            vehicleType={activeRoleState.vehicleType==="moto"?"MOTO":"CAR"} maxSeats={activeRoleState.vehicleSeats} gender={gender}
            originPoint={originLocation} originLabel={origin} originRevision={shellOriginRevision}
            locating={locatingPickup} originNeedsConfirmation={pickupNeedsConfirmation} onConfirmOrigin={openPickupDialog}
            onAdjustOrigin={()=>{setSelectingOrigin(true);setSheetSnap("peek");}}
            onRouteChange={handleShellRouteChange} onDestinationChange={handleDestinationChange}
            onPublished={()=>setDriverTripsRefreshKey(value=>value+1)} onOpenTrips={showTrips}/>:
          <ShellJourneyPlanner snap={sheetSnap} onSnapChange={setSheetSnap}
            serviceType={serviceType} onServiceTypeChange={next=>{
              if(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS","COMPLETED"].includes(passengerPhase)){
                toast.info("Finalize ou cancele a corrida atual antes de mudar de modalidade.");setSheetSnap("full");return;
              }setServiceType(next);
            }}
            originPoint={originLocation} originLabel={origin} locating={locatingPickup}
            originRevision={shellOriginRevision} originMunicipality={resolvedAddress?.city??""} gender={gender}
            onFlashVehicleChange={setQuickVehicle}
            flashRideActive={Boolean(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS","COMPLETED"].includes(passengerPhase))}
            flashFare={flashFare} flashFares={flashFares} flashFarePending={flashFarePending}
            onFlashActionContainer={setFlashActionContainer}
            flashOperationalPanel={<QuickRideHomePanel
              origin={origin||"Minha localização atual"} destination={passengerDestinationLabel}
              originPoint={quotedOrigin} destinationPoint={shellDestinationLocation}
              locating={locatingPickup} vehicle={quickVehicle} onVehicleChange={setQuickVehicle}
              driverCount={quickDriverCount} driverLoading={quickDriverLoading} driverError={quickDriverError}
              gpsOriginIsImprecise={originSource==="CURRENT_LOCATION"&&!previewablePickup}
              pickupNeedsConfirmation={pickupNeedsConfirmation} onConfirmPickup={openPickupDialog}
              actionContainer={flashActionContainer} onFaresChange={setFlashFares} onFarePendingChange={setFlashFarePending}
              onCoverage={onQuickCoverage} onOperationalRideChange={onPassengerRide} onRidePhaseChange={onPassengerPhase}
              onDropoffPendingChange={onUrgentDropoff} onFareChange={setFlashFare}
              onOpenOperational={()=>setSheetSnap("full")} shellMode shellSnap={sheetSnap}/>}
            onAdjustOrigin={openPickupDialog} onRouteChange={handleShellRouteChange}
            onOnRouteMatchSelected={setSelectedOnRouteMatch} onDestinationChange={handleDestinationChange}
            onScheduled={()=>setTripsRefreshKey(value=>value+1)}/>}
        </div>
      </InteractiveBottomSheet>
      <Dialog open={pickupDialogOpen} onOpenChange={open=>{setPickupDialogOpen(open);if(!open)setPickupCandidate(null);}}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>{scheduledDriverPreview?"De onde sua carona vai sair?":"Onde você vai embarcar?"}</DialogTitle>
          <DialogDescription>{scheduledDriverPreview?"Confira o ponto mostrado no mapa. Fechar esta janela não confirma a saída.":"Confira o ponto mostrado no mapa. Fechar esta janela não confirma o embarque."}</DialogDescription>
          {validPoint(pickupCandidate)&&<section aria-label={scheduledDriverPreview?"Ponto de saída a confirmar":"Ponto de embarque a confirmar"} className="space-y-3 rounded-xl border border-[#FFBB00]/40 p-4">
            <p className="font-semibold">{pickupCandidate.formattedAddress||pickupCandidate.rawText||"Ponto mostrado no mapa"}</p>
            {pickupNeedsConfirmation&&<p className="text-sm text-muted-foreground">{scheduledDriverPreview?"Sua localização é aproximada. Confirme se o marcador está no local de saída da sua carona.":"Sua localização é aproximada. Confirme se o marcador está no local onde você vai esperar o motorista."}</p>}
            <Button type="button" onClick={confirmPickup} className="min-h-12 h-auto w-full whitespace-normal bg-[#FFBB00] text-[#121212]">{scheduledDriverPreview?"Confirmar este ponto de saída":"Confirmar este ponto de embarque"}</Button>
          </section>}
          <LocationAutocomplete id="passenger-pickup" label="Buscar saída" variant="simple" value={origin}
            selectedLocation={originLocation} onChange={(_label,details)=>{
              if(!validPoint(details))return;
              chooseOriginOnMap({lat:details.lat,lng:details.lng});setPickupDialogOpen(false);setPickupCandidate(null);
            }}/>
          <Button type="button" variant="outline" className="min-h-12" onClick={()=>{setPickupDialogOpen(false);setPickupCandidate(null);setSelectingOrigin(true);setSheetSnap("peek");}}>Escolher no mapa</Button>
          <Button type="button" variant="ghost" className="min-h-12" onClick={requestNewPickupLocation}>Usar localização atual</Button>
        </DialogContent>
      </Dialog>
      {selectingOrigin&&<div role="status" className="absolute inset-x-3 top-3 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-[#FFBB00]/50 bg-[#121212]/95 p-3 text-sm shadow-xl backdrop-blur-xl sm:inset-x-5">
        <p><strong className="text-[#FFBB00]">Definir saída:</strong> toque no ponto correto do mapa.</p>
        <button type="button" onClick={()=>setSelectingOrigin(false)} className="min-h-12 shrink-0 rounded-lg border border-white/30 px-3 font-semibold">Cancelar</button>
      </div>}
    </div>
  </AppShell>;
}
