import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CalendarClock, CarFront, CheckCircle2, Clock3, Loader2, MapPin, Mic, Pencil, Users, Navigation } from "lucide-react";
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
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { departureAfterMinutes, isFutureOfferDeparture } from "@/lib/offer-driver-time";
import { TimeToleranceSelector, type TimeToleranceMinutes } from "@/components/caronaa/TimeToleranceSelector";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/oferecer")({
  validateSearch: z.object({
    origem: z.string().max(160).optional(), destino: z.string().max(160).optional(),
    data: z.string().optional(), horario: z.string().optional(),
    vagas: z.coerce.number().int().min(1).max(7).optional(),
    tolerancia: z.coerce.number().int().refine((n) => [5, 15, 30, 60].includes(n)).optional(),
    olat: z.coerce.number().min(-90).max(90).optional(), olng: z.coerce.number().min(-180).max(180).optional(),
    dlat: z.coerce.number().min(-90).max(90).optional(), dlng: z.coerce.number().min(-180).max(180).optional(),
  }),
  head: () => ({ meta: [
    { title: "Oferecer carona — CARONAA" },
    { name: "description", content: "Publique sua carona em uma única tela." },
  ] }),
  component: Oferecer,
});

type FormState = {
  origin: string; destination: string;
  originLocation?: FormLocationDetails; destinationLocation?: FormLocationDetails;
  date: string; time: string; seats: string; vehicle: string; notes: string;
  timeTolerance: TimeToleranceMinutes;
  passengerGenderPreference: "ANY" | "FEMININO" | "MASCULINO";
};
const glass = "rounded-3xl border border-white/10 bg-[#181818]/75 shadow-[0_16px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl";
const fieldStyle = "mt-1.5 h-12 w-full rounded-2xl border border-white/15 bg-white/[.06] px-4 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]";
const defaultForm: FormState = {
  origin: "", destination: "", date: "", time: "", seats: "2", vehicle: "", notes: "",
  timeTolerance: 15, passengerGenderPreference: "ANY",
};
type SpeechCandidate = { transcript: string };
type SpeechResults = { [index: number]: { [index: number]: SpeechCandidate } };
type SpeechRecognizer = {
  lang: string; interimResults: boolean;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognizer;
  webkitSpeechRecognition?: new () => SpeechRecognizer;
};
function Oferecer() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const publish = useServerFn(createRideOffer);
  const reverse = useServerFn(reverseGeocodeServerFn);
  const [mode, setMode] = useState<"point" | "routine">("point");
  const [routineSaved, setRoutineSaved] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultForm,
    origin: search.origem ?? "", destination: search.destino ?? "",
    date: search.data ?? "", time: search.horario ?? "",
    seats: String(Math.min(4, search.vagas ?? 2)),
    timeTolerance: (search.tolerancia ?? 15) as TimeToleranceMinutes,
    originLocation: search.olat != null && search.olng != null ? { rawText: search.origem ?? "", lat: search.olat, lng: search.olng } : undefined,
    destinationLocation: search.dlat != null && search.dlng != null ? { rawText: search.destino ?? "", lat: search.dlat, lng: search.dlng } : undefined,
  }));
  const [profilePlate, setProfilePlate] = useState("");
  const [vehicleEditing, setVehicleEditing] = useState(false);
  const [manualOrigin, setManualOrigin] = useState(Boolean(search.origem));
  const [gpsState, setGpsState] = useState<"loading" | "ready" | "manual">("loading");
  const [listening, setListening] = useState<"origin" | "destination" | null>(null);
  const speechRef = useRef<SpeechRecognizer | null>(null);
  const gpsSequence = useRef(0);
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [publishedOfferId, setPublishedOfferId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const [scheduleChoice, setScheduleChoice] = useState<"soon" | "later" | "custom">(
    search.data || search.horario ? "custom" : "soon",
  );
  const receiveQuote = useCallback((value: OfferQuote | null) => setQuote(value), []);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const setLocation = (kind: "origin" | "destination", value: string, details?: FormLocationDetails) => {
    setForm((prev) => ({ ...prev, [kind]: details?.formattedAddress || value, [kind === "origin" ? "originLocation" : "destinationLocation"]: details }));
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles")
        .select("vehicle_description, vehicle_brand, vehicle_plate").eq("id", auth.user.id).maybeSingle();
      if (!active || !data) return;
      setProfilePlate(data.vehicle_plate ?? "");
      const saved = [data.vehicle_brand, data.vehicle_description].filter(Boolean).join(" · ");
      setForm((prev) => prev.vehicle.trim() ? prev : { ...prev, vehicle: saved });
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (scheduleChoice === "soon" && !search.data && !search.horario) {
      const next = departureAfterMinutes(5);
      setForm((prev) => ({ ...prev, ...next }));
    }
  // Only initialise the default once. Quick actions recalculate with the current clock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setQuickDeparture = (minutes: number) => {
    setScheduleChoice(minutes === 5 ? "soon" : "later");
    setForm((prev) => ({ ...prev, ...departureAfterMinutes(minutes) }));
  };
  const locate = useCallback(() => {
    const sequence = ++gpsSequence.current;
    if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
      setGpsState("manual"); setManualOrigin(true); return;
    }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (sequence !== gpsSequence.current) return;
        const { latitude: lat, longitude: lng } = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setGpsState("manual"); setManualOrigin(true); return; }
        setGpsState("ready");
        setManualOrigin(false);
        const label = "Minha localização atual";
        setForm((prev) => ({
          ...prev, origin: label, originLocation: { rawText: label, formattedAddress: label, lat, lng },
        }));
        void reverse({ data: { lat, lng } }).then((address) => {
          if (sequence !== gpsSequence.current || !address) return;
          const neighborhood = address.neighborhood || address.city;
          const display = neighborhood ? `Minha localização atual (${neighborhood})` : label;
          setForm((prev) => ({
            ...prev, origin: display, originLocation: { ...address, rawText: display, formattedAddress: display, lat, lng },
          }));
        }).catch(() => undefined);
      },
      () => {
        if (sequence !== gpsSequence.current) return;
        setGpsState("manual"); setManualOrigin(true);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 3000 },
    );
  }, [reverse]);
  useEffect(() => {
    if (!search.origem) locate();
    return () => {
      gpsSequence.current += 1;
      speechRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enableManualOrigin = () => {
    gpsSequence.current += 1;
    setManualOrigin(true); setGpsState("manual");
  };
  const dictate = (kind: "origin" | "destination") => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { toast.info("Ditado indisponível neste navegador. Digite seu local."); enableManualOrigin(); return; }
    speechRef.current?.stop();
    try {
      const recognition = new Recognition();
      recognition.lang = "pt-BR"; recognition.interimResults = false;
      recognition.onresult = (event) => {
        const phrase = event.results[0]?.[0]?.transcript?.trim();
        if (phrase) {
          if (kind === "origin") enableManualOrigin();
          setLocation(kind, phrase);
        }
      };
      recognition.onerror = () => { setListening(null); toast.info("Não foi possível ouvir. Digite o endereço."); };
      recognition.onend = () => setListening(null);
      speechRef.current = recognition; setListening(kind); recognition.start();
    } catch {
      setListening(null);
      toast.info("Ditado indisponível. Digite o endereço.");
    }
  };
  const validQuote = Boolean(quote && quote.origin === form.origin && quote.destination === form.destination);
  const totalEstimate = validQuote && quote
    ? Math.round(quote.pricePerPassenger * Number(form.seats) * 100) / 100 : null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (publishingRef.current) return;
    if (!validQuote || !quote) { toast.error("Aguarde a cotação rodoviária do percurso."); return; }
    if (!isFutureOfferDeparture(form.date, form.time)) {
      toast.error("Escolha uma saída futura para publicar."); return;
    }
    if (!form.origin.trim() || !form.destination.trim() || form.origin === form.destination) {
      toast.error("Informe origem e destino diferentes."); return;
    }
    if (!form.vehicle.trim()) { setVehicleEditing(true); toast.error("Informe seu veículo antes de publicar."); return; }
    const seats = Number(form.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 4) { toast.error("Escolha entre 1 e 4 vagas."); return; }
    publishingRef.current = true; setPublishing(true);
    try {
      const result = await publish({ data: {
        origin: form.origin, destination: form.destination, quoteId: quote.quoteId,
        originLat: form.originLocation?.lat, originLng: form.originLocation?.lng,
        destinationLat: form.destinationLocation?.lat, destinationLng: form.destinationLocation?.lng,
        rideDate: form.date, departureTime: form.time, availableSeats: seats,
        timeToleranceMinutes: form.timeTolerance, passengerGenderPreference: form.passengerGenderPreference,
        preferences, idempotencyKey, vehicleDescription: form.vehicle, notes: form.notes,
      } });
      setPublishedOfferId(result.offerId);
      await navigate({ to: "/minha-carona/$offerId", params: { offerId: result.offerId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar sua carona.");
    } finally {
      publishingRef.current = false; setPublishing(false);
    }
  }
  return (
    <AppShell>
      <div className="relative isolate min-h-[85vh] bg-[#121212] px-4 pb-40 pt-5 font-sans text-white sm:px-6 sm:pt-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_0%,rgba(255,187,0,.07),transparent_42%),radial-gradient(ellipse_at_0%_65%,rgba(255,255,255,.035),transparent_46%)]" />
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link to="/home" className="mb-4 inline-flex items-center gap-2 text-xs text-[#A1A1AA] hover:text-white"><ArrowLeft size={15} /> Voltar ao início</Link>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.21em] text-[#FFBB00]">CARONAA DRIVER</p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Sua próxima carona.</h1>
              <p className="mt-2 text-sm text-[#A1A1AA]">Um trajeto, alguns toques. Compartilhe o caminho.</p>
            </div>
            <span className="mt-9 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><CarFront size={21} /></span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-2 [&_button]:text-white">
            <RideScheduleMode value={mode} onChange={setMode} />
          </div>
          {mode === "routine" ? (
            <section className={`${glass} p-5 [&_input]:text-white [&_label]:text-white`}>
              {routineSaved ? (
                <div className="space-y-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto text-[#FFBB00]" size={36} />
                  <h2 className="font-display text-xl">Rotina ativa</h2>
                  <Button asChild><Link to="/minhas-caronas">Ver minhas viagens <ArrowRight size={16} /></Link></Button>
                  <Button variant="outline" onClick={() => setRoutineSaved(false)}>Criar outra rotina</Button>
                </div>
              ) : (
                <RideRoutineForm kind="offer" initial={{
                  origin: form.origin, destination: form.destination,
                  originLat: form.originLocation?.lat ?? null, originLng: form.originLocation?.lng ?? null,
                  destinationLat: form.destinationLocation?.lat ?? null, destinationLng: form.destinationLocation?.lng ?? null,
                  departureTime: form.time || "07:30", seats: Number(form.seats),
                  totalPrice: 0, timeToleranceMinutes: form.timeTolerance,
                }} onSaved={() => setRoutineSaved(true)} />
              )}
            </section>
          ) : publishedOfferId ? (
            <div className={`${glass} space-y-4 p-8 text-center`}>
              <CheckCircle2 className="mx-auto text-[#FFBB00]" size={45} />
              <h2 className="font-display text-2xl font-bold">Carona publicada!</h2>
              <p className="text-sm text-[#A1A1AA]">Sua oferta está disponível. A publicação não confirma automaticamente passageiros.</p>
              <Button asChild><Link to="/minhas-caronas">Ver minhas caronas <ArrowRight size={16} /></Link></Button>
            </div>
          ) : (
            <form id="driver-offer-form" onSubmit={submit} className="space-y-5">
              <section className={`${glass} p-5 sm:p-6`} aria-labelledby="offer-route-heading">
                <h2 id="offer-route-heading" className="font-display text-base font-semibold">Para onde vamos?</h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">A rota será calculada pelas vias.</p>
                <div className="relative mt-6 pl-8">
                  <div aria-hidden="true" className="absolute bottom-[55px] left-[11px] top-4 w-[2px] rounded-full bg-gradient-to-b from-[#FFBB00] to-[#FFBB00]/30" />
                  <span aria-hidden="true" className={`absolute left-[5px] top-2 size-3 rounded-full border-2 border-[#FFBB00] bg-[#121212] ${gpsState === "ready" && !manualOrigin ? "motion-safe:animate-pulse" : ""}`} />
                  <div className="relative mb-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-[#A1A1AA]" htmlFor="oferecer-origem">Origem</label>
                      <div className="flex gap-1">
                        <button type="button" aria-label="Ditar origem" onClick={() => dictate("origin")} className={`rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-[#FFBB00] ${listening === "origin" ? "text-[#FFBB00]" : "text-[#A1A1AA] hover:text-white"}`}><Mic size={17} /></button>
                        <button type="button" aria-label="Digitar origem" onClick={enableManualOrigin} className="rounded-xl p-2 text-[#A1A1AA] hover:text-white focus-visible:ring-2 focus-visible:ring-[#FFBB00]"><Pencil size={17} /></button>
                      </div>
                    </div>
                    {!manualOrigin && gpsState !== "manual" ? (
                      <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.05] px-4 text-sm">
                        {gpsState === "loading" ? <Loader2 size={16} className="animate-spin text-[#FFBB00]" /> : <Navigation size={16} className="text-[#FFBB00]" />}
                        <span className="min-w-0 flex-1 truncate">{gpsState === "loading" ? "Localizando sua saída..." : form.origin}</span>
                      </div>
                    ) : (
                      <LocationAutocomplete id="oferecer-origem" value={form.origin} onChange={(value, details) => setLocation("origin", value, details)} placeholder="De onde você sai?" variant="simple" required />
                    )}
                    {gpsState === "manual" && <button type="button" onClick={locate} className="mt-2 text-xs text-[#A1A1AA] hover:text-[#FFBB00]">Usar minha localização</button>}
                  </div>
                  <span aria-hidden="true" className="absolute bottom-12 left-[4px] size-4 rounded-full bg-[#FFBB00] ring-4 ring-[#FFBB00]/15" />
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#A1A1AA]" htmlFor="oferecer-destino">Destino</label>
                    <LocationAutocomplete id="oferecer-destino" value={form.destination} onChange={(value, details) => setLocation("destination", value, details)} placeholder="Para onde você vai hoje?" variant="simple" required shortcutButton={<button type="button" onClick={() => dictate("destination")} aria-label="Ditar destino" className="rounded-xl p-2 text-[#A1A1AA] hover:text-white"><Mic size={17} /></button>} />
                  </div>
                </div>
              </section>
              <section className={`${glass} space-y-4 p-5 sm:p-6`}>
                <div className="flex items-center gap-2"><Clock3 size={18} className="text-[#FFBB00]" /><h2 className="font-display font-semibold">Quando você sai?</h2></div>
                <div className="grid grid-cols-3 gap-2">
                  {([{ label: "Agora +5", value: "soon", minutes: 5 }, { label: "Em 30 min", value: "later", minutes: 30 }, { label: "Escolher", value: "custom", minutes: 0 }] as const).map((option) => (
                    <button key={option.value} type="button" onClick={() => option.value === "custom" ? setScheduleChoice("custom") : setQuickDeparture(option.minutes)} aria-pressed={scheduleChoice === option.value}
                      className={`min-h-12 rounded-2xl border px-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#FFBB00] ${scheduleChoice === option.value ? "border-[#FFBB00]/65 bg-[#FFBB00]/15 text-[#FFBB00]" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>{option.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-[#A1A1AA]">Data<input aria-label="Data de saída" type="date" value={form.date} onChange={(event) => { setScheduleChoice("custom"); update("date", event.target.value); }} required className={fieldStyle} /></label>
                  <label className="text-xs font-medium text-[#A1A1AA]">Horário<input aria-label="Horário de saída" type="time" value={form.time} onChange={(event) => { setScheduleChoice("custom"); update("time", event.target.value); }} required className={fieldStyle} /></label>
                </div>
                <details className="border-t border-white/10 pt-3 text-sm text-[#A1A1AA]">
                  <summary className="cursor-pointer">Flexibilidade de horário</summary>
                  <div className="mt-3 text-white"><TimeToleranceSelector value={form.timeTolerance} onChange={(v) => update("timeTolerance", v)} baseTime={form.time} /></div>
                </details>
              </section>
              <section className={`${glass} space-y-4 p-5 sm:p-6`}>
                <div className="flex items-center gap-2"><Users size={18} className="text-[#FFBB00]" /><h2 className="font-display font-semibold">Lugares disponíveis</h2></div>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Número de vagas">
                  {[1,2,3,4].map((seats) => (
                    <button type="button" key={seats} aria-pressed={Number(form.seats) === seats} onClick={() => { if (navigator.vibrate) navigator.vibrate(8); update("seats", String(seats)); }}
                      className={`min-h-14 rounded-2xl border text-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#FFBB00] ${Number(form.seats) === seats ? "border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]" : "border-white/10 bg-white/[.05] text-white hover:bg-white/10"}`}>{seats}</button>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm"><CarFront size={18} className="shrink-0 text-[#A1A1AA]" /><span className="truncate">{form.vehicle || "Informe seu veículo"}{profilePlate ? ` · ${profilePlate}` : ""}</span></div>
                    <button type="button" className="shrink-0 text-xs font-semibold text-[#FFBB00]" onClick={() => setVehicleEditing((value) => !value)}>{vehicleEditing ? "Fechar" : "Trocar"}</button>
                  </div>
                  {(vehicleEditing || !form.vehicle) && <label className="mt-4 block text-xs text-[#A1A1AA]">Veículo desta viagem<input value={form.vehicle} onChange={(event) => update("vehicle", event.target.value)} placeholder="Ex.: Chevrolet Onix" className={fieldStyle} maxLength={160} required /></label>}
                </div>
              </section>
              {form.origin && form.destination && <div className="overflow-hidden rounded-3xl border border-white/10"><RouteMap origin={form.origin} destination={form.destination} originLocation={form.originLocation} destinationLocation={form.destinationLocation} showApproximateMetrics={false} showRouteDetails={false} heightClassName="min-h-44 sm:min-h-56" /></div>}
              <div className={`${glass} p-5 sm:p-6 [&_section]:border-white/10 [&_section]:text-white`}>
                <OfferFarePreview origin={form.origin} destination={form.destination} originLocation={form.originLocation} destinationLocation={form.destinationLocation} seats={Number(form.seats)} onQuote={receiveQuote} />
              </div>
              <details className={`${glass} p-5 text-sm`}>
                <summary className="cursor-pointer font-semibold text-white">Preferências e observações (opcional)</summary>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm text-[#A1A1AA]">Quem pode viajar?
                    <select value={form.passengerGenderPreference} onChange={(event) => update("passengerGenderPreference", event.target.value as FormState["passengerGenderPreference"])} className={fieldStyle}>
                      <option value="ANY">Todos os gêneros</option><option value="FEMININO">Somente mulheres</option><option value="MASCULINO">Somente homens</option>
                    </select>
                  </label>
                  <JourneyPreferences kind="offer" onChange={setPreferences} />
                  <label className="block text-sm text-[#A1A1AA]">Observações
                    <textarea value={form.notes} maxLength={500} rows={2} onChange={(event) => update("notes", event.target.value)} className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-white" />
                  </label>
                </div>
              </details>
              <p className="text-center text-xs text-[#A1A1AA]">O valor varia conforme o trecho de cada passageiro. Publicar não confirma passageiros automaticamente.</p>
            </form>
          )}
        </div>
        {mode === "point" && !publishedOfferId && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#121212]/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-15px_55px_rgba(0,0,0,.45)] backdrop-blur-2xl">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#A1A1AA]">Abatimento estimado</p>
                <p className="mt-1 truncate font-display text-xl font-bold text-[#FFBB00]">{totalEstimate == null ? "A calcular" : `Até ${formatBrl(totalEstimate)}`}</p>
                <p className="text-[10px] text-[#A1A1AA]">Todas as vagas ocupadas · percurso completo</p>
              </div>
              <button form="driver-offer-form" type="submit" disabled={publishing || !validQuote || !form.date || !form.time || !form.vehicle.trim()}
                className="flex h-14 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-[#FFBB00] px-4 font-display text-sm font-bold text-[#121212] transition hover:bg-[#ffd057] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-48">
                {publishing ? <><Loader2 size={18} className="animate-spin" /> Publicando</> : <>Publicar carona <ArrowRight size={17} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
