import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CarFront,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
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

export const Route = createFileRoute("/_authenticated/oferecer")({
  validateSearch: z.object({
    origem: z.string().max(160).optional(),
    destino: z.string().max(160).optional(),
    data: z.string().optional(),
    horario: z.string().optional(),
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
  seats: "2",
  vehicle: "",
  notes: "",
  timeTolerance: 15,
  passengerGenderPreference: "ANY",
};
function Oferecer() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const publishOffer = useServerFn(createRideOffer);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"point" | "routine">("point");
  const [routineSaved, setRoutineSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [publishedOfferId, setPublishedOfferId] = useState<string | null>(null);
  const publishingRef = useRef(false);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [profilePlate, setProfilePlate] = useState("");
  const receiveQuote = useCallback((value: OfferQuote | null) => setQuote(value), []);
  const [form, setForm] = useState<OferecerFormState>(() => ({
    ...initial,
    origin: search.origem ?? "",
    destination: search.destino ?? "",
    date: search.data ?? "",
    time: search.horario ?? "",
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
        const savedVehicle = [data.vehicle_brand, data.vehicle_description].filter(Boolean).join(" · ");
        setForm((current) =>
          current.vehicle.trim()
            ? current
            : { ...current, vehicle: savedVehicle },
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const update = (key: keyof OferecerFormState, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const next = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!quote || quote.origin !== form.origin || quote.destination !== form.destination) {
        toast.error("Aguarde a cotação rodoviária do percurso ou tente novamente.");
        return;
      }
      setStep((current) => current + 1);
      return;
    }
    if (step === 2) {
      if (!quote || quote.origin !== form.origin || quote.destination !== form.destination) {
        toast.error("Aguarde o preço do percurso antes de publicar.");
        return;
      }
      if (publishingRef.current) return;
      publishingRef.current = true;
      setPublishing(true);
      try {
        const result = await publishOffer({
          data: {
            origin: form.origin,
            quoteId: quote.quoteId,
            destination: form.destination,
            originLat: form.originLocation?.lat,
            originLng: form.originLocation?.lng,
            destinationLat: form.destinationLocation?.lat,
            destinationLng: form.destinationLocation?.lng,
            rideDate: form.date,
            departureTime: form.time,
            availableSeats: Number(form.seats),
            timeToleranceMinutes: form.timeTolerance,
            passengerGenderPreference: form.passengerGenderPreference,
            preferences,
            idempotencyKey,
            vehicleDescription: form.vehicle,
            notes: form.notes,
          },
        });
        setPublishedOfferId(result.offerId);
        await navigate({ to: "/minha-carona/$offerId", params: { offerId: result.offerId } });
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
        <PageHeading
          eyebrow="COMPARTILHE SEU CAMINHO"
          title="Ofereça uma carona"
          description="Já vai fazer esse trajeto? Abra espaço para quem está indo na mesma direção."
        />
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
        ) : (
          <>
            <div className="mb-8 flex items-center gap-3">
              {[1, 2].map((n) => (
                <div key={n} className="flex flex-1 items-center gap-2">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step >= n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {step > n ? <Check size={15} /> : n}
                  </span>
                  <span
                    className={`hidden text-xs font-semibold sm:block ${step >= n ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {["Publicar", "Revisão"][n - 1]}
                  </span>
                  {n < 2 && <span className="ml-auto h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>
            {publishedOfferId ? (
              <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-soft">
                <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
                  <CheckCircle2 size={34} />
                </span>
                <h2 className="font-display text-2xl font-extrabold">Carona publicada!</h2>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  Seu trajeto de {form.origin} para {form.destination} está publicado. Você receberá
                  solicitações e poderá confirmar quem vai viajar. Publicar não confirma
                  automaticamente nenhuma combinação.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link to="/minhas-caronas">
                      Ver minhas caronas <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
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
              <form
                onSubmit={next}
                className="rounded-lg border border-border bg-card p-5 shadow-soft md:p-8"
              >
                <div className="mb-7 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                    {step === 1 ? <MapPin /> : <CheckCircle2 />}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-extrabold">
                      {step === 1 ? "Para onde você vai e quando sai?" : "Revise sua carona"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {step === 1
                        ? "Informe o trajeto e o horário da sua viagem."
                        : step === 2
                          ? "Veículo e preferências podem vir do seu perfil e ser ajustados nesta viagem."
                          : "Confira o trajeto, as vagas e a estimativa antes de publicar."}
                    </p>
                  </div>
                </div>
                {step === 1 ? (
                  <div className="space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <LocationAutocomplete
                        id="oferecer-origem"
                        label="Origem"
                        value={form.origin}
                        onChange={(v, details) =>
                          setForm((prev) => ({
                            ...prev,
                            origin: details?.formattedAddress || v,
                            originLocation: details,
                          }))
                        }
                        placeholder="Ex.: Aldeota, Fortaleza"
                        required
                        variant="simple"
                      />
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
                        variant="simple"
                      />
                      <Field
                        label="Data"
                        value={form.date}
                        onChange={(v) => update("date", v)}
                        type="date"
                        required
                      />
                      <Field
                        label="Horário de saída"
                        value={form.time}
                        onChange={(v) => update("time", v)}
                        type="time"
                        required
                      />
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-semibold">
                        Vagas disponíveis
                        <select
                          value={form.seats}
                          onChange={(event) => update("seats", event.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3"
                        >
                          {[1, 2, 3, 4].map((count) => (
                            <option key={count}>{count}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label="Veículo desta viagem"
                        value={form.vehicle}
                        onChange={(value) => update("vehicle", value)}
                        placeholder="Ex.: Honda Fit, prata"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profilePlate ? `Placa cadastrada: ${profilePlate}. ` : ""}
                      <Link to="/perfil" className="font-semibold text-primary underline">Meu veículo no perfil</Link>
                    </p>
                    <OfferFarePreview
                      origin={form.origin}
                      destination={form.destination}
                      seats={Number(form.seats)}
                      onQuote={receiveQuote}
                    />
                    <details>
                      <summary className="cursor-pointer py-2 text-sm font-semibold">
                        Preferências e observações (opcional)
                      </summary>
                      <div className="mt-3 space-y-4">
                        <label className="block text-sm font-semibold">
                          Quem pode viajar?
                          <select
                            value={form.passengerGenderPreference}
                            onChange={(event) =>
                              setForm((previous) => ({
                                ...previous,
                                passengerGenderPreference: event.target
                                  .value as OferecerFormState["passengerGenderPreference"],
                              }))
                            }
                            className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3"
                          >
                            <option value="ANY">Todos os gêneros</option>
                            <option value="FEMININO">Somente mulheres</option>
                            <option value="MASCULINO">Somente homens</option>
                          </select>
                        </label>
                        <JourneyPreferences kind="offer" onChange={setPreferences} />
                        <label className="block text-sm font-semibold">
                          Observações (opcional)
                          <textarea
                            value={form.notes}
                            onChange={(event) => update("notes", event.target.value)}
                            rows={2}
                            className="mt-2 w-full rounded-md border border-input bg-background p-3"
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                ) : step === 99 ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Vagas disponíveis
                      <select
                        value={form.seats}
                        onChange={(e) => update("seats", e.target.value)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option>1</option>
                        <option>2</option>
                        <option>3</option>
                        <option>4</option>
                      </select>
                    </label>
                    <Field
                      label="Veículo desta viagem"
                      value={form.vehicle}
                      onChange={(v) => update("vehicle", v)}
                      placeholder="Ex.: Honda Fit, prata"
                      required
                    />
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Veículo preenchido pelo seu perfil. Você pode alterar apenas para esta viagem.
                    </p>
                    <details className="sm:col-span-2">
                      <summary className="cursor-pointer py-2 text-sm font-semibold">
                        Preferências e observações (opcional)
                      </summary>
                      <div className="mt-3 space-y-4">
                        <label className="block text-sm font-semibold">
                          Quem pode viajar?
                          <select
                            value={form.passengerGenderPreference}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passengerGenderPreference: e.target
                                  .value as OferecerFormState["passengerGenderPreference"],
                              }))
                            }
                            className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="ANY">Todos os gêneros</option>
                            <option value="FEMININO">Somente mulheres</option>
                            <option value="MASCULINO">Somente homens</option>
                          </select>
                        </label>
                        <JourneyPreferences kind="offer" onChange={setPreferences} />
                        <label className="block text-sm font-semibold">
                          Observações (opcional)
                          <textarea
                            value={form.notes}
                            onChange={(e) => update("notes", e.target.value)}
                            placeholder="Algo importante para os passageiros?"
                            rows={2}
                            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-secondary/60 p-4">
                      <p className="font-semibold">{form.origin || "Origem pendente"}</p>
                      <ArrowRight className="my-2 rotate-90 text-primary" size={18} />
                      <p className="font-semibold">{form.destination || "Destino pendente"}</p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {form.date
                          ? new Date(`${form.date}T12:00:00`).toLocaleDateString("pt-BR")
                          : "Data pendente"}{" "}
                        · {form.time || "Horário pendente"}
                        {form.timeTolerance ? ` · tolerância de ${form.timeTolerance} min` : ""}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        {form.seats} {Number(form.seats) === 1 ? "vaga" : "vagas"}
                      </p>
                      <p>{form.vehicle || "Veículo pendente"}</p>
                    </div>
                    {form.notes.trim() && (
                      <p className="text-sm text-muted-foreground">Observações: {form.notes}</p>
                    )}
                    <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
                      <p className="font-semibold">
                        Percurso completo:{" "}
                        {quote?.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) ??
                          "Cotação indisponível"}{" "}
                        km
                      </p>
                      <p className="mt-1 font-bold text-primary">
                        Preço de referência: {quote ? formatBrl(quote.pricePerPassenger) : "—"} por
                        pessoa
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        O preço de cada passageiro depende do seu trecho.
                      </p>
                    </div>
                    <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                      Passageiros aceitam primeiro; você confirma depois quem vai viajar. Publicar a
                      oferta não confirma passageiros automaticamente.
                    </p>
                  </div>
                )}
                <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                  {step > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep((current) => current - 1)}
                    >
                      <ArrowLeft /> Voltar
                    </Button>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays size={15} /> Planeje seu trajeto
                    </span>
                  )}
                  <Button
                    type="submit"
                    className="h-11 px-6"
                    disabled={
                      step === 2 &&
                      (publishing ||
                        !quote ||
                        quote.origin !== form.origin ||
                        quote.destination !== form.destination)
                    }
                  >
                    {step === 1
                      ? "Revisar carona"
                      : publishing
                        ? "Publicando..."
                        : "Publicar carona"}{" "}
                    <ArrowRight />
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0" : undefined}
        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
