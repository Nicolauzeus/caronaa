import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewAsaasCheckout } from "@/lib/payments/checkout-preview.functions";

type Preview = {
  rideFareCents:number;
  processingFeeCents:number;
  passengerTotalCents:number;
  driverFixedCents:number;
  platformTargetNetCents:number;
  checkoutReady:false;
};
const brl = (cents:number) => (cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function AsaasCheckoutPreview({rideId}:{rideId:string}) {
  const query = useServerFn(previewAsaasCheckout);
  const [preview,setPreview] = useState<Preview|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const data = await query({data:{rideId}});
      setPreview(data);
      setError(null);
    } catch {
      setPreview(null);
      setError("A tarifa do Asaas ainda não foi verificada para esta corrida. Nenhuma cobrança foi criada.");
    } finally {setLoading(false);}
  },[query,rideId]);
  useEffect(()=>{void load();},[load]);
  return <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Prévia de pagamento Asaas">
    <div className="mb-3 flex items-center gap-2">
      <CreditCard className="size-5 text-primary" aria-hidden="true" />
      <h2 className="font-semibold">Pagamento seguro · Asaas Sandbox</h2>
    </div>
    {loading ? <p className="text-sm text-muted-foreground">Verificando valores da reserva…</p>
      : preview ? <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><span>Preço da carona</span><strong>{brl(preview.rideFareCents)}</strong></div>
        <div className="flex justify-between gap-3"><span>Tarifa de processamento</span><strong>{brl(preview.processingFeeCents)}</strong></div>
        <div className="flex justify-between gap-3 border-t border-border pt-2 text-base"><strong>Total a pagar</strong><strong>{brl(preview.passengerTotalCents)}</strong></div>
        <p className="text-xs text-muted-foreground">
          Após o pagamento e a conciliação: {brl(preview.driverFixedCents)} destinados ao motorista e {brl(preview.platformTargetNetCents)} líquidos previstos para CARONAA.
        </p>
      </div>
      : <p role="status" className="text-sm text-muted-foreground">{error}</p>}
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true"/>
      <span>Prévia de testes. O checkout e a cobrança Pix Asaas ainda estão desativados. Não transfira dinheiro por um QR antigo para testar o split.</span>
    </div>
    <Button type="button" variant="outline" size="sm" className="mt-3"
      disabled={loading} onClick={()=>void load()}>
      <RefreshCw className="mr-1 size-3" aria-hidden="true"/> Atualizar valores
    </Button>
  </section>;
}
