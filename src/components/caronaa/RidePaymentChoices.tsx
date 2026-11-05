import { useCallback, useEffect, useState } from "react";
import { CreditCard, HandCoins, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CompletedRidePix } from "@/components/caronaa/DriverPix";
import { AsaasCheckoutPreview } from "@/components/caronaa/AsaasCheckoutPreview";

type PaymentChoice = {
  method: "MANUAL_PIX" | "ASAAS_PIX" | null;
  asaasAvailable: boolean;
  manualAvailable: boolean;
  charged: boolean;
};

/** A single, server-locked payment rail. Never show both payment QRs for one ride. */
export function RidePaymentChoices({
  rideId, role,
}: { rideId: string; role: "driver" | "passenger" }) {
  const [choice, setChoice] = useState<PaymentChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const { data, error: problem } = await (supabase as any).rpc("get_ride_payment_choice", {
      p_ride_id: rideId,
    });
    if (problem) throw new Error(problem.message);
    setChoice(data as PaymentChoice);
  }, [rideId]);
  useEffect(() => {
    let live = true;
    void refresh().catch(e => {
      if (live) setError(e instanceof Error ? e.message : "Não foi possível consultar o método.");
    });
    return () => { live = false; };
  }, [refresh]);
  async function selectManual() {
    if (role !== "passenger" || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: problem } = await (supabase as any).rpc(
        "select_ride_payment_method",
        { p_ride_id: rideId, p_method: "MANUAL_PIX" },
      );
      if (problem) throw new Error(problem.message);
      setChoice(data as PaymentChoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Método indisponível.");
    } finally { setBusy(false); }
  }
  if (error) return (
    <div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
      {error}
      <Button type="button" variant="outline" size="sm" className="ml-2"
        onClick={() => {setError(""); void refresh().catch(()=>setError("Não foi possível consultar o método."));}}>
        Tentar novamente
      </Button>
    </div>
  );
  if (!choice) return <p role="status" className="text-sm text-muted-foreground">Consultando pagamento da viagem…</p>;

  if (choice.method === "MANUAL_PIX") {
    return <>
      <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        Método escolhido: Pix direto ao motorista. Não será gerada cobrança Asaas para esta viagem.
      </p>
      <CompletedRidePix rideId={rideId} role={role} />
    </>;
  }
  if (choice.method === "ASAAS_PIX") {
    return <div className="space-y-3">
      <p className="rounded-lg border border-primary/30 bg-card p-3 text-sm">
        Método escolhido: Asaas. Pix manual desabilitado para evitar pagamento duplicado.
      </p>
      {role === "passenger" ? <AsaasCheckoutPreview rideId={rideId} /> :
        <p className="text-sm text-muted-foreground">Aguardando a liquidação Asaas da viagem.</p>}
    </div>;
  }

  return <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Escolher forma de pagamento">
    <h3 className="text-base font-bold">Escolha como pagar esta viagem</h3>
    <p className="text-sm text-muted-foreground">
      Cada viagem usa um único método, para evitar cobranças duplicadas.
    </p>
    {role === "passenger" ? (
      <Button type="button" className="w-full justify-start gap-2" disabled={busy}
        onClick={() => void selectManual()}>
        <HandCoins size={18} /> {busy ? "Confirmando método…" : "Pagar Pix direto ao motorista"}
      </Button>
    ) : <p className="text-sm text-muted-foreground">Aguardando o passageiro escolher o método.</p>}
    <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
      <CreditCard size={18} />
      <span>Asaas Pix — em homologação, indisponível para cobrança real</span>
      <LockKeyhole size={16} className="ml-auto shrink-0" />
    </div>
    {role === "passenger" && (
      <details className="text-sm">
        <summary className="cursor-pointer text-primary underline">Ver simulação de taxas do Asaas</summary>
        <div className="mt-3"><AsaasCheckoutPreview rideId={rideId} /></div>
      </details>
    )}
  </section>;
}
