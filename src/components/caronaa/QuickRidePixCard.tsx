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
  const [confirming,setConfirming]=useState(false);
  const [code,setCode]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [declared,setDeclared]=useState(false);

  useEffect(()=>{
    let alive=true;
    setPix(null);setError("");setLoading(true);
    void (supabase as any).rpc("quick_ride_payment_declaration_state",{p_id:rideId})
      .then(({data,error:rpcError}:{data:any;error:any})=>{
        if(!alive || rpcError)return;
        if((Array.isArray(data)?data[0]:null)?.passenger_declared_at)setDeclared(true);
      }).catch(()=>undefined);
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

  async function confirmDeclaration(){
    if(submitting || !/^[0-9]{4}$/.test(code))return;
    setSubmitting(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_confirm_payment_code",{p_id:rideId,p_code:code});
      if(rpcError || data!==true)throw new Error("Código inválido, expirado ou já utilizado.");
      setDeclared(true);setConfirming(false);setCode("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível confirmar.");}
    finally{setSubmitting(false);}
  }
  if(!pilotEnabled)return null;
  return <section aria-label="QR Pix da Corrida Rápida concluída"
    className="min-w-0 space-y-2 rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
    <p className="font-bold">Pix da Corrida Rápida concluída</p>
    {loading&&<p role="status">Consultando valor contratado...</p>}
    {error&&<p role="alert" className="break-words text-destructive">{error}</p>}
    {pix&&<>
      <p className="text-xs text-white/70">Valor total da corrida</p>
      <p className="text-3xl font-black text-[#FFBB00]">{formatBrl(pix.data.amountCents/100)}</p>
      <img src={pix.image} alt="QR Pix estático com o valor da viagem concluída" className="mx-auto h-56 w-56 bg-white p-2" />
      <p className="break-all text-xs">Chave do motorista: {pix.data.key}</p>
      <button type="button" onClick={()=>void copy()}
        className="min-h-11 w-full rounded-lg bg-[#FFBB00] p-2 font-bold text-[#121212]">
        Copiar chave Pix / código copia e cola
      </button>
      <div role="alert" className="rounded-xl border border-[#FFBB00] bg-[#FFBB00]/10 p-3 text-sm text-white">
        <strong className="text-[#FFBB00]">Atenção ao pagamento Pix.</strong>
        <p className="mt-1">Regularize o valor da corrida. Pendências financeiras poderão restringir novas viagens quando houver política de bloqueio válida.</p>
      </div>
      {declared ? <p role="status" className="rounded-xl border border-[#FFBB00]/40 p-3">
        Pagamento declarado, mas ainda não verificado pelo banco.
      </p> : <>
        <button type="button" onClick={()=>setConfirming(true)} className="min-h-12 w-full rounded-xl border border-[#FFBB00] px-4 font-bold text-[#FFBB00]">
          Pagamento realizado
        </button>
        {confirming&&<div className="space-y-2 rounded-xl border border-white/20 p-3">
          <label htmlFor="quick-payment-code" className="block text-xs">Digite o código de 4 dígitos fornecido pelo motorista</label>
          <input id="quick-payment-code" type="text" inputMode="numeric" autoComplete="off"
            maxLength={4} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,4))}
            className="min-h-12 w-full rounded-xl border border-white/30 bg-white/10 p-3 text-xl text-white"/>
          <button type="button" disabled={submitting||code.length!==4} onClick={()=>void confirmDeclaration()}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-50">
            {submitting?"Validando...":"Confirmar código"}
          </button>
        </div>}
      </>}
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
