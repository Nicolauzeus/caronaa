import {
  TimeToleranceSelector,
  type TimeToleranceMinutes,
} from "@/components/caronaa/TimeToleranceSelector";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  LocateFixed,
  MapPin,
  CarFront,
  UserRound,
  CalendarDays,
  Mic,
  Pencil,
  Minus,
  Plus,
  Navigation2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/caronaa/AppShell";
import { FavoriteCommuteSuggestion } from "@/components/onboarding/FavoriteCommuteSuggestion";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { getActiveHomeJourneys, getRecentHomeDestinations } from "@/lib/home.functions";
import { createRideRequest } from "@/lib/ride-matching.functions";
import type { FormLocationDetails } from "@/lib/location/types";
import { HomeRideMap, type ApproximateProfessionalDriver } from "@/components/caronaa/HomeRideMap";
import { RequestFarePreview, type FarePreview } from "@/components/caronaa/RequestFarePreview";
import { calculateRequestedGroupFare, formatBrl } from "@/lib/ride-cost";
import { useUserLocation, locationFailureMessages } from "@/lib/location/use-user-location";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";

export const Route = createFileRoute("/_authenticated/home")({
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
      { name: "description", content: "Peça ou ofereça uma carona pelo seu trajeto." },
      { property: "og:title", content: "Início — CARONAA" },
      { property: "og:description", content: "Peça ou ofereça uma carona pelo seu trajeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const loadJourneys = useServerFn(getActiveHomeJourneys);
  const loadRecent = useServerFn(getRecentHomeDestinations);
  const requestRide = useServerFn(createRideRequest);
  const reverseGeocode = useServerFn(reverseGeocodeServerFn);
  const location = useUserLocation();
  const [originSource, setOriginSource] = useState<"CURRENT_LOCATION" | "MANUAL_ORIGIN">(
    "CURRENT_LOCATION",
  );
  const [resolvedAddress, setResolvedAddress] = useState<FormLocationDetails | null>(null);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [journeys, setJourneys] = useState<Awaited<ReturnType<typeof loadJourneys>>>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof loadRecent>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [professionalMunicipality,setProfessionalMunicipality] = useState("");
  const [professionalDrivers,setProfessionalDrivers] = useState<ApproximateProfessionalDriver[]>([]);
  const [professionalError,setProfessionalError] = useState("");
  const [professionalLoading,setProfessionalLoading] = useState(false);
  const professionalMunicipalityEdited = useRef(false);
  // Consult the radar automatically, using the member's registered municipality.
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("city").eq("id", user.id).maybeSingle();
      const city = typeof data?.city === "string" ? data.city.trim() : "";
      if (active && !professionalMunicipalityEdited.current && city.length >= 2) {
        setProfessionalMunicipality(current => current || city);
      }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const municipality=professionalMunicipality.trim();
    if(municipality.length<2){setProfessionalDrivers([]);setProfessionalError("");return;}
    let alive=true;
    const refresh=async()=>{
      if(alive)setProfessionalLoading(true);
      const {data,error}=await (supabase as any).rpc("discover_approximate_professional_drivers",{p_municipality:municipality});
      if(!alive)return;
      if(error){setProfessionalDrivers([]);setProfessionalError("Mapa profissional indisponível nesta região.");}
      else {setProfessionalDrivers((data??[]).filter((d:ApproximateProfessionalDriver)=>Number.isFinite(d.lat)&&Number.isFinite(d.lng)));setProfessionalError("");}
      setProfessionalLoading(false);
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[professionalMunicipality]);

  const [role, setRole] = useState<"request" | "offer">("request");
  const [panelOpen, setPanelOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originLocation, setOriginLocation] = useState<FormLocationDetails>();
  const [destinationLocation, setDestinationLocation] = useState<FormLocationDetails>();
  const [date, setDate] = useState("");
  const [timeTolerance, setTimeTolerance] = useState<TimeToleranceMinutes>(15);
  const [time, setTime] = useState("");
  const [count, setCount] = useState("1");
  const [offerSeats, setOfferSeats] = useState("2");
  const [driverVehicle, setDriverVehicle] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [driverBlocked, setDriverBlocked] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      const [profile, fees] = await Promise.all([
        supabase.from("profiles").select("vehicle_brand,vehicle_description,vehicle_plate")
          .eq("id",auth.user.id).maybeSingle(),
        (supabase as any).rpc("get_my_driver_platform_fees"),
      ]);
      if (!active) return;
      setDriverVehicle([profile.data?.vehicle_brand,profile.data?.vehicle_description].filter(Boolean).join(" · "));
      setDriverPlate(profile.data?.vehicle_plate || "");
      if (!fees.error) setDriverBlocked(fees.data?.driverAllowed === false);
    });
    return () => { active = false; };
  }, []);
  const [confirmedReviewKey, setConfirmedReviewKey] = useState<string | null>(null);
  const [requestFare, setRequestFare] = useState<
    (FarePreview & { origin: string; destination: string }) | null
  >(null);
  const [requestFareRefresh, setRequestFareRefresh] = useState(0);
  const receiveRequestFare = useCallback(
    (quote: FarePreview | null) => {
      setRequestFare(quote ? { ...quote, origin, destination } : null);
    },
    [origin, destination],
  );
  const [busy, setBusy] = useState(false);
  const [originEditing, setOriginEditing] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  } | null>(null);
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
  useEffect(() => {
    let alive = true;
    void loadRecent()
      .then((value) => {
        if (alive) setRecent(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadRecent]);
  const active = journeys[0];
  const activeIsCurrent = Boolean(
    active &&
    active.status !== "CANCELLED" &&
    active.status !== "COMPLETED" &&
    (active.status === "IN_PROGRESS" ||
      new Date(`${active.ride_date}T${active.departure_time.slice(0, 8)}-03:00`).getTime() >
        Date.now()),
  );
  const activeNextStep = !active
    ? ""
    : active.status === "IN_PROGRESS"
      ? "Acompanhar viagem"
      : active.status === "CONFIRMED"
        ? "Ver embarque e acompanhar"
        : active.status === "COMPLETED"
          ? "Ver resumo e Pix"
          : active.status === "MATCHED" || active.status === "matched"
            ? "Ver combinaÃ§Ã£o"
            : active.kind === "offer"
              ? "Ver oferta"
              : "Ver pedido";
  const point =
    originLocation ??
    (active?.origin_lat != null && active.origin_lng != null
      ? { lat: active.origin_lat, lng: active.origin_lng }
      : undefined);
  useEffect(() => {
    if (!location.addressPosition || originSource !== "CURRENT_LOCATION") return;
    let alive = true;
    setResolvedAddress(null);
    setReverseFailed(false);
    void reverseGeocode({
      data: { lat: location.addressPosition.lat, lng: location.addressPosition.lng },
    })
      .then((value) => {
        if (alive) {
          setResolvedAddress(value);
          setReverseFailed(!value);
        }
      })
      .catch(() => {
        if (alive) setReverseFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [location.addressPosition, reverseGeocode, originSource]);
  useEffect(() => {
    if (originSource !== "CURRENT_LOCATION" || !location.position) return;
    const { lat, lng } = location.position;
    const addressStillNear =
      resolvedAddress?.lat != null &&
      resolvedAddress.lng != null &&
      Math.abs(resolvedAddress.lat - lat) < 0.0003 &&
      Math.abs(resolvedAddress.lng - lng) < 0.0003;
    const label = addressStillNear
      ? resolvedAddress.formattedAddress || "Localização atual"
      : "Localização atual";
    setOrigin(label);
    setOriginLocation({
      rawText: label,
      formattedAddress: label,
      lat,
      lng,
      isApproximate: location.position.accuracy > 100,
    });
  }, [originSource, location.position, resolvedAddress]);
  // GPS city takes precedence unless the user manually selected a municipality.
  useEffect(() => {
    const city = resolvedAddress?.city?.trim();
    if (city && city.length >= 2 && !professionalMunicipalityEdited.current) {
      setProfessionalMunicipality(city);
    }
  }, [resolvedAddress?.city]);

  function focusOrigin() {
    setPanelOpen(true);
    setOriginSource("MANUAL_ORIGIN");
    setOriginEditing(true);
    window.requestAnimationFrame(() => document.getElementById("home-origin")?.focus());
  }

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

  function startJourney(nextRole: "request" | "offer") {
    setRole(nextRole);
    setPanelOpen(true);
    setError(null);
    const destinationInput = document.getElementById("home-destination");
    window.requestAnimationFrame(() =>
      destinationInput?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    // Allow the form to become visible before opening the mobile keyboard.
    window.setTimeout(() => destinationInput?.focus({ preventScroll: true }), 100);
  }

  function dictateOrigin() {
    const SpeechRecognition =
      (
        window as Window & {
          SpeechRecognition?: new () => typeof recognitionRef.current;
          webkitSpeechRecognition?: new () => typeof recognitionRef.current;
        }
      ).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: new () => typeof recognitionRef.current })
        .webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("A busca por voz não está disponível neste navegador.");
      return;
    }
    const recognition = new SpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setOriginSource("MANUAL_ORIGIN");
        setOrigin(transcript);
        setOriginLocation(undefined);
        setOriginEditing(true);
      }
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = () => setVoiceListening(false);
    setVoiceListening(true);
    recognition.start();
  }

  function adjustPassengerCount(delta: number) {
    setCount((value) => String(Math.max(1, Math.min(6, Number(value) + delta))));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <FavoriteCommuteSuggestion onChoose={(from,to)=>{
          setOriginSource("MANUAL_ORIGIN");
          setOrigin(from.label);
          setDestination(to.label);
          setOriginLocation({rawText:from.label,formattedAddress:from.label,lat:from.lat,lng:from.lng});
          setDestinationLocation({rawText:to.label,formattedAddress:to.label,lat:to.lat,lng:to.lng});
          setPanelOpen(true);
        }}/>

        <section className="mb-4 space-y-3 sm:hidden" aria-label="Começar uma carona">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#FFBB00]">
              Sua próxima viagem começa aqui
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
              Para onde vamos?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha o destino e encontre uma carona no seu caminho.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => startJourney("request")}
              className="min-h-12 rounded-xl text-sm font-bold"
            >
              <UserRound size={17} aria-hidden="true" />
              Pedir carona
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => startJourney("offer")}
              className="min-h-12 rounded-xl text-sm font-bold"
            >
              <CarFront size={17} aria-hidden="true" />
              Oferecer
            </Button>
          </div>
        </section>
        {active && (
          <section
            className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-soft"
            aria-label="Sua carona atual"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
                </p>
                <p className="mt-2 truncate font-semibold">
                  {active.origin} → {active.destination}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.ride_date.split("-").reverse().join("/")} ·{" "}
                  {active.departure_time.slice(0, 5)} ·{" "}
                  {active.status === "IN_PROGRESS"
                    ? "Em andamento"
                    : active.status === "CONFIRMED"
                      ? "Confirmada"
                      : active.status === "COMPLETED"
                        ? "Concluída"
                        : active.status === "MATCHED"
                          ? "Combinação encontrada"
                          : "Oferta ativa"}
                </p>
                {"pendingCount" in active && active.pendingCount > 0 && (
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {active.pendingCount} solicitação(ões) aguardando sua confirmação
                  </p>
                )}
              </div>
              {active.status === "IN_PROGRESS" || active.status === "CONFIRMED" ? (
                <Button asChild>
                  <Link to="/viagem/$rideId" params={{ rideId: active.id }}>
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              ) : active.kind === "offer" ||
                ("role" in active &&
                  active.role === "driver" &&
                  "offerId" in active &&
                  Boolean(active.offerId)) ? (
                <Button asChild>
                  <Link
                    to="/minha-carona/$offerId"
                    params={{
                      offerId: "offerId" in active && active.offerId ? active.offerId : active.id,
                    }}
                  >
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/minhas-caronas" hash={`ride-${active.id}`}>
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}
        {recent.length > 0 && (
          <section className="mb-4 sm:hidden" aria-label="Atalhos de destinos recentes">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">Seus destinos recentes</h2>
              <span className="text-xs text-muted-foreground">Um toque para repetir</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recent.slice(0, 4).map((item) => (
                <button
                  key={item.destination}
                  type="button"
                  className="inline-flex min-h-11 max-w-56 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-sm"
                  onClick={() => {
                    setDestination(item.destination);
                    setDestinationLocation(
                      item.destination_lat != null && item.destination_lng != null
                        ? {
                            rawText: item.destination,
                            lat: item.destination_lat,
                            lng: item.destination_lng,
                          }
                        : undefined,
                    );
                    setPanelOpen(true);
                    window.requestAnimationFrame(() =>
                      document
                        .getElementById("home-destination")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                    );
                  }}
                >
                  <MapPin size={15} aria-hidden="true" className="shrink-0 text-primary" />
                  <span className="truncate">{item.destination}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="mb-2 flex items-center justify-between gap-3 sm:hidden">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <MapPin size={14} aria-hidden="true" className="text-primary" />
            Seu mapa e ponto de partida
          </span>
          <button
            type="button"
            onClick={() => startJourney(role)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-primary underline underline-offset-4"
          >
            Escolher destino <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl [&_*]:focus-visible:outline-offset-2">
          <HomeRideMap
            professionalDrivers={professionalDrivers}
            userPosition={location.position}
            origin={point}
            destination={destinationLocation}
            originIsCurrent={originSource === "CURRENT_LOCATION" && Boolean(location.position)}
            following={location.isFollowingUser}
            recenterVersion={location.recenterVersion}
            locating={location.locating}
            onDrag={() => location.setFollowing(false)}
            onRecenter={location.locate}
          />
        </div>

        <section aria-label="Motoristas para viagens rápidas" className="my-4 rounded-2xl border border-primary/20 p-4 space-y-2">
          <h2 className="font-bold">Viajar agora · radar ativo</h2>
          <p className="text-xs text-muted-foreground">Somente profissionais autorizados e com GPS recente em regiões habilitadas. Pontos aproximados; não garantem corrida.</p>
          <label htmlFor="professional-municipality" className="block text-sm font-semibold">Município</label>
          <input id="professional-municipality" value={professionalMunicipality} maxLength={120} onChange={e=>{professionalMunicipalityEdited.current=true;setProfessionalMunicipality(e.target.value)}} placeholder="Detectando município ou informe aqui" className="w-full rounded-xl border bg-background p-3 text-sm" />
          <p role="status" className="text-xs text-muted-foreground">
            {professionalLoading?"Atualizando profissionais...":professionalError||(professionalMunicipality.trim().length<2?"Radar ligado · aguardando identificação do município. Você também pode informá-lo acima.":professionalDrivers.length+" profissional(is) disponível(is) no mapa.")}
          </p>
          <p className="text-xs text-muted-foreground">Corridas rápidas ainda bloqueadas até homologação e liberação regional.</p>
          <Link to="/viagem-rapida" className="inline-flex min-h-11 items-center rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary">Abrir viagens rápidas (piloto)</Link>
        </section>
        <section
          aria-labelledby="journey-title"
          className="relative -mx-4 -mt-5 rounded-t-3xl border border-white/10 bg-[#121212]/95 px-4 pb-28 pt-5 text-white shadow-2xl backdrop-blur-2xl sm:mx-0 sm:mt-5 sm:rounded-3xl sm:px-6 sm:pt-6"
        >
          <button
            type="button"
            aria-controls="caronaa-journey-details"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
            className="mb-4 flex min-h-11 w-full flex-col items-center justify-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <span className="text-xs font-bold text-muted-foreground">
              {panelOpen ? "Recolher detalhes" : "Expandir e planejar viagem"}
            </span>
          </button>
          <h2
            id="journey-title"
            className="font-[family-name:var(--font-display)] text-xl font-extrabold sm:text-3xl"
          >
            <span className="sm:hidden">{role === "request" ? "Quero carona" : "Vou dirigindo"}</span>
            <span className="hidden sm:inline">{role === "request" ? "Quero carona" : "Vou dirigindo"}</span>
          </h2>
          <p className="mt-1 text-sm text-gray-300 sm:hidden">
            {role === "request"
              ? "Encontre quem já vai fazer esse trajeto."
              : "Divida os custos levando passageiros no seu carro."}
          </p>
          {!panelOpen && (
            <button
              type="button"
              onClick={() => startJourney(role)}
              className="mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 text-left sm:hidden"
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">Destino</span>
                <span className="block truncate font-semibold">
                  {destination || "Para onde você vai?"}
                </span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden="true" />
            </button>
          )}
          <div id="caronaa-journey-details" className={panelOpen ? "block" : "hidden sm:block"}>
            {location.failure && (
              <div role="status" className="mt-3 text-sm text-gray-300">
                <p>{locationFailureMessages[location.failure]}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={focusOrigin}>
                    Informar saída
                  </Button>
                  {location.failure !== "UNSUPPORTED" && location.failure !== "INSECURE" && (
                    <Button type="button" variant="ghost" onClick={location.locate}>
                      Tentar novamente
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div
              role="group"
              aria-label="Papel nesta viagem"
              className="my-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 sm:my-5"
            >
              {(
                [
                  ["request", "Quero carona", UserRound],
                  ["offer", "Vou dirigindo", CarFront],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={role === value}
                  onClick={() => { setRole(value); setConfirmedReviewKey(null); }}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] ${role === value ? value === "offer" ? "border-[#FFBB00] bg-[#FFBB00] text-black shadow-sm" : "border-white/50 bg-white/15 text-white shadow-sm" : "border-white/10 text-gray-400 hover:bg-white/10"}`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
            <div role="status" className={role === "offer"
              ? "rounded-2xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 px-4 py-3"
              : "rounded-2xl border border-white/20 bg-white/5 px-4 py-3"}>
              <p className="flex items-center gap-2 text-sm font-bold">
                {role === "request" ? <UserRound size={18} /> : <CarFront size={18} className="text-[#FFBB00]" />}
                Você {role === "request" ? "viajará como PASSAGEIRO" : "vai DIRIGIR o seu carro"}
              </p>
              <p className="mt-1 text-xs text-gray-300">
                {role === "request"
                  ? "Você solicita apenas os lugares necessários e aguarda a confirmação do motorista."
                  : "Você publica uma oferta, define vagas e recebe pedidos de passageiros."}
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!origin.trim() || !destination.trim()) {
                  setError("Informe origem e destino antes de continuar.");
                  if (!origin.trim()) focusOrigin();
                  return;
                }
                if (role === "offer") {
                  if (driverBlocked) {
                    setError("Você possui três repasses pendentes. Quite a comissão antes de oferecer carona.");
                    return;
                  }
                  const seats = Number(offerSeats);
                  if (!Number.isInteger(seats) || seats < 1 || seats > 7) {
                    setError("Escolha entre 1 e 7 vagas disponíveis no carro.");
                    return;
                  }
                  const params = new URLSearchParams({
                    vagas: String(seats),
                    origem: origin,
                    destino: destination,
                    data: date,
                    horario: time,
                    tolerancia: String(timeTolerance),
                  });
                  if (originLocation?.lat != null && originLocation.lng != null) {
                    params.set("olat", String(originLocation.lat));
                    params.set("olng", String(originLocation.lng));
                  }
                  if (destinationLocation?.lat != null && destinationLocation.lng != null) {
                    params.set("dlat", String(destinationLocation.lat));
                    params.set("dlng", String(destinationLocation.lng));
                  }
                  window.location.assign(`/oferecer?${params}`);
                  return;
                }
                if (
                  !requestFare ||
                  requestFare.origin !== origin ||
                  requestFare.destination !== destination
                ) {
                  setError("Aguarde a cotação atual do seu trecho antes de pedir a carona.");
                  return;
                }
                const requestedSeats = Number(count);
                if (!Number.isInteger(requestedSeats) || requestedSeats < 1 || requestedSeats > 6) {
                  setError("Escolha a quantidade de passageiros antes de confirmar.");
                  return;
                }
                const reviewKey = JSON.stringify([
                  requestFare.quoteId, origin, destination, date, time,
                  requestedSeats, requestFare.pricePerPassenger,
                ]);
                if (confirmedReviewKey !== reviewKey) {
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
                      quoteId: requestFare.quoteId,
                      rideDate: date,
                      departureTime: time,
                      passengerCount: requestedSeats,
                      timeToleranceMinutes: timeTolerance,
                      preferences,
                    },
                  });
                  toast.success("Sua solicitação foi publicada.");
                  setConfirmedReviewKey(null);
                  setRequestFare(null);
                  refresh();
                } catch (reason) {
                  setError("Não foi possível pedir a carona. Confira os dados e tente novamente.");
                  if (
                    reason instanceof Error &&
                    /cotação.*expir|quote.*expired/i.test(reason.message)
                  ) {
                    setRequestFare(null);
                    setRequestFareRefresh((value) => value + 1);
                  }
                } finally {
                  requestSubmitting.current = false;
                  setBusy(false);
                }
              }}
            >
              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-2xl">
                <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-3">
                  <div className="flex flex-col items-center pt-1" aria-hidden="true">
                    <span
                      className={`h-3 w-3 rounded-full ${location.position && originSource === "CURRENT_LOCATION" ? "animate-pulse bg-emerald-400 ring-4 ring-emerald-400/15" : "bg-[#FFBB00]"}`}
                    />
                    <span className="my-2 h-10 border-l border-dashed border-[#FFBB00]/70" />
                    <MapPin size={17} className="text-[#FFBB00]" />
                  </div>
                  <div className="min-w-0 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                        Origem
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-white">
                        {origin ||
                          (location.locating ? "Localizando você…" : "De onde você vai sair?")}
                      </p>
                      {originSource === "CURRENT_LOCATION" && location.position && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                          <Navigation2 size={12} className="text-[#FFBB00]" />
                          Localização atual{location.position.accuracy > 100 ? " · aproximada" : ""}
                        </p>
                      )}
                      {originEditing && (
                        <div className="mt-2">
                          <LocationAutocomplete
                            id="home-origin"
                            label="Saída"
                            value={origin}
                            onChange={(text, details) => {
                              setOriginSource("MANUAL_ORIGIN");
                              setOrigin(details?.formattedAddress || text);
                              setOriginLocation(details);
                            }}
                            variant="glass"
                            required
                            placeholder="De onde você vai sair?"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                        Destino
                      </p>
                      <LocationAutocomplete
                        id="home-destination"
                        label="Destino"
                        value={destination}
                        onChange={(text, details) => {
                          setDestination(details?.formattedAddress || text);
                          setDestinationLocation(details);
                        }}
                        variant="glass"
                        required
                        placeholder="Para onde você vai?"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      aria-label={voiceListening ? "Ouvindo origem" : "Ditar origem por voz"}
                      onClick={dictateOrigin}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                    >
                      <Mic
                        size={17}
                        className={voiceListening ? "animate-pulse text-[#FFBB00]" : ""}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Editar origem"
                      onClick={focusOrigin}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Usar localização atual"
                      onClick={() => {
                        setOriginSource("CURRENT_LOCATION");
                        setOriginEditing(false);
                        location.locate();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                    >
                      <LocateFixed size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <input type="hidden" name="origin" value={origin} />
              {reverseFailed && originSource === "CURRENT_LOCATION" && (
                <p role="status" className="text-xs text-muted-foreground">
                  Não conseguimos identificar o endereço. Suas coordenadas estão disponíveis; você
                  pode ajustar a saída.
                </p>
              )}
              {recent.length > 0 && (
                <div aria-label="Destinos recentes" className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Seus destinos recentes
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recent.slice(0, 6).map((item) => (
                      <button
                        key={item.destination}
                        type="button"
                        className="flex min-h-11 max-w-56 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                        onClick={() => {
                          setDestination(item.destination);
                          setDestinationLocation(
                            item.destination_lat != null && item.destination_lng != null
                              ? {
                                  rawText: item.destination,
                                  lat: item.destination_lat,
                                  lng: item.destination_lng,
                                }
                              : undefined,
                          );
                        }}
                      >
                        <MapPin size={15} className="shrink-0 text-[#FFBB00]" />
                        <span className="truncate">{item.destination}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Quando pretende sair?</span>
                <button
                  type="button"
                  onClick={setToday}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                >
                  <CalendarDays size={15} aria-hidden="true" /> Hoje
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-gray-200">
                  Data
                  <input
                    aria-label="Data da viagem"
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 px-2 text-sm font-normal text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] sm:px-3"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-200">
                  Horário
                  <input
                    aria-label="Horário de saída"
                    required
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 px-2 text-sm font-normal text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] sm:px-3"
                  />
                </label>
              </div>
              <div className="text-white [&_button]:border-white/15 [&_button]:text-gray-200">
                <TimeToleranceSelector
                  value={timeTolerance}
                  onChange={setTimeTolerance}
                  baseTime={time}
                  label="Flexibilidade de horário"
                />
              </div>
              {role === "offer" && (
                <div className="space-y-3 rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/5 p-4">
                  <p className="text-sm font-bold text-[#FFBB00]">Seu carro e as vagas que você oferece</p>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-200">Quantas vagas livres no seu carro?</span>
                    <div className="flex items-center gap-2 rounded-full border border-white/20 px-2 py-1">
                      <button type="button" aria-label="Diminuir vagas ofertadas"
                        disabled={Number(offerSeats) <= 1}
                        onClick={() => setOfferSeats(n => String(Math.max(1, Number(n)-1)))}
                        className="flex h-9 w-9 items-center justify-center disabled:opacity-40"><Minus size={15}/></button>
                      <strong className="min-w-5 text-center">{offerSeats}</strong>
                      <button type="button" aria-label="Aumentar vagas ofertadas"
                        disabled={Number(offerSeats) >= 7}
                        onClick={() => setOfferSeats(n => String(Math.min(7, Number(n)+1)))}
                        className="flex h-9 w-9 items-center justify-center disabled:opacity-40"><Plus size={15}/></button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-200">
                    <CarFront size={18} className="shrink-0 text-[#FFBB00]" />
                    <span>{driverVehicle
                      ? `Veículo cadastrado: ${driverVehicle}${driverPlate ? " · placa final " + driverPlate.slice(-4) : ""}`
                      : "Veículo não cadastrado. Informe os dados na próxima etapa."}
                    </span>
                  </div>
                  {driverBlocked && (
                    <p role="alert" className="rounded-lg border border-destructive/50 p-2 text-xs">
                      Motorista bloqueado por três repasses pendentes.{" "}
                      <Link to="/perfil" className="font-bold underline">Ver repasses no perfil</Link>
                    </p>
                  )}
                </div>
              )}
              {role === "request" && (
                <label className="flex min-h-12 items-center justify-between text-sm font-semibold text-gray-200">
                  Passageiros neste pedido
                  <span className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                      type="button"
                      aria-label="Diminuir passageiros"
                      onClick={() => adjustPassengerCount(-1)}
                      disabled={Number(count) <= 1}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="min-w-4 text-center text-sm text-white">{count}</span>
                    <button
                      type="button"
                      aria-label="Aumentar passageiros"
                      onClick={() => adjustPassengerCount(1)}
                      disabled={Number(count) >= 6}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                    >
                      <Plus size={15} />
                    </button>
                  </span>
                </label>
              )}
              {role === "request" && (
                <div className="[&_section]:rounded-2xl [&_section]:border-white/10 [&_section]:bg-white/5 [&_p]:text-gray-300 [&_section_p.text-lg]:font-[family-name:var(--font-display)] [&_section_p.text-lg]:text-[#FFBB00]">
                  <RequestFarePreview
                    origin={origin}
                    destination={destination}
                    passengerCount={Number(count)}
                    onQuote={receiveRequestFare}
                    refreshKey={requestFareRefresh}
                  />
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {role === "request" && (
                <div className="text-white [&_button]:border-white/15 [&_label]:text-gray-200">
                  <JourneyPreferences kind="request" onChange={setPreferences} />
                </div>
              )}
              {role === "offer" && (
                <p role="status" className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 p-3 text-sm text-white">
                  Você está OFERECENDO <strong>{offerSeats} {Number(offerSeats) === 1 ? "VAGA" : "VAGAS"}</strong>
                  {" "}no seu carro. Na próxima tela você revisará o veículo e publicará a oferta.
                </p>
              )}
              {role === "request" && requestFare &&
                confirmedReviewKey === JSON.stringify([
                  requestFare.quoteId, origin, destination, date, time,
                  Number(count), requestFare.pricePerPassenger,
                ]) && (
                <div role="status" aria-label="Revisão obrigatória da quantidade"
                  className="rounded-2xl border border-[#FFBB00]/45 bg-[#FFBB00]/10 p-4 text-white">
                  <p className="text-sm font-bold">Revise antes de enviar</p>
                  <p className="mt-1 text-sm">
                    Você está solicitando <strong>{count} {Number(count) === 1 ? "vaga" : "vagas"}</strong>,
                    não todas as vagas oferecidas pelo motorista.
                  </p>
                  <p className="mt-2 text-sm">
                    {formatBrl(requestFare.pricePerPassenger)} por passageiro ·
                    <strong> {formatBrl(calculateRequestedGroupFare(requestFare.pricePerPassenger, Number(count)))} no total</strong>
                  </p>
                  <p className="mt-1 text-xs text-gray-200">
                    Confira a quantidade e pressione novamente o botão para confirmar.
                  </p>
                  <button type="button" className="mt-2 text-xs font-semibold text-[#FFBB00] underline"
                    onClick={() => setConfirmedReviewKey(null)}>
                    Corrigir quantidade
                  </button>
                </div>
              )}
              <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-3xl border border-white/15 bg-[#121212]/95 p-3 shadow-2xl backdrop-blur-2xl sm:static sm:mt-2 sm:max-w-none sm:rounded-2xl sm:border-white/10 sm:bg-white/5 sm:backdrop-blur-0">
                <div className="min-w-0 pl-2">
                  <p className="text-[10px] font-semibold text-gray-400">Rateio de combustível</p>
                  <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-[#FFBB00]">
                    {requestFare &&
                    requestFare.origin === origin &&
                    requestFare.destination === destination
                      ? `R$ ${requestFare.pricePerPassenger.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={busy || (role === "request" && !requestFare) || (role === "offer" && driverBlocked)}
                  className="min-h-14 flex-1 rounded-2xl bg-[#FFBB00] text-base font-bold text-[#121212] shadow-lg hover:bg-[#ffd04d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none sm:px-8"
                >
                  {busy
                    ? "Buscando motoristas…"
                    : role === "request"
                      ? confirmedReviewKey === JSON.stringify([
                           requestFare?.quoteId, origin, destination, date, time,
                           Number(count), requestFare?.pricePerPassenger,
                         ])
                         ? `Confirmar ${count} ${Number(count) === 1 ? "vaga" : "vagas"}`
                         : "Revisar vagas e total"
                      : "Definir detalhes da carona (Motorista)"}
                  <ArrowRight size={18} />
                </Button>
              </div>
            </form>
          </div>
        </section>
        {/*
          <section className="mt-6 border-t border-border py-5" aria-label="Seu trajeto ativo">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
              </h2>
            </div>
            <p className="mt-3 text-sm font-medium">{active.origin}</p>
            <ArrowRight size={16} className="my-2 rotate-90 text-primary" />
            <p className="text-sm font-medium">{active.destination}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {active.ride_date.split("-").reverse().join("/")} ·{" "}
              {active.departure_time.slice(0, 5)} ·{" "}
              {active.status === "IN_PROGRESS"
                ? "Em andamento"
                : active.status === "CONFIRMED"
                  ? "Confirmada"
                  : active.status === "COMPLETED"
                    ? "Concluída"
                    : active.status === "CANCELLED"
                      ? "Cancelada"
                      : active.status === "NO_SHOW"
                        ? "Não compareceu"
                        : active.kind === "offer"
                          ? "Oferta ativa"
                          : active.status === "matched"
                            ? "Compatibilidade encontrada"
                            : "Solicitação ativa"}
            </p>
            {!activeIsCurrent && (
              <p className="mt-1 text-xs text-muted-foreground">
                Esta publicação está encerrada e não representa uma viagem ativa.
              </p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link to="/minhas-caronas" hash={`ride-${active.id}`}>
                {activeNextStep} <ArrowRight size={16} />
              </Link>
            </Button>
          </section>
        */}
      </div>
    </AppShell>
  );
}
