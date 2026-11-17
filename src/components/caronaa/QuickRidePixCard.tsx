import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { formatBrl } from "@/lib/ride-cost";

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
  const [pix, setPix] = useState<{payload:string;image:string;data:CompletedQuickPix}|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [declared,setDeclared]=useState(false);
  const [driverConfirmed,setDriverConfirmed]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);

  useEffect(()=>{
    let alive=true;
    setPix(null);setError("");setLoading(true);
    void (supabase as any).rpc("quick_ride_payment_declaration_state",{p_id:rideId})
      .then(({data,error:rpcError}:{data:any;error:any})=>{
        if(!alive || rpcError)return;
        const state=Array.isArray(data)?data[0]:null;
        setDeclared(Boolean(state?.passenger_declared_at));
        setDriverConfirmed(Boolean(state?.driver_acknowledged_at));
      }).catch(()=>undefined);
    void (async()=>{
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
  },[rideId,refreshKey]);

  const copy=async()=>{
    if(!pix)return;
    try { await navigator.clipboard.writeText(pix.payload); }
    catch {setError("Não foi possível copiar. Selecione o código e copie manualmente.");}
  };

  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)setRefreshKey(v=>v+1);};
    const timer=window.setInterval(refresh,15000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  async function confirmDeclaration(){
    if(submitting||!pix)return;
    setSubmitting(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_declare_manual_pix",{p_id:rideId});
      if(rpcError||data!==true)throw new Error(rpcError?.message||"Declaração já registrada ou indisponível.");
      setDeclared(true);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível declarar o pagamento.");}
    finally{setSubmitting(false);}
  }
  return <section aria-label="QR Pix da Corrida Rápida concluída"
    className="min-w-0 space-y-2 rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
    <p className="font-bold">Pix da Corrida Rápida concluída</p>
    {loading&&<p role="status">Consultando valor contratado...</p>}
    {error&&<button type="button" onClick={()=>setRefreshKey(v=>v+1)} className="min-h-10 rounded-lg border border-[#FFBB00] px-3 text-[#FFBB00]">Tentar novamente</button>}
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
        {driverConfirmed?"Motorista também confirmou recebimento (declarações registradas; sem confirmação bancária).":"Você declarou pagamento. Aguardando o motorista confirmar o recebimento."}
      </p> : <>
        <button type="button" disabled={submitting} onClick={()=>void confirmDeclaration()} className="min-h-12 w-full rounded-xl border border-[#FFBB00] px-4 font-bold text-[#FFBB00]">
          {submitting?"Registrando...":"Já fiz o Pix — declarar pagamento"}
        </button>}
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
