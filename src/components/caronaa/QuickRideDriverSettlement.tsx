import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { formatBrl } from "@/lib/ride-cost";

type PixData={available:boolean;key:string|null;name:string;amountCents:number;rideId:string;paymentMethod:string;automaticConfirmation:boolean;pilotOnly:boolean};
export function QuickRideDriverSettlement({rideId}:{rideId:string}){
 const [pix,setPix]=useState<PixData|null>(null);
 const [image,setImage]=useState("");
 const [payload,setPayload]=useState("");
 const [key,setKey]=useState("");
 const [declared,setDeclared]=useState(false);
 const [received,setReceived]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  const [result,state,mine]=await Promise.all([
   (supabase as any).rpc("get_completed_quick_ride_pix",{p_ride_id:rideId}),
   (supabase as any).rpc("quick_ride_payment_declaration_state",{p_id:rideId}),
   (supabase as any).rpc("get_my_pix_key")
  ]);
  if(result.error)throw new Error(result.error.message);
  const row=result.data as PixData;
  if(!row||row.rideId!==rideId||row.paymentMethod!=="MANUAL_DRIVER_PIX"||
   row.automaticConfirmation!==false||!Number.isSafeInteger(row.amountCents)||row.amountCents<450)
   throw new Error("Contrato Pix inválido; consulte o suporte.");
  setPix(row);
  if(!mine.error&&typeof mine.data==="string")setKey(previous=>previous.trim()?previous:mine.data);
  if(!state.error){
   const detail=Array.isArray(state.data)?state.data[0]:null;
   setDeclared(Boolean(detail?.passenger_declared_at));
   setReceived(Boolean(detail?.driver_acknowledged_at));
  }
  if(row.available&&row.key){
   const code=buildPixPayload(row.key,row.name,row.amountCents/100,"CR"+rideId.replace(/-/g,"").slice(0,20));
   const qr=await QRCode.toDataURL(code,{width:240,margin:2});
   setPayload(code);setImage(qr);
  }else {setPayload("");setImage("");}
 },[rideId]);
 useEffect(()=>{
  let live=true;
  const load=async()=>{try{await refresh();if(live)setError("");}
   catch(e){if(live)setError(e instanceof Error?e.message:"Pagamento indisponível.");}};
  void load();
  const timer=window.setInterval(()=>{if(!document.hidden)void load();},10000);
  return()=>{live=false;window.clearInterval(timer);};
 },[refresh]);
 async function saveKey(){
  const value=key.trim();
  if(value.length<6||value.length>77){setError("Informe uma chave Pix válida (6 a 77 caracteres).");return;}
  setBusy(true);setError("");
  const {error:problem}=await (supabase as any).rpc("save_my_pix_key",{p_key:value});
  if(problem)setError(problem.message);
  else {try{await refresh();}catch(e){setError(e instanceof Error?e.message:"Pix indisponível.");}}
  setBusy(false);
 }
 async function acknowledge(){
  if(busy||!declared)return;
  if(!window.confirm("Você conferiu o extrato bancário e realmente recebeu o Pix desta corrida?"))return;
  setBusy(true);setError("");
  const {data,error:problem}=await (supabase as any).rpc("quick_ride_acknowledge_manual_pix",{p_id:rideId});
  if(problem||data!==true)setError(problem?.message||"Confirmação indisponível.");
  else setReceived(true);
  setBusy(false);
 }
 async function copy(value:string){
  try{await navigator.clipboard.writeText(value);}catch{setError("Não foi possível copiar. Selecione o código manualmente.");}
 }
 return <section aria-label="Liquidação Pix do motorista"
  className="space-y-2 rounded-xl border border-[#FFBB00]/40 bg-[#121212] p-3 text-white">
  <p className="font-bold text-[#FFBB00]">Corrida concluída — cobrança ao passageiro</p>
  {pix&&<><p className="text-xs text-white/70">Valor total devido pelo passageiro</p>
   <p className="text-2xl font-black text-[#FFBB00]">{formatBrl(pix.amountCents/100)}</p></>}
  {!pix?.available?<div className="space-y-2 rounded-xl border border-[#FFBB00]/40 p-3">
   <label htmlFor="quick-driver-pix" className="block text-sm font-semibold">Cadastre sua chave Pix para gerar a cobrança</label>
   <input id="quick-driver-pix" className="min-h-12 w-full rounded-lg border border-white/20 bg-white/10 p-3 text-base text-white"
    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" value={key} maxLength={77} onChange={e=>setKey(e.target.value)}/>
   <button type="button" disabled={busy||key.trim().length<6} onClick={()=>void saveKey()}
    className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">Salvar Pix e gerar QR automaticamente</button>
  </div>:<div className="space-y-2">
   <p className="text-xs">Compartilhe esta cobrança com o passageiro. Confirme nome e chave antes da transferência.</p>
   {image&&<img src={image} alt="QR Code Pix estático da corrida" className="mx-auto h-48 w-48 rounded-xl bg-white p-2 sm:h-56 sm:w-56"/>}
   <p className="break-all text-xs">Chave Pix: {pix.key}</p>
   <button type="button" className="min-h-11 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]" onClick={()=>void copy(payload)}>Copiar código Pix (copia e cola)</button>
   <button type="button" className="min-h-11 w-full rounded-xl border border-[#FFBB00] text-[#FFBB00]" onClick={()=>void copy(pix.key!)}>Copiar chave Pix</button>
  </div>}
  <p role="status" className="text-sm text-white/80">
   {received?"Recebimento declarado por você. Isso não é conciliação bancária.":declared?"Passageiro declarou pagamento. Confira o extrato antes de confirmar.":"Aguardando o passageiro declarar o pagamento."}
  </p>
  {declared&&!received&&<button type="button" disabled={busy} onClick={()=>void acknowledge()}
   className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">Recebi o Pix no banco</button>}
  <p className="text-xs text-white/60">A confirmação das partes não substitui um comprovante bancário e não quita automaticamente a comissão da plataforma.</p>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
 </section>;
}
