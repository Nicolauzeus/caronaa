import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";

export function QuickRideDriverSettlement({rideId}:{rideId:string}){
  const [amount,setAmount]=useState<number|null>(null);
  const [code,setCode]=useState("");
  const [declared,setDeclared]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void Promise.all([
      (supabase as any).rpc("get_completed_quick_ride_pix",{p_ride_id:rideId}),
      (supabase as any).rpc("quick_ride_payment_declaration_state",{p_id:rideId}),
    ]).then(([pix,state]:any[])=>{
      if(!active)return;
      if(!pix.error&&Number.isSafeInteger(pix.data?.amountCents))setAmount(pix.data.amountCents);
      if(!state.error)setDeclared(Boolean((Array.isArray(state.data)?state.data[0]:null)?.passenger_declared_at));
    }).catch(()=>undefined);
    return()=>{active=false};
  },[rideId]);
  async function issue(){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_issue_payment_code",{p_id:rideId});
      if(rpcError||typeof data!=="string")throw new Error("Código já emitido ou indisponível. Procure suporte se perdeu o código.");
      setCode(data);
    }catch(e){setError(e instanceof Error?e.message:"Código indisponível.");}
    finally{setBusy(false);}
  }
  return <section aria-label="Liquidação Pix do motorista"
    className="space-y-3 rounded-xl border border-[#FFBB00]/40 bg-[#121212] p-4 text-white">
    <p className="font-bold text-[#FFBB00]">Corrida concluída — recebimento Pix</p>
    {amount!==null&&<p className="text-2xl font-black text-[#FFBB00]">{formatBrl(amount/100)}</p>}
    <p className="text-xs text-white/75">O Pix é manual. Confirme o valor no seu banco antes de fornecer o código de confirmação ao passageiro.</p>
    {declared?<p role="status">Passageiro declarou pagamento. Aguarde a verificação do recebimento.</p>:
      code?<div><p className="text-xs">Código de confirmação para informar ao passageiro</p>
        <p role="status" className="text-center text-4xl font-black tracking-widest text-[#FFBB00]">{code}</p>
      </div>:<button type="button" disabled={busy} onClick={()=>void issue()}
        className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">
        {busy?"Gerando...":"Gerar código de confirmação Pix"}
      </button>}
    {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
}
