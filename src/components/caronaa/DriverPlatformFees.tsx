import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Due = {
  rideId: string;
  grossAmount: number;
  feeAmount: number;
  status: "OPEN" | "CLAIMED" | "SETTLED";
  claimReference: string | null;
  createdAt: string;
};
export type DriverFees = {
  driverAllowed: boolean;
  pendingTrips: number;
  limit: number;
  feePercent: number;
  amountOutstanding: number;
  platformPixKey: string | null;
  dues: Due[];
};
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DriverPlatformFees({ compact = false }: { compact?: boolean }) {
  const [fees, setFees] = useState<DriverFees | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reference, setReference] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    const { data, error: failure } = await (supabase as any).rpc("get_my_driver_platform_fees");
    if (failure) throw new Error(failure.message);
    setFees(data as DriverFees);
  }, []);
  useEffect(() => {
    let alive = true;
    void refresh().catch(e => { if (alive) setError(e instanceof Error ? e.message : "Saldo indisponível."); });
    return () => { alive = false; };
  }, [refresh]);

  async function sendClaim(rideId: string) {
    setError("");
    setBusy(rideId);
    const { error: failure } = await (supabase as any).rpc("claim_driver_platform_fee", {
      p_ride_id: rideId, p_reference: (reference[rideId] || "").trim()
    });
    if (failure) setError(failure.message);
    else await refresh().catch(e => setError(String(e)));
    setBusy(null);
  }
  return (
    <section aria-label="Repasses do motorista à plataforma"
      className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Comissões da plataforma</h3>
        <span className="text-xs text-muted-foreground">15% por viagem paga</span>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!fees ? <p className="text-sm text-muted-foreground">Carregando situação financeira…</p> : (
        <>
          <div role="status" className={"rounded-lg p-3 text-sm " + (fees.driverAllowed ? "bg-muted/50" : "border border-destructive/40 bg-destructive/5")}>
            <p className="font-semibold">
              {fees.pendingTrips} de {fees.limit} viagens com repasse pendente · {brl(fees.amountOutstanding)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fees.driverAllowed
                ? "Você pode oferecer caronas. Após três viagens pagas sem quitar a comissão, novas ofertas e o radar ficam bloqueados."
                : "Oferta de caronas e presença no radar suspensas até a quitação verificada dos repasses."}
            </p>
          </div>
          {fees.pendingTrips > 0 && (
            <>
              {fees.platformPixKey ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-semibold">Pix da plataforma</p>
                  <p className="mt-1 break-all font-mono text-xs">{fees.platformPixKey}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2"
                    onClick={() => void navigator.clipboard.writeText(fees.platformPixKey!).catch(() => setError("Não foi possível copiar a chave."))}>
                    Copiar chave
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A plataforma ainda não configurou a chave Pix de repasse. Não envie dinheiro a chaves desconhecidas.
                </p>
              )}
              {fees.dues.map(due => (
                <div key={due.rideId} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold">
                    Repasse {brl(due.feeAmount)} · corrida {due.rideId.slice(0,8)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Viagem {brl(due.grossAmount)} · {due.status === "SETTLED" ? "Repasse confirmado pela plataforma."
                      : due.status === "CLAIMED" ? "Comprovante informado. Aguardando verificação da plataforma."
                      : "Aguardando repasse."}
                  </p>
                  {due.status === "OPEN" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Input className="min-w-0 flex-1 basis-48" value={reference[due.rideId] || ""}
                        maxLength={180} aria-label={"Identificador de Pix da viagem " + due.rideId}
                        placeholder="Identificador do Pix realizado"
                        onChange={e => setReference(r => ({...r,[due.rideId]:e.target.value}))} />
                      <Button type="button" disabled={busy===due.rideId || !fees.platformPixKey ||
                        (reference[due.rideId] || "").trim().length<6}
                        onClick={() => void sendClaim(due.rideId)}>Enviei o repasse</Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {!compact && <p className="text-xs text-muted-foreground">
            Marcar um repasse como enviado não prova recebimento e não remove o bloqueio.
            A liberação exige confirmação financeira pela plataforma.{" "}
            <Link to="/minhas-caronas" className="font-semibold underline">Minhas viagens</Link>
          </p>}
        </>
      )}
    </section>
  );
}
