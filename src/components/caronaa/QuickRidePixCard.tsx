import { useEffect, useRef, useState } from "react";
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
  const lastRideId=useRef<string|null>(null);

  useEffect(()=>{
    let alive=true;
    const switchedRide=lastRideId.current!==rideId;
    lastRideId.current=rideId;
    // Keep the last verified QR visible while refreshing the same ride.
    // Before this, each 15-second poll erased the QR and payment actions.
    if(switchedRide){
      setPix(null);setDeclared(false);setDriverConfirmed(false);
    }
    setError("");setLoading(switchedRide);
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
        if(alive){setPix(null);setError("Aguardando o motorista cadastrar uma chave Pix. Esta cobrança será atualizada automaticamente.");}
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

  const copy=async(kind:"payload"|"key")=>{
    if(!pix)return;
    const value=kind==="key"?pix.data.key:pix.payload;
    if(!value)return;
    try{await navigator.clipboard.writeText(value);}
    catch{setError("Não foi possível copiar automaticamente. Abra os detalhes e selecione o código.");}
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
      <p className="text-xs text-white/70">Valor contratado da corrida</p>
      <p className="text-3xl font-black text-[#FFBB00]">{formatBrl(pix.data.amountCents/100)}</p>
      {pix.data.pilotOnly&&<p role="alert" className="rounded-lg border border-amber-300/50 p-2 text-xs text-amber-200">Homologação — não realize transferências reais.</p>}
      <p className="text-xs text-white/75">Pague diretamente ao motorista pelo aplicativo do seu banco. O botão abaixo copia o Pix completo, incluindo o valor da corrida.</p>
      <button type="button" onClick={()=>void copy("payload")}
        className="min-h-14 w-full rounded-xl bg-[#FFBB00] px-3 font-extrabold text-[#121212]">
        Copiar Pix Copia e Cola
      </button>
      <div className="space-y-1 rounded-xl border border-white/20 p-3">
        <p className="text-xs text-white/70">Chave Pix do motorista</p>
        <p className="break-all text-sm font-medium text-white">{pix.data.key}</p>
        <button type="button" onClick={()=>void copy("key")}
          className="min-h-11 w-full rounded-lg border border-[#FFBB00]/55 text-sm font-bold text-[#FFBB00]">
          Copiar somente a chave Pix
        </button>
      </div>
      <p className="text-xs text-white/65">A confirmação do desembarque não realiza o pagamento. Confira o destinatário e o valor no banco.</p>
      {driverConfirmed&&!declared&&<p role="status" className="rounded-xl border border-white/20 p-3 text-xs">
        O motorista declarou ter recebido. Confira seu banco antes de registrar sua própria declaração.
      </p>}
      {declared?<p role="status" className="rounded-xl border border-[#FFBB00]/40 p-3">
        {driverConfirmed?"Ambas as partes declararam o pagamento; não houve conciliação bancária automática.":"Você declarou pagamento. O motorista pode confirmar após conferir o banco."}
      </p>:<button type="button" disabled={submitting} onClick={()=>void confirmDeclaration()}
        className="min-h-12 w-full rounded-xl border border-[#FFBB00] px-4 font-bold text-[#FFBB00]">
        {submitting?"Registrando...":"Já fiz o Pix — declarar pagamento"}
      </button>}
      <details className="rounded-xl border border-white/15 p-3 text-xs text-white/70">
        <summary className="min-h-8 cursor-pointer font-semibold">Ver QR Code opcional e código Pix completo</summary>
        <img src={pix.image} alt="QR Pix da mesma cobrança exibida ao motorista" className="mx-auto my-2 h-40 w-40 rounded-xl bg-white p-2"/>
        <textarea readOnly aria-label="Código Pix completo para seleção manual" value={pix.payload}
          className="mt-2 w-full break-all rounded-lg border border-white/20 bg-[#121212] p-2 text-base text-white" rows={3}/>
        <p className="mt-2">O QR não comprova transferência nem recebimento automático.</p>
      </details>
    </>}
  </section>;
}
