import { useEffect, useRef, useState, type FormEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CheckCircle2,
  Keyboard,
  Loader2,
  QrCode,
  ShieldAlert,
  Car,
  User,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmRideByQr, type ConfirmedRideDetails } from "@/lib/ride-qr-service";

export function RideQrScannerModal({
  open,
  onOpenChange,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmedRideDetails | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // Inicialização do Scanner de Câmera
  useEffect(() => {
    let active = true;

    if (!open || mode !== "camera" || confirmationDetails) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
      }
      setScanning(false);
      return;
    }

    const elementId = "caronaa-qr-reader";
    const timer = setTimeout(async () => {
      if (!active) return;

      try {
        setCameraError(null);
        setScanning(true);

        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            try {
              await html5QrCode.stop().catch(() => {});
              scannerRef.current = null;
              await handleConfirmToken(decodedText);
            } finally {
              isProcessingRef.current = false;
            }
          },
          () => {
            // Ignora frames sem QR
          },
        );
      } catch (err) {
        if (!active) return;
        setScanning(false);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission")) {
          setCameraError("Permissão de câmera não concedida. Permita o acesso à câmera ou use a opção de digitar o código.");
        } else {
          setCameraError("Não foi possível acessar a câmera. Você pode digitar o código de confirmação abaixo.");
        }
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
      }
    };
  }, [open, mode, confirmationDetails]);

  // Limpeza ao fechar
  useEffect(() => {
    if (!open) {
      setConfirmationDetails(null);
      setManualCode("");
      setCameraError(null);
      setValidating(false);
      setMode("camera");
    }
  }, [open]);

  async function handleConfirmToken(tokenText: string) {
    setValidating(true);
    try {
      const details = await confirmRideByQr(tokenText);
      setConfirmationDetails(details);
      toast.success("Carona confirmada!");
      await onConfirmed();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "QR lido, mas não conseguimos confirmar a viagem. Tente novamente.";
      toast.error(message);
    } finally {
      setValidating(false);
    }
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Informe o código de confirmação.");
      return;
    }
    await handleConfirmToken(manualCode);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
        {confirmationDetails ? (
          /* Resposta ao Usuário: Sucesso sem excesso */
          <div className="text-center space-y-4 py-2">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <CheckCircle2 size={36} className="text-caronaa-primary-strong dark:text-caronaa-primary" />
            </div>

            <div className="space-y-1">
              <h2 className="font-display text-2xl font-extrabold text-foreground flex items-center justify-center gap-1.5">
                CARONAA confirmada
                <Sparkles size={18} className="text-primary fill-primary/30" />
              </h2>
              <p className="text-xs text-muted-foreground">
                Encontro presencial validado. Boa viagem!
              </p>
            </div>

            {/* Ficha Resumida Sanitizada */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <User size={14} className="text-primary" /> Motorista
                </span>
                <span className="font-bold text-foreground">{confirmationDetails.driverName}</span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <Car size={14} className="text-primary" /> Veículo
                </span>
                <span className="font-bold text-foreground">
                  {confirmationDetails.vehicleModel}
                  {confirmationDetails.vehiclePlate ? ` • ${confirmationDetails.vehiclePlate}` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <MapPin size={14} className="text-primary" /> Destino
                </span>
                <span className="font-bold text-foreground truncate max-w-[170px] text-right">
                  {confirmationDetails.destination}
                </span>
              </div>

              {confirmationDetails.departureTime && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <Clock size={14} className="text-primary" /> Horário
                  </span>
                  <span className="font-bold text-foreground">
                    {confirmationDetails.departureTime}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="button"
              className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-md hover:opacity-90"
              onClick={() => onOpenChange(false)}
            >
              Concluir
            </Button>
          </div>
        ) : (
          /* Scanner / Digitar Código */
          <div className="space-y-4">
            <DialogHeader className="text-center space-y-1">
              <DialogTitle className="font-display text-xl font-extrabold text-foreground">
                Confirmar carona
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Escaneie o QR exibido pelo motorista para registrar o encontro presencial.
              </DialogDescription>
            </DialogHeader>

            {mode === "camera" && !cameraError ? (
              <div className="flex flex-col items-center">
                <div className="relative size-64 overflow-hidden rounded-2xl border-2 border-primary/40 bg-black/90 shadow-inner">
                  <div id="caronaa-qr-reader" className="size-full [&_video]:size-full [&_video]:object-cover" />

                  {/* Mira guia visual do scanner */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="size-44 rounded-xl border-2 border-primary/80 animate-pulse bg-primary/5" />
                  </div>

                  {validating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-xs text-foreground p-4 text-center">
                      <Loader2 size={32} className="animate-spin text-primary" />
                      <p className="mt-3 text-xs font-bold">Validando carona no servidor...</p>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground font-medium">
                  Posicione o QR dentro da área
                </p>
              </div>
            ) : (
              /* Fallback: Digitar código */
              <form onSubmit={handleManualSubmit} className="space-y-3 py-2">
                {cameraError && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="qr-manual-code" className="text-xs font-semibold text-foreground">
                    Código de confirmação
                  </label>
                  <Input
                    id="qr-manual-code"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Cole ou digite o código"
                    className="h-12 rounded-xl border-border bg-background text-sm font-medium"
                    autoComplete="off"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm"
                  disabled={validating || !manualCode.trim()}
                >
                  {validating ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" /> Validando...
                    </>
                  ) : (
                    "Confirmar viagem"
                  )}
                </Button>
              </form>
            )}

            {/* Alternância e Botão Cancelar */}
            <div className="flex flex-col gap-2 pt-1">
              {!cameraError && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 rounded-xl border-border text-xs font-semibold"
                  onClick={() => setMode((m) => (m === "camera" ? "manual" : "camera"))}
                  disabled={validating}
                >
                  {mode === "camera" ? (
                    <>
                      <Keyboard size={15} /> Digitar código
                    </>
                  ) : (
                    <>
                      <Camera size={15} /> Usar câmera
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full rounded-xl text-xs text-muted-foreground"
                onClick={() => onOpenChange(false)}
                disabled={validating}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

