import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getRideRoutines,
  setRideRoutineActive,
  changeRoutineOccurrence,
} from "@/lib/ride-routines-service";
import { weekDays, type RideRoutine, type RoutineOccurrence } from "@/lib/ride-routines";
import { RideRoutineForm } from "./RideRoutineForm";

export function RideRoutineManager({ onChanged }: { onChanged: () => Promise<void> }) {
  const [routines, setRoutines] = useState<RideRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    kind: "offer" | "request";
    routine?: RideRoutine;
    occurrence?: RoutineOccurrence;
  } | null>(null);
  const [cancel, setCancel] = useState<{
    kind: "offer" | "request";
    occurrence: RoutineOccurrence;
  } | null>(null);
  const [kind, setKind] = useState<"offer" | "request">("offer");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRoutines(await getRideRoutines());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as rotinas.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function changed() {
    setEdit(null);
    await load();
    await onChanged();
  }
  async function toggle(routine: RideRoutine, active: boolean) {
    setBusy(true);
    try {
      await setRideRoutineActive(routine.id, active);
      await load();
      await onChanged();
      toast.success(active ? "Rotina ativada." : "Rotina desativada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar a rotina.");
    } finally {
      setBusy(false);
    }
  }
  async function cancelOccurrence() {
    if (!cancel) return;
    setBusy(true);
    try {
      await changeRoutineOccurrence(cancel.kind, cancel.occurrence.id);
      setCancel(null);
      await load();
      await onChanged();
      toast.success("Ocorrência cancelada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar a ocorrência.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Rotinas da semana</h2>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Atualizar rotinas"
            title="Atualizar rotinas"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </Button>
          <Button onClick={() => setEdit({ kind })}>
            <Plus size={16} />
            Nova rotina
          </Button>
        </div>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={kind}
        onValueChange={(value) => {
          if (value === "offer" || value === "request") setKind(value);
        }}
        className="justify-start"
        aria-label="Papel na rotina"
      >
        <ToggleGroupItem value="offer">Motorista</ToggleGroupItem>
        <ToggleGroupItem value="request">Passageiro</ToggleGroupItem>
      </ToggleGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando rotinas…
        </p>
      )}
      {!loading && !error && !routines.filter((r) => r.kind === kind).length && (
        <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
          Nenhuma rotina cadastrada para este perfil.
        </p>
      )}
      {!loading &&
        !error &&
        routines
          .filter((r) => r.kind === kind)
          .map((routine) => (
            <article key={routine.id} className="space-y-3 border-y border-border py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Recorrente</Badge>
                    <span className="text-xs text-muted-foreground">
                      {routine.active ? "Ativa" : "Desativada"}
                    </span>
                  </div>
                  <h3 className="mt-2 break-words font-semibold">
                    {routine.origin} → {routine.destination}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {weekDays
                      .filter((day) => routine.days.includes(day.value))
                      .map((day) => day.short)
                      .join(", ")}{" "}
                    · {routine.departureTime} · {routine.seats}{" "}
                    {routine.kind === "offer" ? "vagas" : "assentos"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={routine.active}
                    disabled={busy}
                    aria-label={`Ativar rotina ${routine.origin}`}
                    onCheckedChange={(active) => void toggle(routine, active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar rotina"
                    title="Editar rotina"
                    disabled={busy}
                    onClick={() => setEdit({ kind: routine.kind, routine })}
                  >
                    <Pencil size={16} />
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(expanded === routine.id ? null : routine.id)}
              >
                {expanded === routine.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Ocorrências futuras ({routine.occurrences.length})
              </Button>
              {expanded === routine.id && (
                <div className="divide-y divide-border">
                  {!routine.occurrences.length && (
                    <p className="py-3 text-sm text-muted-foreground">
                      Nenhuma ocorrência futura neste período.
                    </p>
                  )}
                  {routine.occurrences.map((occurrence) => (
                    <div
                      key={occurrence.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 text-sm">
                        <p>
                          {new Date(`${occurrence.rideDate}T12:00:00-03:00`).toLocaleDateString(
                            "pt-BR",
                          )}{" "}
                          · {occurrence.departureTime} · {occurrence.seats} assentos
                        </p>
                        <p className="break-words text-xs text-muted-foreground">
                          {occurrence.origin} → {occurrence.destination}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(
                            {
                              available: "Disponível",
                              full: "Lotada",
                              open: "Pendente",
                              matched: "Com match",
                              cancelled: "Cancelada",
                            } as Record<string, string>
                          )[occurrence.status] || occurrence.status}
                          {occurrence.overridden ? " · alteração individual" : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar esta ocorrência"
                          title={
                            occurrence.canEdit
                              ? "Editar esta ocorrência"
                              : "Ocorrência reservada ou cancelada"
                          }
                          disabled={busy || !occurrence.canEdit}
                          onClick={() => setEdit({ kind: routine.kind, occurrence })}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Cancelar esta ocorrência"
                          title="Cancelar esta ocorrência"
                          disabled={busy || !occurrence.canCancel}
                          onClick={() => setCancel({ kind: routine.kind, occurrence })}
                        >
                          <X size={15} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.occurrence ? "Ocorrência" : "Rotina semanal"}</DialogTitle>
            <DialogDescription>
              {edit?.kind === "offer" ? "Motorista" : "Passageiro"}
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <RideRoutineForm
              kind={edit.kind}
              initial={edit.routine}
              routineId={edit.routine?.id}
              occurrence={edit.occurrence}
              onSaved={changed}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancel} onOpenChange={(open) => !busy && !open && setCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar esta ocorrência?</DialogTitle>
            <DialogDescription>
              Somente a saída de {cancel?.occurrence.rideDate} às {cancel?.occurrence.departureTime}{" "}
              será cancelada, incluindo as caronas vinculadas. As outras datas permanecem na rotina.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setCancel(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void cancelOccurrence()}>
              Cancelar ocorrência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
