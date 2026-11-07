import { useProfileGender } from "@/lib/use-profile-gender";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import { RoutePolicySelector } from "@/components/caronaa/RoutePolicySelector";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  ArrowDownUp,
  Bike,
  Minus,
  Plus,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CarFront,
  MapPin,
  CalendarDays,
  Mic,
  Pencil,
  LocateFixed,
  Navigation2,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { createRideOffer } from "@/lib/ride-matching.functions";
import { toast } from "sonner";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { RouteMap } from "@/components/caronaa/RouteMap";
import { OfferFarePreview, type OfferQuote } from "@/components/caronaa/OfferFarePreview";
import { formatBrl } from "@/lib/ride-cost";
import { RideRoutineForm, RideScheduleMode } from "@/components/caronaa/RideRoutineForm";
import type { FormLocationDetails } from "@/lib/location/types";
import {
  TimeToleranceSelector,
  type TimeToleranceMinutes,
} from "@/components/caronaa/TimeToleranceSelector";
import { supabase } from "@/integrations/supabase/client";
import { ResearchSeatPicker } from "@/components/research/ResearchSeatPicker";
import { useUserLocation, locationFailureMessages } from "@/lib/location/use-user-location";
import { reverseGeocodeServerFn } from "@/lib/location.functions";

export const Route = createFileRoute("/_authenticated/oferecer")({
  validateSearch: z.object({
    origem: z.string().max(160).optional(),
    destino: z.string().max(160).optional(),
    data: z.string().optional(),
    horario: z.string().optional(),
    vagas: z.coerce.number().int().min(1).max(4).optional(),
    tolerancia: z.coerce
      .number()
      .int()
      .refine((n) => [5, 15, 30, 60].includes(n))
      .optional(),
    olat: z.coerce.number().min(-90).max(90).optional(),
    olng: z.coerce.number().min(-180).max(180).optional(),
    dlat: z.coerce.number().min(-90).max(90).optional(),
    dlng: z.coerce.number().min(-180).max(180).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Oferecer carona — CARONAA" },
      {
        name: "description",
        content: "Compartilhe um trajeto que você já vai fazer e ofereça lugares à comunidade.",
      },
      { property: "og:title", content: "Oferecer carona — CARONAA" },
      {
        property: "og:description",
        content: "Compartilhe um trajeto que você já vai fazer e ofereça lugares à comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Oferecer,
});

type OferecerFormState = {
  origin: string;
  destination: string;
  originLocation?: FormLocationDetails;
  destinationLocation?: FormLocationDetails;
  date: string;
  time: string;
  vehicleType: "CAR" | "MOTO";
  seats: string;
  vehicle: string;
  notes: string;
  timeTolerance: TimeToleranceMinutes;
  passengerGenderPreference: "ANY" | "FEMININO" | "MASCULINO";
};

const initial: OferecerFormState = {
  origin: "",
  destination: "",
  originLocation: undefined,
  destinationLocation: undefined,
  date: "",
  time: "",
  vehicleType: "CAR",
  seats: "3",
  vehicle: "",
  notes: "",
  timeTolerance: 15,
  passengerGenderPreference: "ANY",
};
function immediateDeparture() {
  const instant = new Date(Date.now() + 60000);
  return {
    date: instant.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }),
    time: instant.toLocaleTimeString("en-GB", {
      timeZone: "America/Fortaleza",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
function Oferecer() {
  const gender = useProfileGender();
  const [departureMode, setDepartureMode] = useState<"now" | "schedule">("schedule");
  const search = Route.useSearch();
  const navigate = useNavigate();
  const publishOffer = useServerFn(createRideOffer);
  const reverseGeocode = useServerFn(reverseGeocodeServerFn);
  const location = useUserLocation();
  const [allowDetours, setAllowDetours] = useState(false);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"point" | "routine">("point");
  const [routineSaved, setRoutineSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [driverAllowed, setDriverAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void (supabase as any)
      .rpc("get_my_driver_platform_fees")
      .then(({ data, error }: { data: any; error: any }) => {
        if (live) setDriverAllowed(!error && data?.driverAllowed === true);
      });
    return () => {
      live = false;
    };
  }, []);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [publishedOfferId, setPublishedOfferId] = useState<string | null>(null);
  const publishingRef = useRef(false);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [profilePlate, setProfilePlate] = useState("");
  const [vehicleFromProfile, setVehicleFromProfile] = useState(false);
  const receiveQuote = useCallback((value: OfferQuote | null) => setQuote(value), []);
  const [originSource, setOriginSource] = useState<"CURRENT_LOCATION" | "MANUAL_ORIGIN">(
    search.origem ? "MANUAL_ORIGIN" : "CURRENT_LOCATION",
  );
  const [resolvedAddress, setResolvedAddress] = useState<FormLocationDetails | null>(null);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [originEditing, setOriginEditing] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  } | null>(null);
  const [form, setForm] = useState<OferecerFormState>(() => ({
    ...initial,
    origin: search.origem ?? "",
    destination: search.destino ?? "",
    date: search.data ?? "",
    time: search.horario ?? "",
    seats: search.vagas ? String(search.vagas) : initial.seats,
    timeTolerance: (search.tolerancia ?? initial.timeTolerance) as TimeToleranceMinutes,
    originLocation:
      search.olat != null && search.olng != null
        ? { rawText: search.origem ?? "", lat: search.olat, lng: search.olng }
        : undefined,
    destinationLocation:
      search.dlat != null && search.dlng != null
        ? { rawText: search.destino ?? "", lat: search.dlat, lng: search.dlng }
        : undefined,
  }));
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("vehicle_description, vehicle_brand, vehicle_plate")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (active && data) {
        setProfilePlate(data.vehicle_plate ?? "");
        const savedVehicle = [data.vehicle_brand, data.vehicle_description]
          .filter(Boolean)
          .join(" · ");
        if (savedVehicle) setVehicleFromProfile(true);
        setForm((current) =>
          current.vehicle.trim() ? current : { ...current, vehicle: savedVehicle },
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  // Resolve o endereço da posição atual uma única vez por fix de GPS.
  useEffect(() => {
    if (!location.addressPosition || originSource !== "CURRENT_LOCATION") return;
    let alive = true;
    setResolvedAddress(null);
    setReverseFailed(false);
    void reverseGeocode({
      data: {
        lat: location.addressPosition.lat,
        lng: location.addressPosition.lng,
      },
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
  // Origem padrão: localização atual do motorista.
  useEffect(() => {
    const position = location.position;
    if (originSource !== "CURRENT_LOCATION" || !position) return;
    const { lat, lng } = position;
    const addressStillNear =
      resolvedAddress?.lat != null &&
      resolvedAddress.lng != null &&
      Math.abs(resolvedAddress.lat - lat) < 0.0003 &&
      Math.abs(resolvedAddress.lng - lng) < 0.0003;
    const label = addressStillNear
      ? resolvedAddress.formattedAddress || "Localização atual"
      : "Localização atual";
    setForm((current) => ({
      ...current,
      origin: label,
      originLocation: {
        rawText: label,
        formattedAddress: label,
        lat,
        lng,
        isApproximate: position.accuracy > 100,
      },
    }));
  }, [originSource, location.position, resolvedAddress]);
  // Pede a localização ao abrir quando a origem padrão é o GPS.
  useEffect(() => {
    if (
      originSource === "CURRENT_LOCATION" &&
      !location.position &&
      !location.locating &&
      !location.failure
    ) {
      location.locate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (gender !== "FEMININO")
      setForm((current) =>
        current.passengerGenderPreference === "ANY"
          ? current
          : { ...current, passengerGenderPreference: "ANY" },
      );
  }, [gender]);
  const update = (key: keyof OferecerFormState, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  function focusOrigin() {
    document.getElementById("oferecer-origem")?.focus();
  }
  function setToday() {
    const now = new Date();
    setForm((current) => ({
      ...current,
      date: [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-"),
    }));
  }
  function dictateOrigin() {
    const SpeechRecognition =
      (
        window as Window & {
          SpeechRecognition?: new () => typeof recognitionRef.current;
          webkitSpeechRecognition?: new () => typeof recognitionRef.current;
        }
      ).SpeechRecognition ??
      (
        window as Window & {
          webkitSpeechRecognition?: new () => typeof recognitionRef.current;
        }
      ).webkitSpeechRecognition;
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
        setForm((current) => ({
          ...current,
          origin: transcript,
          originLocation: undefined,
        }));
        setOriginEditing(true);
      }
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = () => setVoiceListening(false);
    setVoiceListening(true);
    recognition.start();
  }
  const quoteCurrent =
    quote && quote.origin === form.origin && quote.destination === form.destination ? quote : null;
  const potentialSavings = quoteCurrent
    ? quoteCurrent.pricePerPassenger * Number(form.seats || 0)
    : null;
  const next = async (e: FormEvent) => {
    e.preventDefault();
    if (driverAllowed !== true) {
      toast.error("Verifique os repasses da plataforma no perfil antes de oferecer caronas.");
      return;
    }
    if (step === 1) {
      if (!quoteCurrent) {
        toast.error("Aguarde a cotação rodoviária do percurso ou tente novamente.");
        return;
      }
      const seats = Number(form.seats);
      if (!Number.isInteger(seats) || seats < 1 || seats > (form.vehicleType === "MOTO" ? 1 : 4)) {
        toast.error("Informe de 1 a 4 vagas para carro ou uma vaga para moto.");
        return;
      }
      setStep((current) => current + 1);
      return;
    }
    if (step === 2) {
      if (!quoteCurrent) {
        toast.error("Aguarde o preço do percurso antes de publicar.");
        return;
      }
      if (publishingRef.current) return;
      publishingRef.current = true;
      setPublishing(true);
      try {
        const departure =
          departureMode === "now" ? immediateDeparture() : { date: form.date, time: form.time };
        const result = await publishOffer({
          data: {
            origin: form.origin,
            quoteId: quoteCurrent.quoteId,
            allowDetours,
            destination: form.destination,
            originLat: form.originLocation?.lat,
            originLng: form.originLocation?.lng,
            destinationLat: form.destinationLocation?.lat,
            destinationLng: form.destinationLocation?.lng,
            rideDate: departure.date,
            departureTime: departure.time,
            availableSeats: Number(form.seats),
            vehicleType: form.vehicleType,
            timeToleranceMinutes: form.timeTolerance,
            passengerGenderPreference:
              gender === "FEMININO" ? form.passengerGenderPreference : "ANY",
            preferences,
            idempotencyKey,
            vehicleDescription: form.vehicle,
            notes: form.notes,
          },
        });
        setPublishedOfferId(result.offerId);
        await navigate({
          to: "/minha-carona/$offerId",
          params: { offerId: result.offerId },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível publicar a oferta.");
        return;
      } finally {
        publishingRef.current = false;
        setPublishing(false);
      }
      setIdempotencyKey(crypto.randomUUID());
    }
  };
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFBB00]">
            Compartilhe seu caminho
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
            Oferecer Carona
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina seu trajeto e compartilhe os custos da viagem.
          </p>
        </header>
        <RideScheduleMode value={mode} onChange={setMode} />
        {mode === "routine" ? (
          routineSaved ? (
            <div className="space-y-4 border-y border-border py-8">
              <h2 className="text-xl font-semibold">Rotina ativa</h2>
              <Button asChild>
                <Link
                  to="/minhas-caronas"
                  hash={publishedOfferId ? `ride-${publishedOfferId}` : undefined}
                >
                  Minhas viagens <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setRoutineSaved(false)}>
                Nova rotina
              </Button>
            </div>
          ) : (
            <RideRoutineForm
              kind="offer"
              initial={{
                origin: form.origin,
                destination: form.destination,
                originLat: form.originLocation?.lat ?? null,
                originLng: form.originLocation?.lng ?? null,
                destinationLat: form.destinationLocation?.lat ?? null,
                destinationLng: form.destinationLocation?.lng ?? null,
                departureTime: form.time || "07:30",
                seats: Number(form.seats),
                totalPrice: 0,
                timeToleranceMinutes: form.timeTolerance,
              }}
              onSaved={() => setRoutineSaved(true)}
            />
          )
        ) : publishedOfferId ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] px-6 py-16 text-center text-white shadow-2xl">
            <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-white/10 text-[#FFBB00]">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
              Carona publicada!
            </h2>
            <p className="mx-auto mt-3 max-w-md text-gray-300">
              Seu trajeto de {form.origin} para {form.destination} está publicado. Você receberá
              solicitações e poderá confirmar quem vai viajar. Publicar não confirma automaticamente
              nenhuma combinação.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#ffd04d]">
                <Link to="/minhas-caronas">
                  Ver minhas caronas <ArrowRight />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setForm({ ...initial, vehicle: form.vehicle });
                  setPublishedOfferId(null);
                  setStep(1);
                }}
              >
                Oferecer outra
              </Button>
            </div>
          </div>
        ) : (
          <section
            aria-labelledby="oferecer-title"
            className="rounded-3xl border border-white/10 bg-[#121212]/95 px-4 pb-28 pt-5 text-white shadow-2xl backdrop-blur-2xl sm:px-6 sm:pt-6"
          >
            <h2
              id="oferecer-title"
              className="font-[family-name:var(--font-display)] text-xl font-extrabold sm:text-2xl"
            >
              {step === 1 ? "Seu trajeto" : "Revise sua oferta como MOTORISTA"}
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {step === 1
                ? "Escolha seu veículo, trajeto e horário de saída."
                : "Confira o trajeto, as vagas e a estimativa antes de publicar."}
            </p>
            {driverAllowed === false && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-destructive/50 p-3 text-sm"
              >
                Não foi possível liberar novas ofertas. Se houver três repasses pendentes,
                regularize-os no{" "}
                <Link to="/perfil" className="font-bold underline">
                  Perfil
                </Link>
                .
              </div>
            )}
            <form className="mt-5 space-y-4" onSubmit={next}>
              {step === 1 ? (
                <>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">Tipo de Veículo</legend>
                    <div className="flex gap-2">
                      {(
                        [
                          ["CAR", "Carro", CarFront],
                          ["MOTO", "Moto", Bike],
                        ] as const
                      ).map(([type, label, Icon]) => (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={form.vehicleType === type}
                          onClick={() =>
                            setForm((current) =>
                              current.vehicleType === type
                                ? current
                                : {
                                    ...current,
                                    vehicleType: type,
                                    seats: type === "MOTO" ? "1" : "3",
                                    vehicle: "",
                                  },
                            )
                          }
                          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border px-4 font-bold ${form.vehicleType === type ? "border-[#FFBB00] bg-[#FFBB00] text-[#121212]" : "border-white/15 bg-white/5"}`}
                        >
                          <Icon size={20} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#FFBB00]"
                    onClick={() => {
                      setOriginSource("MANUAL_ORIGIN");
                      setOriginEditing(true);
                      setForm((current) => ({
                        ...current,
                        origin: current.destination,
                        destination: current.origin,
                        originLocation: current.destinationLocation,
                        destinationLocation: current.originLocation,
                      }));
                    }}
                  >
                    <ArrowDownUp size={18} />
                    Inverter sentido
                  </button>
                  {location.failure && originSource === "CURRENT_LOCATION" && (
                    <div role="status" className="text-sm text-gray-300">
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
                  {/* Cápsula de trajeto conectada */}
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
                            {form.origin ||
                              (location.locating ? "Localizando você…" : "De onde você vai sair?")}
                          </p>
                          {originSource === "CURRENT_LOCATION" && location.position && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                              <Navigation2 size={12} className="text-[#FFBB00]" />
                              Localização atual
                              {location.position.accuracy > 100 ? " · aproximada" : ""}
                            </p>
                          )}
                          {(originEditing || originSource === "MANUAL_ORIGIN") && (
                            <div className="mt-2">
                              <LocationAutocomplete
                                id="oferecer-origem"
                                label="Saída"
                                value={form.origin}
                                onChange={(v, details) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    origin: details?.formattedAddress || v,
                                    originLocation: details,
                                  }))
                                }
                                placeholder="De onde você vai sair?"
                                required
                                variant="glass"
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                            Destino
                          </p>
                          <LocationAutocomplete
                            id="oferecer-destino"
                            label="Destino"
                            value={form.destination}
                            onChange={(v, details) =>
                              setForm((prev) => ({
                                ...prev,
                                destination: details?.formattedAddress || v,
                                destinationLocation: details,
                              }))
                            }
                            placeholder="Ex.: Eusébio, UNIFOR, Centro"
                            required
                            variant="glass"
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
                          onClick={() => {
                            setOriginEditing((editing) => !editing);
                            setOriginSource("MANUAL_ORIGIN");
                            window.requestAnimationFrame(focusOrigin);
                          }}
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
                  <input
                    aria-label="Saída"
                    required
                    tabIndex={-1}
                    value={form.origin}
                    readOnly
                    className="sr-only"
                  />
                  {reverseFailed && originSource === "CURRENT_LOCATION" && (
                    <p role="status" className="text-xs text-gray-400">
                      Não conseguimos identificar o endereço. Suas coordenadas estão disponíveis;
                      você pode ajustar a saída.
                    </p>
                  )}
                  {/* Quando sai */}
                  <fieldset className="flex flex-wrap gap-2">
                    <legend className="mb-2 text-sm font-semibold">Horário</legend>
                    <button
                      type="button"
                      aria-pressed={departureMode === "now"}
                      className={`min-h-11 rounded-full border px-4 text-sm font-bold ${departureMode === "now" ? "border-[#FFBB00] bg-[#FFBB00] text-[#121212]" : "border-white/15"}`}
                      onClick={() => {
                        const departure = immediateDeparture();
                        setDepartureMode("now");
                        setForm((current) => ({ ...current, ...departure }));
                      }}
                    >
                      Sair agora
                    </button>
                    <button
                      type="button"
                      aria-pressed={departureMode === "schedule"}
                      onClick={() => setDepartureMode("schedule")}
                      className={`min-h-11 rounded-full border px-4 text-sm font-bold ${departureMode === "schedule" ? "border-[#FFBB00] bg-[#FFBB00] text-[#121212]" : "border-white/15"}`}
                    >
                      Agendar data/hora
                    </button>
                  </fieldset>
                  <div
                    className={departureMode === "schedule" ? "grid grid-cols-2 gap-3" : "hidden"}
                  >
                    <label className="text-sm font-semibold text-gray-200">
                      Data
                      <input
                        aria-label="Data da viagem"
                        required
                        type="date"
                        value={form.date}
                        onChange={(e) => update("date", e.target.value)}
                        className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 px-2 text-sm font-normal text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] sm:px-3"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-200">
                      Horário
                      <input
                        aria-label="Horário de saída"
                        required
                        type="time"
                        value={form.time}
                        onChange={(e) => update("time", e.target.value)}
                        className="mt-1 h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 px-2 text-sm font-normal text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] sm:px-3"
                      />
                    </label>
                  </div>
                  <div className="text-white [&_button]:border-white/15 [&_button]:text-gray-200">
                    <TimeToleranceSelector
                      value={form.timeTolerance}
                      onChange={(val) => setForm((prev) => ({ ...prev, timeTolerance: val }))}
                      baseTime={form.time}
                      label="Flexibilidade de horário da oferta"
                    />
                  </div>
                  <RouteMap
                    origin={form.origin}
                    destination={form.destination}
                    originLocation={form.originLocation}
                    destinationLocation={form.destinationLocation}
                    showApproximateMetrics={false}
                  />
                  {/* Vagas + veículo */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-gray-200">Vagas disponíveis</p>
                      {form.vehicleType === "MOTO" ? (
                        <div>
                          <p className="text-lg font-bold text-[#FFBB00]">1 vaga</p>
                          <p className="mt-1 text-xs text-gray-300">Capacete extra obrigatório</p>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-4 rounded-full border border-white/15 p-1">
                          <button
                            type="button"
                            aria-label="Diminuir vagas"
                            disabled={Number(form.seats) <= 1}
                            onClick={() =>
                              update("seats", String(Math.max(1, Number(form.seats) - 1)))
                            }
                            className="flex size-11 items-center justify-center disabled:opacity-40"
                          >
                            <Minus size={18} />
                          </button>
                          <output
                            aria-label="Vagas disponíveis"
                            className="min-w-4 text-center font-bold"
                          >
                            {form.seats}
                          </output>
                          <button
                            type="button"
                            aria-label="Aumentar vagas"
                            disabled={Number(form.seats) >= 4}
                            onClick={() =>
                              update("seats", String(Math.min(4, Number(form.seats) + 1)))
                            }
                            className="flex size-11 items-center justify-center disabled:opacity-40"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-gray-200">Veículo desta viagem</p>
                      {vehicleFromProfile && form.vehicle.trim() ? (
                        <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 backdrop-blur-2xl">
                          <CarFront
                            size={18}
                            className="shrink-0 text-[#FFBB00]"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {form.vehicle}
                            </p>
                            {profilePlate && (
                              <p className="text-xs text-gray-400">Placa {profilePlate}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <input
                          aria-label="Veículo desta viagem"
                          required
                          value={form.vehicle}
                          onChange={(e) => {
                            setVehicleFromProfile(false);
                            update("vehicle", e.target.value);
                          }}
                          placeholder="Ex.: Honda Fit, prata"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                        />
                      )}
                      <p className="text-xs text-gray-400">
                        {vehicleFromProfile ? "Do seu perfil. " : ""}
                        <Link
                          to="/perfil"
                          className="font-semibold text-[#FFBB00] underline underline-offset-4"
                        >
                          Meu veículo no perfil
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="[&_section]:rounded-2xl [&_section]:border-white/10 [&_section]:bg-white/5 [&_p]:text-gray-300 [&_section_p.text-lg]:font-[family-name:var(--font-display)] [&_section_p.text-lg]:text-[#FFBB00]">
                    <OfferFarePreview
                      origin={form.origin}
                      destination={form.destination}
                      seats={Number(form.seats)}
                      onQuote={receiveQuote}
                    />
                  </div>
                  <RoutePolicySelector allowDetours={allowDetours} onChange={setAllowDetours} />
                  <WomenOnlyToggle
                    gender={gender}
                    kind="offer"
                    checked={form.passengerGenderPreference === "FEMININO"}
                    onChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        passengerGenderPreference: checked ? "FEMININO" : "ANY",
                      }))
                    }
                  />
                  <details className="rounded-2xl border border-white/10 bg-white/5 px-4 py-1">
                    <summary className="cursor-pointer py-2 text-sm font-semibold text-gray-200">
                      Preferências e observações (opcional)
                    </summary>
                    <div className="mt-3 space-y-4 pb-3">
                      <div className="text-white [&_button]:border-white/15 [&_label]:text-gray-200">
                        <JourneyPreferences kind="offer" onChange={setPreferences} />
                      </div>
                      <label className="block text-sm font-semibold text-gray-200">
                        Observações (opcional)
                        <textarea
                          value={form.notes}
                          onChange={(event) => update("notes", event.target.value)}
                          placeholder="Algo importante para os passageiros?"
                          rows={2}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
                        />
                      </label>
                    </div>
                  </details>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl">
                    <p className="font-semibold text-white">{form.origin || "Origem pendente"}</p>
                    <ArrowRight className="my-2 rotate-90 text-[#FFBB00]" size={18} />
                    <p className="font-semibold text-white">
                      {form.destination || "Destino pendente"}
                    </p>
                    <p className="mt-3 text-sm text-gray-300">
                      {form.date
                        ? new Date(`${form.date}T12:00:00`).toLocaleDateString("pt-BR")
                        : "Data pendente"}{" "}
                      · {form.time || "Horário pendente"}
                      {form.timeTolerance ? ` · tolerância de ${form.timeTolerance} min` : ""}
                    </p>
                  </div>
                  <p className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm text-white">
                    {allowDetours ? "Aceitar pequenos desvios" : "Rota Estrita (Ponto de encontro)"}
                  </p>
                  <div className="grid gap-2 text-sm text-gray-200 sm:grid-cols-2">
                    <p>
                      {form.seats} {Number(form.seats) === 1 ? "vaga" : "vagas"}
                    </p>
                    <p className="flex items-center gap-2">
                      {form.vehicleType === "MOTO" ? (
                        <Bike size={15} className="text-[#FFBB00]" aria-hidden="true" />
                      ) : (
                        <CarFront size={15} className="text-[#FFBB00]" aria-hidden="true" />
                      )}
                      {form.vehicle || "Veículo pendente"}
                    </p>
                  </div>
                  {gender === "FEMININO" && form.passengerGenderPreference === "FEMININO" && (
                    <p className="text-sm text-gray-200">🌸 Apenas passageiras mulheres</p>
                  )}
                  {form.notes.trim() && (
                    <p className="text-sm text-gray-300">Observações: {form.notes}</p>
                  )}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 backdrop-blur-2xl">
                    <p className="font-semibold">
                      Percurso completo:{" "}
                      {quote?.distanceKm.toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      }) ?? "Cotação indisponível"}{" "}
                      km
                    </p>
                    <p className="mt-1 font-bold text-[#FFBB00]">
                      Preço de referência: {quote ? formatBrl(quote.pricePerPassenger) : "—"} por
                      pessoa
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      O preço de cada passageiro depende do seu trecho.
                    </p>
                  </div>
                  <p className="rounded-2xl border border-[#FFBB00]/25 bg-[#FFBB00]/10 p-3 text-sm text-gray-200">
                    Passageiros aceitam primeiro; você confirma depois quem vai viajar. Publicar a
                    oferta não confirma passageiros automaticamente.
                  </p>
                </div>
              )}
              {/* Dock flutuante de vidro */}
              <div className="sticky bottom-0 z-20 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-3xl border border-white/15 bg-[#121212]/95 p-3 shadow-2xl backdrop-blur-2xl sm:static sm:mt-2 sm:max-w-none sm:rounded-2xl sm:border-white/10 sm:bg-white/5 sm:backdrop-blur-0">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-gray-300 hover:bg-white/10 hover:text-white"
                    onClick={() => setStep((current) => current - 1)}
                  >
                    <ArrowLeft /> Voltar
                  </Button>
                ) : (
                  <div className="min-w-0 pl-2">
                    <p className="text-[10px] font-semibold text-gray-400">
                      Potencial com até {form.seats} {Number(form.seats) === 1 ? "vaga" : "vagas"}
                    </p>
                    <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-[#FFBB00]">
                      {potentialSavings != null
                        ? `Até ${formatBrl(potentialSavings)} (lotação total)`
                        : "—"}
                    </p>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={driverAllowed !== true || (step === 2 && (publishing || !quoteCurrent))}
                  className="min-h-14 flex-1 rounded-2xl bg-[#FFBB00] text-base font-bold text-[#121212] shadow-lg hover:bg-[#ffd04d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none sm:px-8"
                >
                  {step === 1 ? "Revisar carona" : publishing ? "Publicando..." : "Publicar Viagem"}{" "}
                  <ArrowRight size={18} />
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
