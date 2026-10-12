import { useEffect, useState, type FormEvent } from "react";
import { Camera, Loader2, QrCode, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type RideSafety } from "@/lib/ride-safety";
import { getRideSafety, rateRide, validateRideBoarding } from "@/lib/ride-safety-service";
import { RideQrModal } from "./RideQrModal";
import { RideQrScannerModal } from "./RideQrScannerModal";
import { CompletedRidePix } from "./DriverPix";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import { RideLiveTracker } from "./RideLiveTracker";

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
  const [pinEntryOpen, setPinEntryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrScannerModalOpen, setQrScannerModalOpen] = useState(false);

  const loadSafety = async () => {
    try {
      const next = await getRideSafety(rideId);
      setSafety(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a segurança da viagem.");
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const next = await getRideSafety(rideId);
        if (active) {
          setSafety(next);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar a segurança da viagem.",
          );
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 10000);
    const onRidesUpdated = () => void run();
    window.addEventListener("caronaa:rides-updated", onRidesUpdated);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("caronaa:rides-updated", onRidesUpdated);
    };
  }, [rideId, status]);

  const currentStatus = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)
    ? status
    : (safety?.status ?? status);

  async function board(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await validateRideBoarding(rideId, pin);
      setPin("");
      await loadSafety();
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
      await loadSafety();
      toast.success("Avaliação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a avaliação.");
    } finally {
      setBusy(false);
    }
  }

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

      {/* Acompanhamento em tempo real para viagens confirmadas ou em andamento */}
      {safety && ["CONFIRMED", "IN_PROGRESS"].includes(currentStatus) && (
        <RideLiveTracker
          rideId={rideId}
          role={role}
          viewerUserId={viewerUserId}
          status={currentStatus}
          safety={safety}
          onRefresh={async () => {
            await loadSafety();
            await onChanged();
          }}
        />
      )}

      {currentStatus === "IN_PROGRESS" && safety && (
        <div className="space-y-2">
          {safety.completionConfirmed ? (
            <p role="status" className="text-sm font-semibold">
              Sua chegada foi confirmada. Aguardando a outra pessoa concluir.
            </p>
          ) : (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await transitionRideStatus(rideId, "COMPLETED");
                  toast.success(
                    result === "AWAITING_OTHER_PARTICIPANT"
                      ? "Chegada confirmada. Aguardando a outra pessoa."
                      : "Viagem concluída.",
                  );
                  await loadSafety();
                  await onChanged();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar chegada ao destino
            </Button>
          )}
        </div>
      )}
      {currentStatus === "COMPLETED" && <CompletedRidePix rideId={rideId} />}

      {/* Validação de Embarque com QR Code ou PIN para Passageiro */}
      {currentStatus === "CONFIRMED" && role === "passenger" && (
        <div className="space-y-3">
          <Button
            type="button"
            onClick={() => setQrScannerModalOpen(true)}
            className="h-12 w-full gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Camera size={17} />
            Ler QR Code para confirmar
          </Button>

          {safety?.pin && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
                Código PIN alternativo
              </p>
              <p className="mt-0.5 font-mono text-xl font-bold tracking-widest">{safety.pin}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Informe ao motorista se não conseguir escanear o QR.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Validação de Embarque com QR Code ou PIN para Motorista */}
      {currentStatus === "CONFIRMED" && role === "driver" && (
        <div className="space-y-3">
          <Button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="h-12 w-full gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <QrCode size={17} />
            Mostrar QR da viagem
          </Button>

          <button
            type="button"
            aria-expanded={pinEntryOpen}
            onClick={() => setPinEntryOpen((open) => !open)}
            className="text-sm font-semibold text-primary underline underline-offset-4"
          >
            {pinEntryOpen ? "Fechar alternativa de PIN" : "Alternativa: informar PIN"}
          </button>
          {pinEntryOpen && (
            <form onSubmit={board} className="space-y-2">
              <label
                className="block text-xs font-medium text-muted-foreground"
                htmlFor={`boarding-${rideId}`}
              >
                PIN de 8 dígitos do passageiro
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
                  className="min-w-0 flex-1 basis-32 font-mono h-10"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-10"
                  disabled={busy || pin.length !== 8 || !safety || !!error}
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  Validar PIN
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {safety?.boardedAt && (
        <p className="text-xs text-muted-foreground">
          Embarque validado em {new Date(safety.boardedAt).toLocaleString("pt-BR")}
        </p>
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

      {/* Avaliação após término da corrida */}
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
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
              Enviar avaliação
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

      {/* Modais de Confirmação por QR Code */}
      <RideQrModal rideId={rideId} open={qrModalOpen} onOpenChange={setQrModalOpen} />

      <RideQrScannerModal
        open={qrScannerModalOpen}
        onOpenChange={setQrScannerModalOpen}
        onConfirmed={onChanged}
      />
    </section>
  );
}
