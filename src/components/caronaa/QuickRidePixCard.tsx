import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { formatBrl } from "@/lib/ride-cost";
import { getF07PilotState } from "@/lib/quick-rides/f07-pilot.functions";

type CompletedQuickPix = {
  available: boolean;
  key: string | null;
  name: string;
  amountCents: number;
  rideId: string;
  paymentMethod: "MANUAL_DRIVER_PIX";
  automaticConfirmation: false;
  pilotOnly: boolean;
};

export function QuickRidePixCard({ rideId }: { rideId: string }) {
  const pilotFn=useServerFn(getF07PilotState);
  const pilotRef=useRef(pilotFn);
  pilotRef.current=pilotFn;
  const [pilotEnabled,setPilotEnabled]=useState(false);
  const [pix, setPix] = useState<{payload:string;image:string;data:CompletedQuickPix}|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    let alive=true;
    setPix(null);setError("");setLoading(true);
    void (async()=>{
      // Only the separate homologation environment may show a pilot Pix.
      // Public production never invokes an RPC that was not deployed there.
      const mode=await pilotRef.current();
      if(!mode.enabled)return;
      if(alive)setPilotEnabled(true);
      const {data,error:rpcError}=await (supabase as any).rpc(
        "get_completed_quick_ride_pix",{p_ride_id:rideId},
      );
      if(rpcError)throw new Error("Pix da Corrida Rápida indisponível. Confira a migration 0143 e o encerramento da viagem.");
      const row=data as CompletedQuickPix | null;
      if(!row || row.available!==true || !row.key){
        if(alive)setError("Motorista ainda não cadastrou a chave Pix. Consulte o perfil de pagamentos.");
        return;
      }
      if(row.rideId!==rideId || row.paymentMethod!=="MANUAL_DRIVER_PIX" ||
         row.automaticConfirmation!==false ||
         !Number.isSafeInteger(row.amountCents) || row.amountCents<450){
        throw new Error("Dados do Pix não correspondem ao contrato da viagem.");
      }
      const txid="CR"+rideId.replace(/-/g,"").slice(0,20);
      const payload=buildPixPayload(row.key,row.name,row.amountCents/100,txid);
      const image=await QRCode.toDataURL(payload,{width:240,margin:2});
      if(alive)setPix({payload,image,data:row});
    })().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Falha ao gerar o Pix.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[rideId]);

  const copy=async()=>{
    if(!pix)return;
    try { await navigator.clipboard.writeText(pix.payload); }
    catch {setError("Não foi possível copiar. Selecione o código e copie manualmente.");}
  };

  if(!pilotEnabled)return null;
  return <section aria-label="QR Pix da Corrida Rápida concluída"
    className="min-w-0 space-y-2 rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
    <p className="font-bold">Pix da Corrida Rápida concluída</p>
    {loading&&<p role="status">Consultando valor contratado...</p>}
    {error&&<p role="alert" className="break-words text-destructive">{error}</p>}
    {pix&&<>
      <p>Valor contratado: <strong>{formatBrl(pix.data.amountCents/100)}</strong></p>
      <img src={pix.image} alt="QR Pix estático com o valor da viagem concluída" className="mx-auto h-56 w-56 bg-white p-2" />
      <p className="break-all text-xs">Chave do motorista: {pix.data.key}</p>
      <button type="button" onClick={()=>void copy()}
        className="min-h-11 w-full rounded-lg bg-[#FFBB00] p-2 font-bold text-[#121212]">
        Copiar Pix copia e cola
      </button>
      <textarea readOnly aria-label="Código Pix copia e cola" value={pix.payload}
        className="w-full break-all rounded-lg border bg-background p-2 text-xs" rows={2}/>
      <p className="text-xs text-muted-foreground">
        {pix.data.pilotOnly?"HOMOLOGAÇÃO — não efetue transferências reais. ":""}
        O QR apenas preenche um Pix estático. Não comprova pagamento,
        não confirma recebimento e não faz repasse automático.
      </p>
    </>}
  </section>;
}
