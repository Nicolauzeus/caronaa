import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { QuickVehicleModal } from "@/components/caronaa/shell/QuickVehicleModal";
import { InteractiveBottomSheet, type SheetSnap } from "@/components/caronaa/shell/InteractiveBottomSheet";
import type { ServiceType } from "@/components/caronaa/shell/ServiceTypeDock";
import { ShellJourneyPlanner, type ShellRoute } from "@/components/caronaa/shell/ShellJourneyPlanner";
import { UnifiedMyTripsPanel, type UnifiedTrip } from "@/components/caronaa/shell/UnifiedMyTripsPanel";
import { DriverScheduledPlanner } from "@/components/caronaa/shell/DriverScheduledPlanner";
import { DriverHomeDashboard } from "@/components/caronaa/shell/DriverHomeDashboard";
import { DriverFlashPlanner } from "@/components/caronaa/shell/DriverFlashPlanner";
import type { FlashDriverRide } from "@/services/flash-driver-service";
import { DriverScheduledTripsPanel } from "@/components/caronaa/shell/DriverScheduledTripsPanel";
import type { OnRouteMatch } from "@/types/ride";
import { useActiveRole, getVehicleStatus, type ActiveRole, type VehicleMissingField } from "@/lib/role/use-active-role";
import { canSwitchCaronaaRole } from "@/lib/role/role-switch-guard";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
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
import { useUserLocation, validPoint, locationFailureMessages, type UserPosition } from "@/lib/location/use-user-location";
import { canPreviewPassengerPickup, needsPassengerPickupConfirmation } from "@/lib/location/passenger-pickup";
import { isTrustedGpsFix } from "@/lib/location/gps-trust";
import { reverseGeocodeServerFn, reversePassengerPickupServerFn } from "@/lib/location.functions";
import { sessionRequest } from "@/lib/session-request-cache";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";

/** Align map route padding with the actual mobile drawer height. */
function mobileSheetBottomInset(snap:SheetSnap):number {
  if(typeof window==="undefined")return 224;
  const viewport=window.visualViewport?.height??window.innerHeight;
  const mapHeight=Math.max(240,viewport-56-80);
  const sheetHeight=snap==="peek"?224:snap==="half"?mapHeight*.68:
    Math.min(mapHeight*.92,mapHeight-70);
  return Math.round(Math.min(sheetHeight,mapHeight-70))+24;
}

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: z.object({intent:z.enum(["offer","request"]).optional(),trips:z.enum(["open"]).optional()}),
  beforeLoad:async({context,location})=>{
    beginCaronaaPhase("home-before-load");
    try {
      // The authenticated parent route already verified session, basic
      // onboarding and launch campaign access. Avoid repeating those three
      // network checks before rendering the Home map.
      const user=context.user;
      if (!user) return;
      if (getAdminAppPreview(user.id)) return;
      const destination=await getMyAdminEntry();
      if (destination) throw redirect({to:destination as "/admin",replace:true});
      // Any registered driver opens availability first, whether F07-ready or
      // still completing their professional data. This is navigation only:
      // the guarded route and database still control dispatch and online GPS.
      const {data:roleRow,error:roleError}=await (supabase as any).from("profiles")
        .select("active_role,avatar_url,vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats")
        .eq("id",user.id).maybeSingle();
      // Explicit role switching in the drawer must remain possible, including
      // for authorized professionals who wish to offer an ordinary carona.
      const activityIntent=(location.search as {intent?:string}).intent;
      if(roleError)throw new Error("Não foi possível identificar o perfil ativo.");
      // A user who chose MOTORISTA during signup must not silently fall into
      // passenger Home while their first driver registration remains incomplete.
      // Existing passengers and intentional role changes are left alone.
      if(roleRow?.active_role==="PASSAGEIRO"&&activityIntent!=="request"){
        const vehicleComplete=getVehicleStatus(roleRow).isComplete;
        const photoComplete=Boolean(roleRow.avatar_url?.trim());
        if(!vehicleComplete||!photoComplete){
          const {data:progress,error:onboardingError}=await (supabase as any)
            .from("user_onboarding_progress").select("usage_role")
            .eq("user_id",user.id).maybeSingle();
          if(onboardingError)throw new Error("Não foi possível conferir seu cadastro inicial.");
          if(progress?.usage_role==="MOTORISTA")
            throw redirect({to:"/cadastro-veiculo",replace:true});
        }
      }
      // Explicit scheduled carpool and trip-list navigation remains available
      // without silently forcing drivers into the old shared-driver dashboard.
      if(roleRow?.active_role==="MOTORISTA"&&!activityIntent&&
         (location.search as {trips?:string}).trips!=="open"){
        throw redirect({to:"/disponibilidade-profissional",replace:true});
      }
    } finally {
      endCaronaaPhase("home-before-load");
      beginCaronaaPhase("home-first-render");
    }
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
  const navigate=useNavigate();
  const [offerIntentOpen,setOfferIntentOpen]=useState(false);
  const [requestIntentOpen,setRequestIntentOpen]=useState(false);
  const offerVehicleSavedRef=useRef(false);
  useEffect(()=>{endCaronaaPhase("home-first-render");},[]);
  const activeRoleState=useActiveRole();
  const gender=useProfileGender();
  const location=useUserLocation({autoLocate:true});
  const reverseGeocode=useServerFn(reverseGeocodeServerFn);
  const reversePassengerPickup=useServerFn(reversePassengerPickupServerFn);
  const [sheetSnap,setSheetSnap]=useState<SheetSnap>("peek");
  useEffect(()=>{if(typeof window!=="undefined"&&window.matchMedia("(min-width: 768px)").matches)setSheetSnap("half");},[]);
  const [serviceType,setServiceType]=useState<ServiceType>("FLASH");
  const [driverHomeOpen,setDriverHomeOpen]=useState(true);
  useEffect(()=>{
    if(activeRoleState.loading)return;
    // The persisted role, not a URL query or the first-render default,
    // determines which cockpit appears on every direct /home visit.
    if(activeRoleState.activeRole==="MOTORISTA"){
      setServiceType("AGENDADA");
      setDriverHomeOpen(true);
      setSheetSnap(routeSearch.trips==="open"?"full":"half");
    }else{
      setServiceType("FLASH");
      setDriverHomeOpen(false);
      setSheetSnap(routeSearch.trips==="open"?"full":"peek");
    }
  },[activeRoleState.loading,activeRoleState.activeRole,routeSearch.trips]);
  useEffect(()=>{
    const showDriverHome=()=>{setDriverHomeOpen(true);setServiceType("AGENDADA");setTripsPanelOpen(false);setSheetSnap("half");};
    const showPassengerHome=()=>{setTripsPanelOpen(false);setSheetSnap("peek");setServiceType("FLASH");};
    window.addEventListener("caronaa:driver-home",showDriverHome);
    window.addEventListener("caronaa:passenger-home",showPassengerHome);
    return()=>{
      window.removeEventListener("caronaa:driver-home",showDriverHome);
      window.removeEventListener("caronaa:passenger-home",showPassengerHome);
    };
  },[]);
  const [tripsPanelOpen,setTripsPanelOpen]=useState(false);
  useEffect(()=>{if(routeSearch.trips==="open"){setTripsPanelOpen(true);setSheetSnap("full");}else setTripsPanelOpen(false);},[routeSearch.trips]);
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
  const [quickDriverCounts,setQuickDriverCounts]=useState<Record<"CAR"|"MOTO",number>>({CAR:0,MOTO:0});
  const [quickDriverErrors,setQuickDriverErrors]=useState<Partial<Record<"CAR"|"MOTO",string>>>({});
  const [quickDrivers,setQuickDrivers]=useState<ApproximateProfessionalDriver[]>([]);
  const [quickDriverLoading,setQuickDriverLoading]=useState(false);
  const [quickDriverError,setQuickDriverError]=useState("");
  const onQuickCoverages=useCallback((values:Partial<Record<"CAR"|"MOTO",QuickRideCoverage>>)=>{
    // Discover both fleets when either mode is in an active radar zone.
    const available=(["CAR","MOTO"] as const).map(type=>values[type]).find(value=>value?.radar&&value.municipality);
    setQuickMunicipality(available?.municipality??"");
  },[]);
  const onPassengerRide=useCallback((ride:{id:string;status:string;municipality:string}|null)=>setPassengerRide(ride),[]);
  const onUrgentDropoff=useCallback((pending:boolean)=>{setUrgentDropoff(pending);if(pending){setTripsPanelOpen(false);setSheetSnap("full");}},[]);
  const previousPassengerPhase=useRef<string|null>(null);
  const onPassengerPhase=useCallback((status:string|null)=>{
    const wasActive=previousPassengerPhase.current!==null&&
      ["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(previousPassengerPhase.current);
    previousPassengerPhase.current=status;
    setPassengerPhase(status);
    if(status&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(status)){
      setTripsPanelOpen(false);setSheetSnap("full");
    }else if(wasActive&&!status){
      // Once the server ends the ride, release the full-height live panel.
      setTripsPanelOpen(false);setSheetSnap("peek");
    }
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
    const label=addressIsNear?resolvedAddress?.formattedAddress||"Localização obtida pelo GPS":"Localização obtida pelo GPS";
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
    const lookup=passengerPreview?reversePassengerPickup:reverseGeocode;
    void sessionRequest((passengerPreview?"passenger-address:":"home-reverse:")+fix.lat.toFixed(5)+":"+fix.lng.toFixed(5),
      ()=>lookup({data:{lat:fix.lat,lng:fix.lng}}),120000)
      .then(value=>{if(version===originLookupSequence.current)setResolvedAddress(value);})
      .catch(()=>{if(version===originLookupSequence.current)lastGpsLookup.current=null;});
  },[location.addressPosition,location.locating,originSource,originPreview,passengerPreview,reverseGeocode,reversePassengerPickup]);

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
    void (passengerPreview?reversePassengerPickup:reverseGeocode)({data:point}).then(details=>{
      if(request!==originLookupSequence.current||!details)return;
      const label=details.formattedAddress||fallback;
      setOrigin(label);setResolvedAddress(details);
      setOriginLocation({...details,rawText:label,formattedAddress:label,lat:point.lat,lng:point.lng});
    }).catch(()=>undefined);
  },[reverseGeocode,reversePassengerPickup,passengerPreview,passengerDestinationLabel,scheduledDriverPreview]);

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
  // F07 requires the passenger to approve the actual boarding pin, even if
  // the phone GPS is highly accurate. Sensor accuracy is not road accessibility.
  // Scheduled-driver departure keeps its existing lower-accuracy policy.
  const pickupNeedsConfirmation=passengerPreview
    ? validPoint(plannedPickup)&&confirmedPickupKey!==pickupKey
    : originPreview&&originSource==="CURRENT_LOCATION"&&validPoint(plannedPickup)&&
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
    // Explicit confirmation does not magically improve the sensor's precision.
    setOriginLocation({...pickupCandidate});setAppliedOriginAccuracy(null);
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
    if(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(passengerPhase)){
      toast.info("Cancele a solicitação Flash antes de alternar de papel.");setSheetSnap("full");return;
    }
    const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
    if(!check.allowed){toast[check.reason==="ACTIVE_RIDE"?"info":"error"](check.reason==="ACTIVE_RIDE"
      ?"Não é possível alternar de papel durante uma corrida em andamento":"Não foi possível verificar suas corridas. Tente novamente.");return;}
    const result=await activeRoleState.switchRole(target);
    if(result.needsVehicleModal){setMissingVehicleFields(result.missingFields);setVehicleModalOpen(true);}
  };

  // Activity changes originate in the hamburger menu. Route intents are UX
  // requests, never permission grants: every switch still runs ride guards and
  // completes missing vehicle details before enabling the driver role.
  useEffect(()=>{
    if(activeRoleState.loading)return;
    if(routeSearch.intent==="offer"){
      setRequestIntentOpen(false);
      if(activeRoleState.activeRole==="MOTORISTA"){
        setOfferIntentOpen(false);
        setTripsPanelOpen(false);
        setServiceType("AGENDADA");
        setDriverHomeOpen(true);
        setSheetSnap("half");
      }else setOfferIntentOpen(true);
      return;
    }
    if(routeSearch.intent==="request"){
      setOfferIntentOpen(false);
      if(activeRoleState.activeRole==="PASSAGEIRO"){
        setRequestIntentOpen(false);
        setTripsPanelOpen(false);
        setServiceType("FLASH");
        setSheetSnap("peek");
      }else setRequestIntentOpen(true);
      return;
    }
    setOfferIntentOpen(false);
    setRequestIntentOpen(false);
  },[routeSearch.intent,activeRoleState.activeRole,activeRoleState.loading]);

  // Radar must measure proximity from the same selected pickup used by pricing.
  const radarPickup=validPoint(plannedPickup)?{lat:plannedPickup.lat,lng:plannedPickup.lng}:null;
  const radarLat=radarPickup?Math.round(radarPickup.lat*1000)/1000:null;
  const radarLng=radarPickup?Math.round(radarPickup.lng*1000)/1000:null;
  useEffect(()=>{
    if(activeRoleState.activeRole!=="PASSAGEIRO"||serviceType!=="FLASH"||!quickMunicipality){
      setQuickDriverCounts({CAR:0,MOTO:0});setQuickDriverErrors({});
      setQuickDrivers([]);setQuickDriverError("");setQuickDriverLoading(false);return;
    }
    // A matched passenger already has the authenticated operational map.
    // Continuing 2 radar discovery RPCs every 15s cannot improve that journey.
    if(passengerRide){
      setQuickDriverLoading(false);
      return;
    }
    let alive=true;
    let inFlight=false;
    let loadedOnce=false;
    const refresh=async()=>{
      if(!alive||inFlight||document.hidden)return;
      inFlight=true;
      if(!loadedOnce)setQuickDriverLoading(true);
      // Two independent authorized radar queries: a failure in one fleet must
      // not hide the other fleet on the map or in the quote selector.
      const results=await Promise.allSettled((["CAR","MOTO"] as const).map(async type=>{
        const {data,error}=radarLat!=null&&radarLng!=null
          ?await (supabase as any).rpc("discover_caronaa_quick_drivers",{
            p_lat:radarLat,p_lng:radarLng,p_vehicle:type,p_radius_km:QUICK_RADAR_RADIUS_KM,
          })
          :await (supabase as any).rpc("discover_caronaa_quick_drivers",{
            p_municipality:quickMunicipality,p_vehicle:type,
          });
        if(error)throw error;
        return {type,drivers:mapQuickRadarDrivers(data,type)};
      }));
      inFlight=false;
      if(!alive)return;
      loadedOnce=true;
      const counts:Record<"CAR"|"MOTO",number>={CAR:0,MOTO:0};
      const visible:ApproximateProfessionalDriver[]=[];
      let failures=0;
      const errors:Partial<Record<"CAR"|"MOTO",string>>={};
      results.forEach((result,index)=>{
        if(result.status==="fulfilled"){
          counts[result.value.type]=result.value.drivers.length;
          visible.push(...result.value.drivers);
        }else{
          failures+=1;
          errors[(["CAR","MOTO"] as const)[index]]="Não foi possível consultar a disponibilidade agora.";
        }
      });
      setQuickDriverErrors(previous=>
        previous.CAR===errors.CAR&&previous.MOTO===errors.MOTO?previous:errors);
      setQuickDriverCounts(previous=>
        previous.CAR===counts.CAR&&previous.MOTO===counts.MOTO?previous:counts);
      setQuickDrivers(previous=>{
        if(previous.length===visible.length&&previous.every((driver,index)=>{
          const next=visible[index];
          return driver.driver_key===next.driver_key&&driver.lat===next.lat&&
            driver.lng===next.lng&&driver.seen_at===next.seen_at&&
            driver.vehicle_type===next.vehicle_type;
        }))return previous;
        return visible;
      });
      setQuickDriverError(failures===2?"Radar indisponível. Tente novamente.":"");
      setQuickDriverLoading(false);
    };
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},15000);
    const onVisible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      alive=false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[activeRoleState.activeRole,serviceType,quickMunicipality,radarLat,radarLng,passengerRide?.id]);
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
              mobileSheetBottomInset(sheetSnap)):undefined}
            routeLeftInset={typeof window!=="undefined"&&window.innerWidth>=768?480:48}
            origin={mapOrigin} destination={currentDestination} originIsCurrent={originSource==="CURRENT_LOCATION"}
            originAccuracyM={originPreview?(validPoint(plannedPickup)?quotedAccuracy??Number.POSITIVE_INFINITY:null):location.originAccuracyM}
            following={originSource==="CURRENT_LOCATION"&&(originPreview?canPreviewPassengerPickup(location.position):isTrustedGpsFix(location.position))&&location.isFollowingUser}
            recenterVersion={location.recenterVersion} locating={location.locating}
            selectingOrigin={selectingOrigin} onPickOrigin={chooseOriginOnMap}
            onDrag={()=>location.setFollowing(false)} onRecenter={location.locate}/>}
      </div>
      <QuickVehicleModal open={vehicleModalOpen} onOpenChange={open=>{
          setVehicleModalOpen(open);
          if(!open&&routeSearch.intent==="offer"){
            if(!offerVehicleSavedRef.current)void navigate({to:"/home",search:{},replace:true});
            offerVehicleSavedRef.current=false;
          }
        }} missingFields={missingVehicleFields}
        initialType={activeRoleState.vehicleType} initialSeats={activeRoleState.vehicleSeats}
        onSave={async vehicle=>{
          const check=await canSwitchCaronaaRole(driverFlashRide??passengerRide);
          if(!check.allowed)throw new Error(check.reason==="ACTIVE_RIDE"?"Não é possível alternar durante uma corrida.":"Não foi possível verificar suas corridas.");
          await activeRoleState.saveVehicle(vehicle);
          if(routeSearch.intent==="offer"){
            offerVehicleSavedRef.current=true;
            setServiceType("AGENDADA");
            setSheetSnap("half");
          }
        }}/>
      {!activeRoleState.loading&&activeRoleState.roleLoadFailed&&
        <div role="alert" className="absolute inset-x-3 bottom-4 z-30 space-y-2 rounded-2xl border border-[#FFBB00]/40 bg-[#121212] p-4 text-sm text-white">
          <p>Não foi possível identificar seu perfil ativo. Nenhuma atividade foi alterada.</p>
          <button type="button" onClick={()=>void activeRoleState.refresh().catch(()=>toast.error("Não foi possível consultar o perfil agora."))} className="min-h-11 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">Tentar novamente</button>
        </div>}
      {!activeRoleState.loading&&!activeRoleState.roleLoadFailed&&<InteractiveBottomSheet value={urgentDropoff?"full":sheetSnap} onChange={snap=>setSheetSnap(urgentDropoff?"full":snap)} title={driverRole?"Painel do motorista CARONAA":"Planejar viagem CARONAA"}
        headerAction={!tripsPanelOpen&&driverRole&&!driverHomeOpen?<button type="button" onClick={showTrips} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#FFBB00]">Agendados</button>:undefined}>
        {tripsPanelOpen&&driverRole&&<DriverScheduledTripsPanel onClose={closeTrips} refreshKey={driverTripsRefreshKey}/>}
        {tripsPanelOpen&&!driverRole&&<UnifiedMyTripsPanel onClose={closeTrips} refreshKey={tripsRefreshKey} onShowOnMap={(trip:UnifiedTrip)=>{
          if(trip.operationalRideId!==passengerRide?.id){toast.info("O acompanhamento desta viagem no mapa ainda não está disponível.");return;}
          closeTrips();setSheetSnap("peek");
        }}/>}
        <div className={tripsPanelOpen?"hidden":"h-full min-h-0"}>
          {driverRole&&driverHomeOpen?<DriverHomeDashboard
            refreshKey={driverTripsRefreshKey}
            onOffer={()=>{setDriverHomeOpen(false);setServiceType("AGENDADA");setSheetSnap("half");}}
            onOpenTrips={showTrips}/>:
          driverRole&&serviceType==="FLASH"?<DriverFlashPlanner
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
              if(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(passengerPhase)){
                toast.info("Finalize ou cancele a corrida atual antes de mudar de modalidade.");setSheetSnap("full");return;
              }setServiceType(next);
            }}
            originPoint={originLocation} originLabel={origin} locating={locatingPickup}
            gpsError={location.failure?locationFailureMessages[location.failure]:
              originSource==="CURRENT_LOCATION"&&!validPoint(originLocation)&&
              location.addressPosition?.accuracy!=null&&location.addressPosition.accuracy>300
                ?"GPS aproximado (±"+Math.round(location.addressPosition?.accuracy??0)+
                  " m). Toque em escolher embarque no mapa ou ative a localização precisa.":undefined}
            onRetryGps={requestNewPickupLocation}
            originRevision={shellOriginRevision} originMunicipality={resolvedAddress?.city??""} gender={gender}
            onFlashVehicleChange={setQuickVehicle}
            flashRideActive={Boolean(passengerPhase&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(passengerPhase))}
            flashFare={flashFare} flashFares={flashFares} flashFarePending={flashFarePending}
            flashDriverCounts={quickDriverCounts} flashDriverErrors={quickDriverErrors} flashDriverLoading={quickDriverLoading} flashDriverError={quickDriverError}
            onFlashActionContainer={setFlashActionContainer}
            flashOperationalPanel={<QuickRideHomePanel
              origin={origin||"Minha localização atual"} destination={passengerDestinationLabel}
              originPoint={quotedOrigin} destinationPoint={shellDestinationLocation}
              locating={locatingPickup} vehicle={quickVehicle} onVehicleChange={setQuickVehicle}
              driverCount={quickDriverCounts[quickVehicle]} driverCounts={quickDriverCounts} driverLoading={quickDriverLoading}
              driverError={quickDriverErrors[quickVehicle]??quickDriverError}
              gpsOriginIsImprecise={originSource==="CURRENT_LOCATION"&&!previewablePickup}
              pickupNeedsConfirmation={pickupNeedsConfirmation} onConfirmPickup={openPickupDialog}
              actionContainer={flashActionContainer} onFaresChange={setFlashFares} onFarePendingChange={setFlashFarePending}
              onCoveragesChange={onQuickCoverages} onOperationalRideChange={onPassengerRide} onRidePhaseChange={onPassengerPhase}
              onDropoffPendingChange={onUrgentDropoff} onFareChange={setFlashFare}
              onOpenOperational={()=>setSheetSnap("full")} shellMode shellSnap={sheetSnap}/>}
            onAdjustOrigin={openPickupDialog} onRouteChange={handleShellRouteChange}
            onOnRouteMatchSelected={setSelectedOnRouteMatch} onDestinationChange={handleDestinationChange}
            onScheduled={()=>setTripsRefreshKey(value=>value+1)}/>}
        </div>
      </InteractiveBottomSheet>}
      {activeRoleState.loading&&<div role="status" className="pointer-events-none absolute inset-x-3 bottom-4 z-30 rounded-2xl border border-white/20 bg-[#121212] p-4 text-sm text-white">Abrindo sua área no CARONAA…</div>}
      <Dialog open={offerIntentOpen} onOpenChange={open=>{
        setOfferIntentOpen(open);
        if(!open&&activeRoleState.activeRole!=="MOTORISTA"){
          void navigate({to:"/home",search:{},replace:true});
        }
      }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-[#FFBB00]/30 bg-background p-5 text-foreground">
          <DialogTitle className="font-display text-xl font-extrabold">Oferecer uma carona</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Para publicar uma carona, entre no modo Motorista. Sua conta de passageiro continua disponível e você pode voltar quando quiser.
          </DialogDescription>
          <div className="grid gap-2 pt-2">
            <Button type="button" className="min-h-12 rounded-xl bg-[#FFBB00] font-bold text-[#121212]"
              disabled={activeRoleState.busy||activeRoleState.loading}
              onClick={async()=>{
                setOfferIntentOpen(false);
                try{
                  await handleShellRoleSwitch("MOTORISTA");
                }catch{
                  toast.error("Não foi possível ativar o modo motorista. Tente novamente.");
                }
              }}>
              Continuar como motorista
            </Button>
            <Button type="button" variant="outline" className="min-h-12 rounded-xl"
              onClick={()=>{setOfferIntentOpen(false);void navigate({to:"/home",search:{},replace:true});}}>
              Continuar como passageiro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={requestIntentOpen} onOpenChange={open=>{
        setRequestIntentOpen(open);
        if(!open&&activeRoleState.activeRole!=="PASSAGEIRO")
          void navigate({to:"/home",search:{},replace:true});
      }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-[#FFBB00]/30 bg-background p-5 text-foreground">
          <DialogTitle className="font-display text-xl font-extrabold">Pedir uma carona</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Alterne para Passageiro para buscar Flash Moto, Flash Carro e caronas compartilhadas. Sua conta de motorista permanecerá disponível.
          </DialogDescription>
          <div className="grid gap-2 pt-2">
            <Button type="button" className="min-h-12 rounded-xl bg-[#FFBB00] font-bold text-[#121212]"
              disabled={activeRoleState.busy||activeRoleState.loading}
              onClick={async()=>{
                setRequestIntentOpen(false);
                try { await handleShellRoleSwitch("PASSAGEIRO"); }
                catch { toast.error("Não foi possível mudar para passageiro. Tente novamente."); }
              }}>Continuar como passageiro</Button>
            <Button type="button" variant="outline" className="min-h-12 rounded-xl"
              onClick={()=>{setRequestIntentOpen(false);void navigate({to:"/home",search:{},replace:true});}}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
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
