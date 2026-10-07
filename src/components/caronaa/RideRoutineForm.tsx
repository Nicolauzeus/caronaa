import { useId, useState, type FormEvent } from "react";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { TimeToleranceSelector } from "./TimeToleranceSelector";
import {
  localRideDate,
  routineDefinitionSchema,
  occurrenceDefinitionSchema,
  weekDays,
  type RoutineDefinition,
  type RoutineOccurrence,
} from "@/lib/ride-routines";
import { changeRoutineOccurrence, saveRideRoutine } from "@/lib/ride-routines-service";

type Props = {
  kind: "offer" | "request";
  initial?: Partial<RoutineDefinition> | undefined;
  routineId?: string | undefined;
  occurrence?: RoutineOccurrence | undefined;
  onSaved: () => void | Promise<void>;
};
export function RideRoutineForm({ kind, initial, routineId, occurrence, onSaved }: Props) {
  const id = useId();
  const [form, setForm] = useState<RoutineDefinition>({
    kind,
    origin: "",
    destination: "",
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
    days: [1, 3, 5],
    departureTime: "07:30",
    startDate: localRideDate(),
    endDate: null,
    seats: kind === "offer" ? 2 : 1,
    timeToleranceMinutes: 15,
    totalPrice: 30,
    active: true,
    ...initial,
    ...occurrence,
  });
  const [rideDate, setRideDate] = useState(occurrence?.rideDate || localRideDate());
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof RoutineDefinition>(key: K, value: RoutineDefinition[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (occurrence) {
        const changes = occurrenceDefinitionSchema.parse({ ...form, rideDate });
        await changeRoutineOccurrence(kind, occurrence.id, { ...occurrence, ...changes });
      } else await saveRideRoutine(routineDefinitionSchema.parse(form), routineId);
      toast.success(
        occurrence ? "Ocorrência atualizada." : routineId ? "Rotina atualizada." : "Rotina criada.",
      );
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o trajeto.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CalendarDays size={18} />
        {occurrence ? "Editar esta ocorrência" : routineId ? "Editar rotina" : "Trajeto recorrente"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationAutocomplete
          id={`${id}-origin`}
          label="Origem padrão"
          value={form.origin}
          variant="simple"
          required
          onChange={(value, details) =>
            setForm((current) => ({
              ...current,
              origin: details?.formattedAddress || value,
              originLat: details?.lat ?? null,
              originLng: details?.lng ?? null,
            }))
          }
        />
        <LocationAutocomplete
          id={`${id}-destination`}
          label="Destino padrão"
          value={form.destination}
          variant="simple"
          required
          onChange={(value, details) =>
            setForm((current) => ({
              ...current,
              destination: details?.formattedAddress || value,
              destinationLat: details?.lat ?? null,
              destinationLng: details?.lng ?? null,
            }))
          }
        />
      </div>
      {!occurrence && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Dias da semana</legend>
          <div className="flex flex-wrap gap-2">
            {weekDays.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.days.includes(day.value)}
                  onChange={(event) =>
                    update(
                      "days",
                      event.target.checked
                        ? [...form.days, day.value].sort()
                        : form.days.filter((value) => value !== day.value),
                    )
                  }
                  className="accent-primary"
                />
                {day.short}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span className="block">{occurrence ? "Data" : "A partir de"}</span>
          <Input
            type="date"
            required
            value={occurrence ? rideDate : form.startDate}
            min={occurrence || !routineId ? localRideDate() : undefined}
            onChange={(event) =>
              occurrence ? setRideDate(event.target.value) : update("startDate", event.target.value)
            }
          />
        </label>
        {!occurrence && (
          <label className="space-y-2 text-sm font-medium">
            <span className="block">Até (opcional)</span>
            <Input
              type="date"
              min={form.startDate}
              value={form.endDate || ""}
              onChange={(event) => update("endDate", event.target.value || null)}
            />
          </label>
        )}
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Horário {occurrence ? "" : "padrão"}</span>
          <Input
            type="time"
            required
            value={form.departureTime}
            onChange={(event) => update("departureTime", event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="block">
            {kind === "offer" ? "Vagas padrão" : "Assentos solicitados"}
          </span>
          <Input
            type="number"
            min={1}
            max={6}
            required
            value={form.seats}
            onChange={(event) => update("seats", Number(event.target.value))}
          />
        </label>
        {kind === "offer" && (
          <label className="space-y-2 text-sm font-medium">
            <span className="block">Valor total (R$)</span>
            <Input
              type="number"
              min={0}
              max={1000}
              step="0.01"
              required
              value={form.totalPrice}
              onChange={(event) => update("totalPrice", Number(event.target.value))}
            />
          </label>
        )}
      </div>
      <TimeToleranceSelector
        value={form.timeToleranceMinutes}
        baseTime={form.departureTime}
        onChange={(value) => update("timeToleranceMinutes", value)}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || (!occurrence && !form.days.length)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {occurrence || routineId ? "Salvar alterações" : "Ativar rotina"}
        </Button>
      </div>
    </form>
  );
}
export function RideScheduleMode({
  value,
  onChange,
}: {
  value: "point" | "routine";
  onChange: (value: "point" | "routine") => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        if (next === "point" || next === "routine") onChange(next);
      }}
      aria-label="Tipo de deslocamento"
      className="mb-5 justify-start"
    >
      <ToggleGroupItem value="point">Pontual</ToggleGroupItem>
      <ToggleGroupItem value="routine">Recorrente</ToggleGroupItem>
    </ToggleGroup>
  );
}
