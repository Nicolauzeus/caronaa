import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MapPin, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getCurrentRidePosition, type RideSafety } from "@/lib/ride-safety";
import {
  getRideSafety,
  rateRide,
  updateRideLocation,
  validateRideBoarding,
} from "@/lib/ride-safety-service";

export function RideSafetyPanel({
  rideId,
  role,
  viewerUserId,
  status,
  onChanged,
}: {
  rideId: string;
  role: "driver" | "passenger" | "available";
  viewerUserId: string;
  status: string;
  onChanged: () => Promise<void>;
}) {
  const [safety, setSafety] = useState<RideSafety | null>(null);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getRideSafety(rideId);
        if (active) {
          setSafety(next);
          setError("");
          setClock(Date.now());
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar a segurança da viagem.",
          );
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [rideId, status]);
  const currentStatus = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)
    ? status
    : (safety?.status ?? status);
  useEffect(() => {
    if (!sharing || currentStatus !== "IN_PROGRESS") return;
    let active = true;
    let pending = false;
    const publish = async () => {
      if (pending) return;
      pending = true;
      try {
        const position = await getCurrentRidePosition();
        if (!active) return;
        await updateRideLocation(rideId, position);
        const next = await getRideSafety(rideId);
        if (active) {
          setSafety(next);
          setGpsError("");
          setClock(Date.now());
        }
      } catch (e) {
        if (active) {
          setGpsError(e instanceof Error ? e.message : "Não foi possível atualizar a localização.");
          setSharing(false);
        }
      } finally {
        pending = false;
      }
    };
    void publish();
    const timer = window.setInterval(() => void publish(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sharing, currentStatus, rideId]);
  useEffect(() => {
    if (currentStatus !== "IN_PROGRESS") setSharing(false);
  }, [currentStatus]);

  async function board(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await validateRideBoarding(rideId, pin);
      setPin("");
      setSafety(await getRideSafety(rideId));
      toast.success("Embarque validado. Viagem iniciada.");
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível validar o embarque.");
    } finally {
      setBusy(false);
    }
  }
  async function rate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await rateRide(rideId, score, comment);
      setSafety(await getRideSafety(rideId));
      toast.success("Avaliação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a avaliação.");
    } finally {
      setBusy(false);
    }
  }
  const locations = currentStatus === "IN_PROGRESS" ? safety?.locations || [] : [];
  const location = locations.find((l) => l.userId !== viewerUserId) || locations[0];
  return (
    <section
      aria-label="Segurança da viagem"
      className="mt-4 space-y-4 border-t border-border pt-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck size={16} />
        Segurança da viagem
      </h3>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!safety && !error && (
        <p role="status" className="text-xs text-muted-foreground">
          Carregando…
        </p>
      )}
      {currentStatus === "CONFIRMED" && role === "passenger" && safety?.pin && (
        <div>
          <p className="text-xs text-muted-foreground">PIN de embarque</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{safety.pin}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Informe ao motorista quando estiver no veículo.
          </p>
        </div>
      )}
      {currentStatus === "CONFIRMED" && role === "driver" && (
        <form onSubmit={board} className="space-y-2">
          <label className="block text-sm" htmlFor={`boarding-${rideId}`}>
            PIN do passageiro
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`boarding-${rideId}`}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{8}"
              maxLength={8}
              required
              placeholder="8 dígitos"
              className="min-w-0 flex-1 basis-32 font-mono"
            />
            <Button type="submit" disabled={busy || pin.length !== 8 || !safety || !!error}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Validar e iniciar
            </Button>
          </div>
        </form>
      )}
      {safety?.boardedAt && (
        <p className="text-xs text-muted-foreground">
          Embarque validado em {new Date(safety.boardedAt).toLocaleString("pt-BR")}
        </p>
      )}
      {currentStatus === "IN_PROGRESS" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`tracking-${rideId}`} className="flex items-center gap-2 text-sm">
              <MapPin size={15} />
              Compartilhar minha posição
            </label>
            <Switch
              id={`tracking-${rideId}`}
              checked={sharing}
              onCheckedChange={(enabled) => {
                setGpsError("");
                setSharing(enabled);
              }}
            />
          </div>
          {gpsError && (
            <p role="alert" className="text-xs text-destructive">
              {gpsError}
            </p>
          )}
          {!locations.length && (
            <p className="text-xs text-muted-foreground">Nenhuma posição recebida nesta viagem.</p>
          )}
          {locations.map((l) => (
            <div key={l.userId} className="text-xs">
              <p className="font-medium">
                {l.userId === viewerUserId
                  ? "Sua posição"
                  : role === "driver"
                    ? "Posição do passageiro"
                    : "Posição do motorista"}
              </p>
              <p className="text-muted-foreground">
                {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)} · precisão ±
                {Math.round(l.accuracyM)} m
              </p>
              <p className="text-muted-foreground">
                Atualizada às {new Date(l.capturedAt).toLocaleTimeString("pt-BR")}
                {clock - new Date(l.capturedAt).getTime() > 60000 ? " · posição desatualizada" : ""}
              </p>
            </div>
          ))}
          {location && (
            <iframe
              title="Última posição recebida da viagem"
              className="h-44 w-full rounded-md border border-border"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.006},${location.latitude - 0.004},${location.longitude + 0.006},${location.latitude + 0.004}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
            />
          )}
          {safety?.completionConfirmed && (
            <p className="text-xs text-muted-foreground">
              Sua conclusão foi registrada. Aguardando a outra pessoa confirmar.
            </p>
          )}
        </div>
      )}
      {safety && (
        <div className="text-xs text-muted-foreground">
          <p>
            Avaliação {role === "driver" ? "do passageiro" : "do motorista"}:{" "}
            {safety.otherUserRating.average === null
              ? "sem avaliações"
              : `${safety.otherUserRating.average.toFixed(2)} / 5 (${safety.otherUserRating.count})`}
          </p>
          <p>
            Sua média:{" "}
            {safety.myUserRating.average === null
              ? "sem avaliações"
              : `${safety.myUserRating.average.toFixed(2)} / 5 (${safety.myUserRating.count})`}
          </p>
        </div>
      )}
      {currentStatus === "COMPLETED" &&
        safety &&
        (safety.myRating ? (
          <p className="text-sm">
            Sua avaliação: {safety.myRating.score} / 5
            {safety.myRating.comment && (
              <span className="block break-words text-xs text-muted-foreground">
                {safety.myRating.comment}
              </span>
            )}
          </p>
        ) : (
          <form onSubmit={rate} className="space-y-3">
            <p className="text-sm font-medium">
              Avaliar {role === "driver" ? "passageiro" : "motorista"}
            </p>
            <div role="radiogroup" aria-label="Nota da viagem" className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="icon"
                  role="radio"
                  aria-checked={score === value}
                  aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                  title={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                  onClick={() => setScore(value)}
                >
                  <Star
                    size={21}
                    className={
                      value <= score ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                    }
                  />
                </Button>
              ))}
            </div>
            <Textarea
              aria-label="Comentário da avaliação"
              placeholder="Comentário (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
            <Button type="submit" size="sm" disabled={busy || score === 0 || !!error}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}Enviar
              avaliação
            </Button>
          </form>
        ))}
      {currentStatus === "COMPLETED" && safety?.receivedRating && (
        <p className="text-sm">
          Avaliação recebida: {safety.receivedRating.score} / 5
          {safety.receivedRating.comment && (
            <span className="block break-words text-xs text-muted-foreground">
              {safety.receivedRating.comment}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
