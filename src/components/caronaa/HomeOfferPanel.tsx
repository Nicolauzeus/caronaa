import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bike, CarFront, CalendarDays, Minus, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createRideOffer } from "@/lib/ride-matching.functions";
import { OfferFarePreview, type OfferQuote } from "./OfferFarePreview";
import { RoutePolicySelector } from "./RoutePolicySelector";
import { JourneyPreferences } from "./TravelPreferences";
import { TimeToleranceSelector, type TimeToleranceMinutes } from "./TimeToleranceSelector";
import { WomenOnlyToggle } from "./WomenOnlyToggle";
import { RideRoutineForm } from "./RideRoutineForm";
import { useProfileGender } from "@/lib/use-profile-gender";
import type { FormLocationDetails } from "@/lib/location/types";
import type { TravelPreferences } from "@/lib/travel-preferences";
import type { RideIntentDraft } from "@/lib/ride-intent-draft";
import { formatBrl } from "@/lib/ride-cost";

type Vehicle = "CAR" | "MOTO";
type OfferDraft = NonNullable<RideIntentDraft["offer"]>;
type Step = "DETAILS" | "REVIEW" | "SUCCESS";
export type HomeOfferPanelHandle = { next: () => void };
export type HomeOfferPanelStatus = {
  step: Step; busy: boolean; canContinue: boolean; driverAllowed: boolean | null;
  routine: boolean;
};
type Props = {
  origin: string;
  destination: string;
  originLocation?: FormLocationDetails;
  destinationLocation?: FormLocationDetails;
  date: string;
  time: string;
  tolerance: TimeToleranceMinutes;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onToleranceChange: (value: TimeToleranceMinutes) => void;
  initialDraft?: RideIntentDraft["offer"];
  initialVehicle?: Vehicle;
  onDraftChange: (value: OfferDraft) => void;
  onStatusChange: (value: HomeOfferPanelStatus) => void;
  onPublished: () => void;
};
function nextDeparture() {
  const next = new Date(Date.now() + 60_000);
  return {
    date: next.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }),
    time: next.toLocaleTimeString("en-GB", {
      timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", hour12: false,
    }),
  };
}

/** Offer workflow sharing HOME's map, route inputs, sheet, header and action dock.
 * Only driver-specific steps change. The existing priced-offer server RPC remains
 * the authority for eligibility, quote, price and idempotent publication.
 */
export const HomeOfferPanel = forwardRef<HomeOfferPanelHandle, Props>(function HomeOfferPanel({
  origin, destination, originLocation, destinationLocation, date, time, tolerance,
  onDateChange, onTimeChange, onToleranceChange, initialDraft, initialVehicle = "CAR",
  onDraftChange, onStatusChange, onPublished,
}, ref) {
  const publishOffer = useServerFn(createRideOffer);
  const gender = useProfileGender();
  const [vehicleType, setVehicleType] = useState<Vehicle>(initialDraft?.vehicleType ?? initialVehicle);
  const [seats, setSeats] = useState(initialDraft?.vehicleType === "MOTO" || (!initialDraft?.vehicleType && initialVehicle === "MOTO")
    ? 1 : (initialDraft?.seats ?? 3));
  const [vehicle, setVehicle] = useState(initialDraft?.vehicle ?? "");
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [allowDetours, setAllowDetours] = useState(initialDraft?.allowDetours ?? false);
  const [scheduleMode, setScheduleMode] = useState<"point" | "routine">(initialDraft?.scheduleMode ?? "point");
  const [departureMode, setDepartureMode] = useState<"now" | "schedule">(initialDraft?.departureMode ?? "schedule");
  const [driverAllowed, setDriverAllowed] = useState<boolean | null>(null);
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const [womenOnly, setWomenOnly] = useState(initialDraft?.womenOnly ?? false);
  const [step, setStep] = useState<Step>("DETAILS");
  const [busy, setBusy] = useState(false);
  const [routineSaved, setRoutineSaved] = useState(false);
  const [offerId, setOfferId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const publishingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (supabase as any).rpc("get_my_driver_platform_fees")
      .then(({ data, error }: { data: { driverAllowed?: boolean } | null; error: unknown }) => {
        if (active) setDriverAllowed(!error && data?.driverAllowed === true);
      }).catch(() => { if (active) setDriverAllowed(false); });
    void supabase.auth.getUser().then(async ({data}) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles")
        .select("vehicle_brand,vehicle_description").eq("id",data.user.id).maybeSingle();
      if (!active || !profile) return;
      const saved = [profile.vehicle_brand,profile.vehicle_description].filter(Boolean).join(" · ");
      if (saved) setVehicle(current => current.trim() ? current : saved);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    onDraftChange({vehicleType, womenOnly, vehicle, seats, notes, allowDetours, scheduleMode, departureMode});
  }, [vehicleType, womenOnly, vehicle, seats, notes, allowDetours, scheduleMode, departureMode, onDraftChange]);

  // No previous confirmation or price is transferable to a changed route.
  useEffect(() => { setStep(current => current === "SUCCESS" ? current : "DETAILS"); },
    [origin, destination, originLocation?.lat, originLocation?.lng,
      destinationLocation?.lat, destinationLocation?.lng, vehicleType]);
  const currentQuote = quote?.origin === origin && quote?.destination === destination ? quote : null;
  const originReady = Boolean(origin.trim() && originLocation?.lat != null && originLocation?.lng != null);
  const destinationReady = Boolean(destination.trim() && destinationLocation?.lat != null && destinationLocation?.lng != null);
  const canContinue = driverAllowed === true && Boolean(vehicle.trim()) &&
    Boolean(currentQuote) && originReady && destinationReady &&
    Boolean(date && time) && (vehicleType === "MOTO" ? seats === 1 : seats >= 1 && seats <= 4);

  const next = useCallback(async () => {
    if (busy || publishingRef.current) return;
    if (step === "SUCCESS") {
      setStep("DETAILS");setOfferId("");setQuote(null);setIdempotencyKey(crypto.randomUUID());
      return;
    }
    if (scheduleMode === "routine") return;
    if (!canContinue || !currentQuote) {
      toast.error(driverAllowed !== true
        ? "Verifique sua autorização e os repasses da plataforma."
        : "Confira o veículo, trajeto, data, horário e a cotação antes de continuar.");
      return;
    }
    if (step === "DETAILS") { setStep("REVIEW"); return; }
    publishingRef.current = true;setBusy(true);
    try {
      const departure = departureMode === "now" ? nextDeparture() : {date,time};
      const result = await publishOffer({ data: {
        origin, destination,
        originLat:originLocation?.lat, originLng:originLocation?.lng,
        destinationLat:destinationLocation?.lat, destinationLng:destinationLocation?.lng,
        quoteId: currentQuote.quoteId,
        rideDate:departure.date, departureTime:departure.time,
        timeToleranceMinutes:tolerance,
        availableSeats:vehicleType==="MOTO" ? 1 : seats,
        vehicleType,vehicleDescription:vehicle.trim(),
        passengerGenderPreference:gender==="FEMININO"&&womenOnly?"FEMININO":"ANY",
        allowDetours,preferences,notes:notes.trim(),idempotencyKey,
      }});
      setOfferId(result.offerId);setStep("SUCCESS");onPublished();
      toast.success("Sua oferta de carona foi publicada.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Falha ao publicar sua oferta.");
    } finally { publishingRef.current = false;setBusy(false); }
  }, [allowDetours,busy,canContinue,currentQuote,date,departureMode,destination,
    destinationLocation?.lat,destinationLocation?.lng,driverAllowed,gender,idempotencyKey,
    notes,onPublished,origin,originLocation?.lat,originLocation?.lng,preferences,publishOffer,
    scheduleMode,seats,step,time,tolerance,vehicle,vehicleType,womenOnly]);

  useImperativeHandle(ref, () => ({ next }), [next]);
  useEffect(() => {
    onStatusChange({step,busy,canContinue,driverAllowed,routine:scheduleMode==="routine"});
  }, [step,busy,canContinue,driverAllowed,scheduleMode,onStatusChange]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-3 pt-2 text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200" data-testid="home-offer-flow">
      {step === "SUCCESS" ? (
        <div role="status" className="space-y-3 rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-4 text-center">
          <CheckCircle2 className="mx-auto text-[#FFBB00]" size={32}/>
          <h3 className="text-lg font-bold">Carona publicada!</h3>
          <p className="text-sm text-gray-200">A oferta foi publicada. Os passageiros solicitam e você confirma.</p>
          <Link to="/minha-carona/$offerId" params={{offerId}}
            className="inline-flex min-h-11 items-center rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">
            Acompanhar oferta
          </Link>
        </div>
      ) : (
        <>
          {driverAllowed === false && (
            <p role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm">
              Ofertas indisponíveis para esta conta. Confira o cadastro de veículo e os repasses pendentes no{" "}
              <Link to="/perfil" className="font-bold text-[#FFBB00] underline">Perfil</Link>.
            </p>
          )}
          {step === "REVIEW" ? (
            <div className="space-y-3 rounded-2xl border border-[#FFBB00]/35 bg-[#FFBB00]/5 p-4">
              <h3 className="font-bold text-[#FFBB00]">Revise sua oferta</h3>
              <p className="break-words text-sm">{origin} → {destination}</p>
              <p className="text-sm">{date} · {time} · {vehicleType==="MOTO"?"Moto":"Carro"} · {seats} {seats===1?"vaga":"vagas"}</p>
              <p className="text-sm">Contribuição de referência: {currentQuote ? formatBrl(currentQuote.pricePerPassenger) : "indisponível"} por vaga.</p>
              <p className="text-xs text-gray-300">{allowDetours?"Aceitar pequenos desvios":"Rota estrita"} · Publicar não confirma automaticamente passageiros.</p>
              <button type="button" onClick={()=>setStep("DETAILS")}
                className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-semibold">
                Editar oferta
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Tipo de veículo</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["CAR","Carro",CarFront],["MOTO","Moto",Bike],
                    ] as const).map(([kind,label,Icon]) => (
                      <button type="button" key={kind} aria-pressed={vehicleType===kind}
                        onClick={() => {
                          setVehicleType(kind);
                          setSeats(kind==="MOTO"?1:Math.max(1,Math.min(4,seats)));
                        }}
                        className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors ${vehicleType===kind
                          ? "border-[#FFBB00] bg-[#FFBB00] text-[#121212]"
                          : "border-white/20 bg-white/5 text-white"}`}>
                        <Icon size={18}/>{label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-3 block text-sm font-semibold">
                  Veículo desta oferta
                  <input aria-label="Veículo desta oferta" value={vehicle} required
                    onChange={e=>setVehicle(e.target.value.slice(0,160))}
                    placeholder={vehicleType==="MOTO"?"Ex.: Honda Biz":"Ex.: Honda Fit, prata"}
                    className="mt-1 h-12 w-full min-w-0 rounded-xl border border-white/20 bg-[#121212] px-3 text-white"/>
                </label>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Vagas disponíveis</p>
                  {vehicleType==="MOTO" ? <span className="font-bold text-[#FFBB00]">1 vaga · capacete extra</span> : (
                    <div className="flex items-center gap-2 rounded-xl border border-white/20">
                      <button type="button" aria-label="Diminuir vagas oferecidas" disabled={seats<=1}
                        onClick={()=>setSeats(v=>Math.max(1,v-1))} className="flex size-11 items-center justify-center disabled:opacity-40"><Minus size={16}/></button>
                      <span aria-label="Vagas oferecidas" className="font-bold">{seats}</span>
                      <button type="button" aria-label="Aumentar vagas oferecidas" disabled={seats>=4}
                        onClick={()=>setSeats(v=>Math.min(4,v+1))} className="flex size-11 items-center justify-center disabled:opacity-40"><Plus size={16}/></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold">Quando vai sair?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={departureMode==="now"}
                    onClick={()=>{
                      setDepartureMode("now");
                      const next=nextDeparture();onDateChange(next.date);onTimeChange(next.time);
                    }}
                    className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${departureMode==="now"
                      ?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/20"}`}>
                    Sair agora
                  </button>
                  <button type="button" aria-pressed={departureMode==="schedule"}
                    onClick={()=>setDepartureMode("schedule")}
                    className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${departureMode==="schedule"
                      ?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/20"}`}>
                    Agendar
                  </button>
                </div>
                {departureMode==="schedule" && (
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
                    <label className="min-w-0 text-xs font-semibold">
                      Data
                      <input type="date" aria-label="Data da oferta" value={date} onChange={e=>onDateChange(e.target.value)}
                        className="mt-1 h-11 w-full min-w-0 rounded-xl border border-white/20 bg-[#121212] px-2 [color-scheme:dark]"/>
                    </label>
                    <label className="min-w-0 text-xs font-semibold">
                      Horário
                      <input type="time" aria-label="Horário da oferta" value={time} onChange={e=>onTimeChange(e.target.value)}
                        className="mt-1 h-11 w-full min-w-0 rounded-xl border border-white/20 bg-[#121212] px-2 [color-scheme:dark]"/>
                    </label>
                  </div>
                )}
                <div className="mt-3">
                  <TimeToleranceSelector value={tolerance} onChange={onToleranceChange}
                    baseTime={time} label="Flexibilidade da saída"/>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <RoutePolicySelector allowDetours={allowDetours} onChange={setAllowDetours}/>
                <WomenOnlyToggle gender={gender} kind="offer" checked={womenOnly}
                  onChange={setWomenOnly}/>
                <details>
                  <summary className="min-h-10 cursor-pointer text-sm font-semibold">Preferências e observações (opcional)</summary>
                  <JourneyPreferences kind="offer" onChange={setPreferences}/>
                  <label className="block text-sm font-semibold">Observações
                    <textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,500))}
                      rows={2} placeholder="Informações para os passageiros"
                      className="mt-1 w-full rounded-xl border border-white/20 bg-[#121212] p-3"/>
                  </label>
                </details>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <OfferFarePreview origin={origin} destination={destination}
                  seats={vehicleType==="MOTO"?1:seats} onQuote={setQuote}/>
              </div>
              <details open={scheduleMode === "routine"}
                onToggle={(event) => setScheduleMode(event.currentTarget.open ? "routine" : "point")}
                className="rounded-xl border border-white/10 p-3">
                <summary className="cursor-pointer text-sm font-semibold"><CalendarDays size={15} className="mr-2 inline"/>Oferta recorrente</summary>
                <div className="pt-3">
                  <RideRoutineForm kind="offer" initial={{
                    origin,destination,
                    originLat:originLocation?.lat??null,originLng:originLocation?.lng??null,
                    destinationLat:destinationLocation?.lat??null,destinationLng:destinationLocation?.lng??null,
                    departureTime:time||"07:30",seats:vehicleType==="MOTO"?1:seats,
                    timeToleranceMinutes:tolerance,totalPrice:0,
                  }} onSaved={()=>{setRoutineSaved(true);toast.success("Rotina de oferta salva.");}}/>
                  {routineSaved && <p role="status" className="mt-2 text-xs text-[#FFBB00]">Rotina salva.</p>}
                </div>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
});
