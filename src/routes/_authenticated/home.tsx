import { StrictPickupPanel } from "@/components/caronaa/StrictPickupPanel";
import { RideIntentSwitch, type RideIntent } from "@/components/caronaa/RideIntentSwitch";
import { HomeOfferPanel, type HomeOfferPanelHandle, type HomeOfferPanelStatus } from "@/components/caronaa/HomeOfferPanel";
import { consumeRideIntentDraft, type RideIntentDraft } from "@/lib/ride-intent-draft";
import type { StrictPickupPreview } from "@/lib/safe-pickup";
import { QuickRideHomePanel } from "@/components/caronaa/QuickRideHomePanel";
import type { QuickRideCoverage } from "@/lib/quick-rides/quick-ride.functions";
import { getF07TestSelfRadar } from "@/lib/quick-rides/f07-radar-diagnostic.functions";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import {
  PassengerRideOptions,
  type PassengerRideOption,
} from "@/components/caronaa/PassengerRideOptions";
import { useProfileGender } from "@/lib/use-profile-gender";
import {
  TimeToleranceSelector,
  type TimeToleranceMinutes,
} from "@/components/caronaa/TimeToleranceSelector";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowRight, LocateFixed, CalendarDays, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/caronaa/AppShell";
import { FavoriteCommuteSuggestion } from "@/components/onboarding/FavoriteCommuteSuggestion";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { getActiveHomeJourneys } from "@/lib/home.functions";
import { createRideRequest } from "@/lib/ride-matching.functions";
import type { FormLocationDetails } from "@/lib/location/types";
import { HomeRideMap, type ApproximateProfessionalDriver } from "@/components/caronaa/HomeRideMap";
import { RequestFarePreview, type FarePreview } from "@/components/caronaa/RequestFarePreview";
import { calculateRequestedGroupFare, formatBrl } from "@/lib/ride-cost";
import { useUserLocation } from "@/lib/location/use-user-location";
import { isTrustedGpsFix } from "@/lib/location/gps-trust";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: z.object({ intent: z.enum(["offer"]).optional() }),
  // Parent route already verifies login and applies institution waiting gates.
  // Resolve role before any passenger/driver dashboard renders.
  beforeLoad: async () => {
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
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [intent, setIntent] = useState<RideIntent>(search.intent === "offer" ? "OFFER" : "REQUEST");
  useEffect(() => { setIntent(search.intent === "offer" ? "OFFER" : "REQUEST"); }, [search.intent]);
  const loadJourneys = useServerFn(getActiveHomeJourneys);
  const requestRide = useServerFn(createRideRequest);
  const reverseGeocode = useServerFn(reverseGeocodeServerFn);
  const location = useUserLocation({ autoLocate: true });
  const manualOriginChosen = useRef(false);
  const mapOriginRequest = useRef(0);
  const offerDraftRef = useRef<RideIntentDraft["offer"]>(undefined);
  const offerPanelRef = useRef<HomeOfferPanelHandle>(null);
  const [offerStatus, setOfferStatus] = useState<HomeOfferPanelStatus>({
    step: "DETAILS", busy: false, canContinue: false, driverAllowed: null, routine: false,
  });
  const updateOfferDraft = useCallback((draft: NonNullable<RideIntentDraft["offer"]>) => {
    offerDraftRef.current = draft;
  }, []);
  const updateOfferStatus = useCallback((status: HomeOfferPanelStatus) => {
    setOfferStatus(status);
  }, []);
  const [originSource, setOriginSource] = useState<"CURRENT_LOCATION" | "MANUAL_ORIGIN">(
    "CURRENT_LOCATION",
  );
  const [resolvedAddress, setResolvedAddress] = useState<FormLocationDetails | null>(null);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [journeys, setJourneys] = useState<Awaited<ReturnType<typeof loadJourneys>>>([]);
  const [error, setError] = useState<string | null>(null);
  const getSelfRadar = useServerFn(getF07TestSelfRadar);
  const [professionalMunicipality, setProfessionalMunicipality] = useState("");
  const [quickVehicle, setQuickVehicle] = useState<"CAR" | "MOTO">("CAR");
  const [rideOption, setRideOption] = useState<PassengerRideOption>("CAR");
  const [professionalDrivers, setProfessionalDrivers] = useState<ApproximateProfessionalDriver[]>(
    [],
  );
  const [professionalError, setProfessionalError] = useState("");
  const [professionalLoading, setProfessionalLoading] = useState(false);
  // Never infer an active dispatch city from the user's registration.
  // The quick ride server validates the selected departure with Google Geocoding.
  const updateQuickCoverage = useCallback((coverage: QuickRideCoverage | null) => {
    setProfessionalMunicipality(
      coverage?.radar === true && coverage.municipality
        ? coverage.municipality : "",
    );
  }, []);
  useEffect(() => {
    const municipality = professionalMunicipality.trim();
    if (municipality.length < 2 || intent !== "REQUEST" || rideOption !== "EXCLUSIVE") {
      setProfessionalDrivers([]);
      setProfessionalError("");
      setProfessionalLoading(false);
      return;
    }
    let alive = true;
    const refresh = async () => {
      if (alive) setProfessionalLoading(true);
      const [{ data, error }, self] = await Promise.all([
        (supabase as any).rpc(
          "discover_caronaa_quick_drivers",
          { p_municipality: municipality, p_vehicle: quickVehicle },
        ),
        getSelfRadar({data:{municipality,vehicleType:quickVehicle}})
          .catch(():ApproximateProfessionalDriver[]=>[]),
      ]);
      if (!alive) return;
      if (error) {
        setProfessionalDrivers([]);
        setProfessionalError("Mapa profissional indisponível nesta região.");
      } else {
        const combined:ApproximateProfessionalDriver[]=[...(data??[]),...self]
          .filter((d:ApproximateProfessionalDriver)=>Number.isFinite(d.lat)&&Number.isFinite(d.lng));
        setProfessionalDrivers(combined.filter((driver,index)=>
          index===combined.findIndex(other=>other.driver_key===driver.driver_key)
        ));
        setProfessionalError("");
      }
      setProfessionalLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [professionalMunicipality, intent, rideOption, quickVehicle]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectingOrigin, setSelectingOrigin] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originLocation, setOriginLocation] = useState<FormLocationDetails>();
  const [destinationLocation, setDestinationLocation] = useState<FormLocationDetails>();
  const [date, setDate] = useState("");
  const [timeTolerance, setTimeTolerance] = useState<TimeToleranceMinutes>(15);
  const [time, setTime] = useState("");
  const [count, setCount] = useState("1");
  const [confirmedReviewKey, setConfirmedReviewKey] = useState<string | null>(null);
  const [requestFare, setRequestFare] = useState<
    (FarePreview & { origin: string; destination: string; routeKey: string }) | null
  >(null);
  const [requestFareRefresh, setRequestFareRefresh] = useState(0);
  // Restore only a one-time, tab-local role switch. No GPS is passed through
  // public URLs or reused from an unrelated past journey.
  useEffect(() => {
    const draft = consumeRideIntentDraft();
    if (!draft) return;
    offerDraftRef.current = draft.offer;
    mapOriginRequest.current += 1;
    manualOriginChosen.current = Boolean(draft.origin);
    setSelectingOrigin(false);
    setOriginSource(draft.origin ? "MANUAL_ORIGIN" : "CURRENT_LOCATION");
    setOrigin(draft.origin);
    setDestination(draft.destination);
    setOriginLocation(draft.originLocation);
    setDestinationLocation(draft.destinationLocation);
    if (draft.date) setDate(draft.date);
    if (draft.time) setTime(draft.time);
    if (draft.tolerance) setTimeTolerance(draft.tolerance);
    if (draft.passengerMode) setRideOption(draft.passengerMode);
    if (draft.offerVehicle) setQuickVehicle(draft.offerVehicle);
    setPanelOpen(true);
  }, []);

  const fareRouteKey = JSON.stringify([
    origin,
    destination,
    originLocation?.lat,
    originLocation?.lng,
    destinationLocation?.lat,
    destinationLocation?.lng,
  ]);
  const receiveRequestFare = useCallback(
    (quote: FarePreview | null) => {
      setRequestFare(quote ? { ...quote, origin, destination, routeKey: fareRouteKey } : null);
    },
    [origin, destination, fareRouteKey],
  );
  const [busy, setBusy] = useState(false);
  const requestSubmitting = useRef(false);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const refresh = useCallback(() => {
    void loadJourneys()
      .then(setJourneys)
      .catch((reason) =>
        setError("Não foi possível carregar seu trajeto. Você pode continuar criando uma carona."),
      );
  }, [loadJourneys]);
  useEffect(refresh, [refresh]);
  const active = journeys[0];
  const pickupRide = journeys.find(
    (journey) =>
      journey.kind === "ride" &&
      "role" in journey &&
      journey.role === "passenger" &&
      ["MATCHED", "CONFIRMED"].includes(journey.status),
  );
  const pickupRideId = pickupRide?.id;
  const hasPendingRequest = journeys.some(
    (journey) =>
      (journey.kind === "request" && journey.status === "open") ||
      (journey.kind === "ride" && ["MATCHED", "CONFIRMED"].includes(journey.status)),
  );
  useEffect(() => {
    if (!hasPendingRequest) return;
    const check = () => {
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [hasPendingRequest, refresh]);
  useEffect(() => {
    if (pickupRideId) setPanelOpen(true);
  }, [pickupRideId]);
  const [pickupPreview, setPickupPreview] = useState<{
    rideId: string;
    value: StrictPickupPreview;
  } | null>(null);
  const receivePickupPreview = useCallback(
    (value: StrictPickupPreview | null) => {
      setPickupPreview(value && pickupRideId ? { rideId: pickupRideId, value } : null);
    },
    [pickupRideId],
  );
  const activeIsCurrent = Boolean(
    active &&
    active.status !== "CANCELLED" &&
    active.status !== "COMPLETED" &&
    (active.status === "IN_PROGRESS" ||
      new Date(`${active.ride_date}T${active.departure_time.slice(0, 8)}-03:00`).getTime() >
        Date.now()),
  );
  // Never render a past ride's origin as the member's current position.
  const point = originLocation;
  const gpsOriginIsImprecise = originSource === "CURRENT_LOCATION" &&
    Boolean(location.addressPosition && !isTrustedGpsFix(location.addressPosition));
  useEffect(() => {
    if (location.failure && originSource === "CURRENT_LOCATION") {
      setOriginSource("MANUAL_ORIGIN");
      if (!location.addressPosition) {
        setOrigin("");
        setOriginLocation(undefined);
      }
    }
  }, [location.failure, location.addressPosition, originSource]);
  useEffect(() => {
    if (location.addressPosition && !manualOriginChosen.current && !location.failure)
      setOriginSource("CURRENT_LOCATION");
  }, [location.addressPosition, location.failure]);
  // Display coordinates are always fresh; address lookup is not tied to every GPS pulse.
  const reverseLookupRef = useRef<{lat:number;lng:number;at:number}|null>(null);
  const reverseLookupSequence = useRef(0);
  useEffect(() => {
    if (!location.addressPosition || originSource !== "CURRENT_LOCATION" || location.locating) return;
    if (!isTrustedGpsFix(location.addressPosition)) {
      setResolvedAddress(null);
      setReverseFailed(false);
      return;
    }
    const {lat,lng}=location.addressPosition;
    const previous=reverseLookupRef.current;
    // Rough local distance in meters. Do not pay for a new label on GPS jitter.
    const distance=previous ? 111_195*Math.hypot(
      lat-previous.lat,
      (lng-previous.lng)*Math.cos(lat*Math.PI/180),
    ):Infinity;
    if(previous && distance<75 && Date.now()-previous.at<120_000)return;
    reverseLookupRef.current={lat,lng,at:Date.now()};
    const sequence=++reverseLookupSequence.current;
    setReverseFailed(false);
    void sessionRequest("home-reverse:"+lat.toFixed(3)+":"+lng.toFixed(3),()=>reverseGeocode({
      data:{lat,lng},
    }),120_000)
      .then(value=>{
        if(sequence!==reverseLookupSequence.current)return;
        setResolvedAddress(value);
        setReverseFailed(!value);
      })
      .catch(()=>{
        if(sequence!==reverseLookupSequence.current)return;
        // Failed lookups are not retained in the session cache.
        reverseLookupRef.current=null;
        setReverseFailed(true);
      });
  }, [location.addressPosition, reverseGeocode, originSource, location.locating]);
  useEffect(() => {
    if (originSource !== "CURRENT_LOCATION" || !location.addressPosition) return;
    if (location.locating || !isTrustedGpsFix(location.addressPosition)) {
      // An estimate off by ~1 km must never generate a ride pickup or quote.
      setOrigin("");
      setOriginLocation(undefined);
      return;
    }
    const { lat, lng } = location.addressPosition;
    const addressStillNear =
      resolvedAddress?.lat != null &&
      resolvedAddress.lng != null &&
      Math.abs(resolvedAddress.lat - lat) < 0.0003 &&
      Math.abs(resolvedAddress.lng - lng) < 0.0003;
    const label = addressStillNear
      ? resolvedAddress.formattedAddress || "Minha localização atual"
      : "Minha localização atual";
    setOrigin(label);
    setOriginLocation({
      rawText: label,
      formattedAddress: label,
      lat,
      lng,
      isApproximate: location.addressPosition.accuracy > 100,
    });
  }, [originSource, location.addressPosition, resolvedAddress, location.locating]);
  function setToday() {
    const now = new Date();
    setDate(
      [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-"),
    );
  }

  function adjustPassengerCount(delta: number) {
    setCount((value) => String(Math.max(1, Math.min(3, Number(value) + delta))));
  }

  const gender = useProfileGender();
  const [womenOnly, setWomenOnly] = useState(false);
  useEffect(() => {
    if (gender !== "FEMININO") setWomenOnly(false);
  }, [gender]);
  const currentFare = requestFare?.routeKey === fareRouteKey ? requestFare : null;
  const reviewKey = JSON.stringify([
    currentFare?.quoteId,
    origin,
    destination,
    date,
    time,
    Number(count),
    timeTolerance,
    rideOption,
    gender === "FEMININO" && womenOnly,
    preferences,
  ]);
  const reviewed = confirmedReviewKey === reviewKey;
  const focusOriginOnExpand = useRef(false);
  const avoidKeyboardOnRoleSwitch = useRef(false);
  function expandDestination() {
    focusOriginOnExpand.current = false;
    setPanelOpen(true);
    document.getElementById("home-destination")?.focus();
  }
  function expandOrigin() {
    focusOriginOnExpand.current = true;
    setPanelOpen(true);
    document.getElementById("home-origin")?.focus();
  }
  useEffect(() => {
    if (!panelOpen) return;
    if (avoidKeyboardOnRoleSwitch.current) {
      avoidKeyboardOnRoleSwitch.current = false;
      return;
    }
    document.getElementById(focusOriginOnExpand.current ? "home-origin" : "home-destination")?.focus();
    focusOriginOnExpand.current = false;
  }, [panelOpen]);

  const chooseOriginOnMap = useCallback((point: { lat: number; lng: number }) => {
    const request = ++mapOriginRequest.current;
    const fallback = "Ponto selecionado no mapa";
    manualOriginChosen.current = true;
    setOriginSource("MANUAL_ORIGIN");
    setOrigin(fallback);
    setOriginLocation({ rawText: fallback, formattedAddress: fallback, lat: point.lat, lng: point.lng });
    setSelectingOrigin(false);
    focusOriginOnExpand.current = false;
    setPanelOpen(true);
    // Reverse geocoding improves the label, but MUST NOT replace clicked coordinates.
    void reverseGeocode({ data: point }).then((details) => {
      if (request !== mapOriginRequest.current || !details) return;
      const label = details.formattedAddress || fallback;
      setOrigin(label);
      setOriginLocation({ ...details, rawText: label, formattedAddress: label, lat: point.lat, lng: point.lng });
    }).catch(() => { /* Clicked coordinates remain valid even if the address fails. */ });
  }, [reverseGeocode]);
  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    // Enter in a quick-ride field must never submit a scheduled/shared ride.
    if (intent === "OFFER" || rideOption === "EXCLUSIVE") return;
    if (!origin.trim() || !destination.trim()) {
      setError("Informe origem e destino antes de continuar.");
      return;
    }
    if (!currentFare) {
      setError("Aguarde a cotação atual do seu trecho antes de pedir a carona.");
      return;
    }
    if (!reviewed) {
      setConfirmedReviewKey(reviewKey);
      setError(null);
      return;
    }
    if (requestSubmitting.current) return;
    requestSubmitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await requestRide({
        data: {
          quoteId: currentFare.quoteId,
          rideDate: date,
          departureTime: time,
          passengerCount: rideOption === "MOTO" ? 1 : Number(count),
          timeToleranceMinutes: timeTolerance,
          preferences,
          vehicleType: rideOption === "MOTO" ? "MOTO" : "CAR",
          womenOnly: gender === "FEMININO" && womenOnly,
        },
      });
      toast.success("Sua solicitação foi publicada.");
      setConfirmedReviewKey(null);
      setRequestFare(null);
      setRequestFareRefresh((value) => value + 1);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível pedir a carona. Confira os dados e tente novamente.",
      );
      if (reason instanceof Error && /cotação.*expir|quote.*expired/i.test(reason.message)) {
        setRequestFare(null);
        setRequestFareRefresh((value) => value + 1);
      }
    } finally {
      requestSubmitting.current = false;
      setBusy(false);
    }
  }
  function switchIntent(next: RideIntent) {
    if (next === intent) return;
    setIntent(next);
    if (next === "OFFER") setOfferStatus({
      step: "DETAILS", busy: false, canContinue: false, driverAllowed: null, routine: false,
    });
    if (!panelOpen) avoidKeyboardOnRoleSwitch.current = true;
    setPanelOpen(true);
    setSelectingOrigin(false);
    setConfirmedReviewKey(null);
    setRequestFare(null);
    setRequestFareRefresh((v) => v + 1);
    // Same route and same mounted Google Map. Only the sheet flow changes;
    // the query contains a role flag, never the passenger's coordinates.
    void navigate({
      to: "/home",
      search: { intent: next === "OFFER" ? "offer" : undefined },
      replace: true,
    });
  }
  return (
    <AppShell mapLayout>
      <div className="relative isolate h-full min-h-0 min-w-0 overflow-hidden bg-[#121212] font-[family-name:var(--font-sans)] text-white">
        <div className="absolute inset-0">
          <HomeRideMap
            immersive
            pickupPreview={
              intent === "REQUEST" && rideOption === "CAR" && pickupPreview && pickupPreview.rideId === pickupRideId
                ? pickupPreview.value
                : null
            }
            professionalDrivers={intent === "REQUEST" && rideOption === "EXCLUSIVE" ? professionalDrivers : []}
            userPosition={location.position}
            origin={point ?? currentFare?.originPoint}
            selectingOrigin={selectingOrigin}
            onPickOrigin={chooseOriginOnMap}
            destination={destinationLocation ?? currentFare?.destinationPoint}
            originIsCurrent={originSource === "CURRENT_LOCATION"}
            originAccuracyM={location.originAccuracyM}
            following={originSource === "CURRENT_LOCATION" && isTrustedGpsFix(location.position) && location.isFollowingUser}
            recenterVersion={location.recenterVersion}
            locating={location.locating}
            onDrag={() => location.setFollowing(false)}
            onRecenter={location.locate}
          />
        </div>
        {selectingOrigin && (
          <div role="status" className="absolute inset-x-3 top-3 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-[#FFBB00]/50 bg-[#121212]/95 p-3 text-sm text-white shadow-xl backdrop-blur-xl sm:inset-x-5">
            <p><strong className="text-[#FFBB00]">Definir saída:</strong> toque no local correto do mapa. Esse ponto será sua origem escolhida.</p>
            <button type="button" className="min-h-10 shrink-0 rounded-lg border border-white/30 px-3 font-semibold" onClick={() => setSelectingOrigin(false)}>
              Cancelar
            </button>
          </div>
        )}
        <section
          aria-labelledby="journey-title"
          className={`absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#121212]/95 shadow-2xl backdrop-blur-2xl transition-[height] sm:bottom-4 sm:rounded-3xl ${panelOpen ? "h-[min(84dvh,calc(100%_-_5rem))] min-h-0" : "h-auto max-h-[min(44dvh,20rem)]"}`}
        >
          <button
            type="button"
            aria-controls="caronaa-journey-details"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
            className="flex min-h-11 shrink-0 flex-col items-center justify-center gap-1 rounded-t-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
          >
            <span className="h-1 w-10 rounded-full bg-white/30" aria-hidden="true" />
            <span className="text-[10px] text-gray-300">
              {panelOpen ? "Recolher detalhes" : "Expandir e planejar viagem"}
            </span>
          </button>
          <div className="shrink-0 px-3 pb-2 sm:px-4">
            <RideIntentSwitch value={intent} onChange={switchIntent}
              disabled={intent === "OFFER" && offerStatus.busy} />
          </div>
          <h2
            id="journey-title"
            className="shrink-0 px-4 font-[family-name:var(--font-display)] text-xl font-bold"
          >
            {intent === "OFFER" ? "Ofereça sua carona" : "Encontre sua carona"}
          </h2>
          {!panelOpen ? (
            <div className="min-w-0 space-y-3 overflow-y-auto overscroll-contain p-4">
              <button
                type="button"
                aria-label="Pesquisar destino no painel de carona"
                onClick={expandDestination}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 text-left font-semibold"
              >
                <span className="truncate">{destination || (intent === "OFFER" ? "Para onde vai oferecer carona?" : "Para onde você vai?")}</span>
                <Search size={22} className="shrink-0 text-[#FFBB00]" aria-hidden="true" />
              </button>
              {gpsOriginIsImprecise && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-xs text-white">
                  <p>
                    GPS impreciso (±{Math.round(location.addressPosition!.accuracy)} m).
                    Não usamos essa posição como sua saída até você ajustar o ponto.
                  </p>
                  <button type="button" onClick={expandOrigin} className="min-h-10 font-bold text-[#FFBB00] underline underline-offset-4">
                    Corrigir saída
                  </button>
                </div>
              )}
              {active && (
                <Link
                  to="/minhas-caronas"
                  className="flex min-h-11 items-center gap-2 text-sm text-[#FFBB00]"
                >
                  {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
                  <ArrowRight size={16} />
                </Link>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div
              id="caronaa-journey-details"
              className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 [scrollbar-gutter:stable]"
            >
              <details className="mt-2 min-w-0" data-testid="favorite-commutes-details">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
                  <span>Seus caminhos salvos</span>
                  <span className="text-xs font-normal text-gray-300">Ver atalhos</span>
                </summary>
                <div className="pt-2">
                  <FavoriteCommuteSuggestion
                    onChoose={(from, to) => {
                  mapOriginRequest.current += 1;
                  setSelectingOrigin(false);
                  manualOriginChosen.current = true;
                  setOriginSource("MANUAL_ORIGIN");
                  setOrigin(from.label);
                  setDestination(to.label);
                  setOriginLocation({ rawText: from.label, lat: from.lat, lng: from.lng });
                  setDestinationLocation({ rawText: to.label, lat: to.lat, lng: to.lng });
                    }}
                  />
                </div>
              </details>
              <form id="passenger-request-form" onSubmit={submitRequest} className="min-w-0 w-full max-w-full space-y-4 pt-3">
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <button
                    type="button"
                    disabled={location.locating}
                    onClick={() => {
                      mapOriginRequest.current += 1;
                      setSelectingOrigin(false);
                      manualOriginChosen.current = false;
                      setOriginSource("CURRENT_LOCATION");
                      setOrigin("");
                      setOriginLocation(undefined);
                      location.locate();
                    }}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#FFBB00]"
                  >
                    <LocateFixed size={18} />
                    {location.locating ? "Localizando…" : "Usar minha localização atual"}
                  </button>
                  {location.failure && !origin && (
                    <p role="status" className="text-xs text-gray-300">
                      Digite sua saída abaixo para continuar. Você também pode tentar usar sua
                      localização novamente.
                    </p>
                  )}
                  {reverseFailed && (
                    <p role="status" className="text-xs text-gray-300">
                      Não conseguimos identificar o endereço. Você pode ajustar a saída.
                    </p>
                  )}
                  {gpsOriginIsImprecise && (
                    <p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-2 text-xs text-white">
                      O GPS está com precisão de aproximadamente {Math.round(location.addressPosition!.accuracy)} metros. Informe sua saída abaixo ou selecione o ponto no mapa antes de solicitar carona.
                    </p>
                  )}
                  <button type="button" onClick={() => {
                    setSelectingOrigin(true);
                    setPanelOpen(false);
                  }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 px-3 text-xs font-semibold text-[#FFBB00]">
                    <LocateFixed size={16} /> Escolher saída tocando no mapa
                  </button>
                  {originSource === "MANUAL_ORIGIN" && originLocation?.lat != null && (
                    <p role="status" className="text-xs text-gray-300">
                      “Você” no mapa indica a sua saída escolhida manualmente, não uma posição GPS confirmada.
                    </p>
                  )}
                  <LocationAutocomplete
                    id="home-origin"
                    label="Saída"
                    value={origin}
                    variant="glass"
                    required
                    placeholder="De onde você sai?"
                    onChange={(value, details) => {
                      mapOriginRequest.current += 1;
                      setSelectingOrigin(false);
                      manualOriginChosen.current = true;
                      setOriginSource("MANUAL_ORIGIN");
                      setOrigin(details?.formattedAddress || value);
                      setOriginLocation(details);
                    }}
                  />
                  <LocationAutocomplete
                    id="home-destination"
                    label="Destino"
                    value={destination}
                    variant="glass"
                    required
                    placeholder="Para onde vamos?"
                    onChange={(value, details) => {
                      setDestination(details?.formattedAddress || value);
                      setDestinationLocation(details);
                    }}
                  />
                </div>
                {intent === "REQUEST" && (
                <div id="caronaa-ride-mode" className="min-w-0 w-full max-w-full">
                  <PassengerRideOptions
                  value={rideOption}
                  estimate={currentFare?.pricePerPassenger ?? null}
                  onChange={(value) => {
                    if (value === "EXCLUSIVE") {
                      // Stay on the same map; vehicle selection is inside the
                      // quick-ride panel, and driver radar is filtered accordingly.
                      setQuickVehicle(rideOption === "MOTO" ? "MOTO" : "CAR");
                    }
                    setRideOption(value);
                    setConfirmedReviewKey(null);
                    if (value === "MOTO") setCount("1");
                  }}
                />
                </div>
                )}
                {intent === "REQUEST" && rideOption === "EXCLUSIVE" && (
                  <QuickRideHomePanel
                    origin={origin}
                    destination={destination}
                    originPoint={originLocation}
                    destinationPoint={destinationLocation}
                    vehicle={quickVehicle}
                    onVehicleChange={setQuickVehicle}
                    driverCount={professionalDrivers.filter(driver=>!driver.is_self).length}
                    driverLoading={professionalLoading}
                    driverError={professionalError}
                    gpsOriginIsImprecise={gpsOriginIsImprecise}
                    onCoverage={updateQuickCoverage}
                  />
                )}
                {intent === "REQUEST" && rideOption !== "EXCLUSIVE" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="min-w-0 text-sm font-semibold">
                        Data
                        <input
                          aria-label="Data da viagem"
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/5 px-2 text-sm [color-scheme:dark]"
                        />
                      </label>
                      <label className="min-w-0 text-sm font-semibold">
                        Horário
                        <input
                          aria-label="Horário de saída"
                          type="time"
                          required
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/5 px-2 text-sm [color-scheme:dark]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={setToday}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm"
                    >
                      <CalendarDays size={16} />
                      Hoje
                    </button>
                    <TimeToleranceSelector
                      value={timeTolerance}
                      onChange={setTimeTolerance}
                      baseTime={time}
                      label="Flexibilidade de horário"
                    />
                    {rideOption === "CAR" && (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>Passageiros neste pedido</span>
                        <div className="flex items-center gap-3 rounded-full border border-white/15 p-1">
                          <button
                            type="button"
                            aria-label="Diminuir passageiros"
                            disabled={Number(count) <= 1}
                            onClick={() => adjustPassengerCount(-1)}
                            className="flex size-11 items-center justify-center disabled:opacity-40"
                          >
                            <Minus size={16} />
                          </button>
                          <span>{count}</span>
                          <button
                            type="button"
                            aria-label="Aumentar passageiros"
                            disabled={Number(count) >= 3}
                            onClick={() =>
                              setCount((value) => String(Math.min(3, Number(value) + 1)))
                            }
                            className="flex size-11 items-center justify-center disabled:opacity-40"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="[&_section]:rounded-2xl [&_section]:border-white/10 [&_section]:bg-white/5 [&_p]:text-gray-300 [&_p.text-lg]:text-[#FFBB00]">
                      <RequestFarePreview
                        origin={origin}
                        destination={destination}
                        passengerCount={rideOption === "MOTO" ? 1 : Number(count)}
                        originLocation={originLocation}
                        destinationLocation={destinationLocation}
                        onQuote={receiveRequestFare}
                        refreshKey={requestFareRefresh}
                      />
                    </div>
                    {rideOption === "CAR" && pickupRideId && (
                      <StrictPickupPanel
                        rideId={pickupRideId}
                        autoSuggest
                        showMap={false}
                        onPreviewChange={receivePickupPreview}
                      />
                    )}
                    <WomenOnlyToggle
                      gender={gender}
                      kind="request"
                      checked={womenOnly}
                      onChange={setWomenOnly}
                    />
                    <details className="rounded-2xl border border-white/10 p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Preferências (opcional)
                      </summary>
                      <JourneyPreferences kind="request" onChange={setPreferences} />
                    </details>
                    {reviewed && currentFare && (
                      <div
                        role="status"
                        aria-label="Revisão obrigatória da quantidade"
                        className="rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-4 text-sm"
                      >
                        <p className="font-bold">Revise antes de enviar</p>
                        <p className="mt-2">
                          Você está solicitando{" "}
                          <strong>
                            {count} {Number(count) === 1 ? "vaga" : "vagas"}
                          </strong>
                          .
                        </p>
                        <p>
                          {formatBrl(currentFare.pricePerPassenger)} por passageiro ·{" "}
                          <strong>
                            {formatBrl(
                              calculateRequestedGroupFare(
                                currentFare.pricePerPassenger,
                                Number(count),
                              ),
                            )}{" "}
                            no total
                          </strong>
                        </p>
                        <p className="mt-2 text-xs">
                          Confira a quantidade e pressione novamente para confirmar.
                        </p>
                        <button
                          type="button"
                          className="min-h-11 text-[#FFBB00] underline"
                          onClick={() => setConfirmedReviewKey(null)}
                        >
                          Corrigir quantidade
                        </button>
                      </div>
                    )}
                    {error && (
                      <p role="alert" className="text-sm text-red-300">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </form>
                {intent === "OFFER" && (
                  <HomeOfferPanel
                    ref={offerPanelRef}
                    origin={origin}
                    destination={destination}
                    originLocation={originLocation}
                    destinationLocation={destinationLocation}
                    date={date}
                    time={time}
                    tolerance={timeTolerance}
                    onDateChange={setDate}
                    onTimeChange={setTime}
                    onToleranceChange={setTimeTolerance}
                    initialDraft={offerDraftRef.current}
                    initialVehicle={rideOption === "MOTO" ? "MOTO" : quickVehicle}
                    onDraftChange={updateOfferDraft}
                    onStatusChange={updateOfferStatus}
                    onPublished={refresh}
                  />
                )}
              {active && (
                <Link
                  to="/minhas-caronas"
                  className="mt-4 flex min-h-11 items-center gap-2 text-sm text-[#FFBB00]"
                >
                  {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
          {panelOpen && intent === "OFFER" && (
            <div className="shrink-0 border-t border-white/10 bg-[#121212] p-3 sm:rounded-b-3xl">
              <Button type="button"
                onClick={() => offerPanelRef.current?.next()}
                disabled={offerStatus.busy || (offerStatus.step !== "SUCCESS" && (!offerStatus.canContinue || offerStatus.routine))}
                className="h-14 w-full rounded-2xl bg-[#FFBB00] text-base font-bold text-[#121212] hover:bg-[#ffd04d]">
                {offerStatus.busy ? "Publicando…" :
                  offerStatus.step === "SUCCESS" ? "Oferecer outra carona" :
                  offerStatus.step === "REVIEW" ? "Publicar oferta" : "Revisar oferta"}
                <ArrowRight size={18}/>
              </Button>
            </div>
          )}
          {panelOpen && intent === "REQUEST" && rideOption !== "EXCLUSIVE" && (
            <div className="shrink-0 border-t border-white/10 bg-[#121212] p-3 sm:rounded-b-3xl">
              <Button
                type="submit"
                form="passenger-request-form"
                disabled={busy || !currentFare || gpsOriginIsImprecise}
                className="h-14 w-full rounded-2xl bg-[#FFBB00] text-base font-bold text-[#121212] hover:bg-[#ffd04d]"
              >
                {busy ? "Buscando motoristas…" : "Confirmar Carona"}
                <ArrowRight size={18} />
              </Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
