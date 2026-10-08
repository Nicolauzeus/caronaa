import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clock, QrCode, RefreshCw, X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateRideQrToken, type RideQrData } from "@/lib/ride-qr-service";

export function RideQrModal({
  rideId,
  open,
  onOpenChange,
}: {
  rideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrData, setQrData] = useState<RideQrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  async function loadToken() {
    setLoading(true);
    setQrData(null);
    try {
      const data = await generateRideQrToken(rideId);
      setQrData(data);

      const expires = new Date(data.expiresAt).getTime();
      const remainingSeconds = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setTimeLeft(remainingSeconds);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o QR Code.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadToken();
    } else {
      setQrData(null);
      setTimeLeft(0);
    }
  }, [open, rideId]);

  // Renderiza o QR Code no Canvas assim que o token estiver disponível
  useEffect(() => {
    if (loading || !qrData || !canvasRef.current) return;

    const payload = `caronaa:ride-confirm:${qrData.token}`;
    void QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 2,
      color: {
        dark: "#141412",
        light: "#FFFFFF",
      },
    });
  }, [qrData, loading]);

  // Countdown timer
  useEffect(() => {
    if (!open || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isExpired = timeLeft <= 0 && Boolean(qrData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl bg-card p-6 shadow-2xl text-center">
        <DialogHeader className="text-center space-y-1">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <QrCode size={26} />
          </div>
          <DialogTitle className="font-display text-xl font-extrabold text-foreground">
            Seu QR de confirmação
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Peça ao passageiro para escanear quando vocês se encontrarem.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col items-center">
          {loading ? (
            <div className="flex size-60 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : qrData ? (
            <div className={`relative flex flex-col items-center rounded-2xl border bg-white p-3 shadow-md ${isExpired ? "opacity-40" : ""}`}>
              <canvas ref={canvasRef} className="rounded-xl" />
              {isExpired && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-xs">
                  <p className="font-bold text-destructive text-sm">QR Code expirado</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex size-60 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
              Não foi possível gerar o código.
            </div>
          )}

          {/* Validade do QR */}
          {qrData && (
            <div className="mt-4 flex items-center gap-1.5 text-xs">
              <Clock size={14} className={isExpired ? "text-destructive" : "text-primary"} />
              <span className={isExpired ? "font-bold text-destructive" : "font-medium text-muted-foreground"}>
                {isExpired ? "Expirado. Gere um novo QR." : `Válido por ${formattedTime}`}
              </span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-2 rounded-xl border-border font-bold text-sm"
              onClick={loadToken}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Gerar novo QR
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full rounded-xl text-xs text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

