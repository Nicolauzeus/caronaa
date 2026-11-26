import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { operationsService, type CancellationReason, type OrderService } from "@/services/operations-service";

const reasons: readonly {code: CancellationReason; label: string}[] = [
  {code:"WAIT_TOO_LONG",label:"Demora no atendimento"},
  {code:"CHANGED_PLANS",label:"Mudança de planos"},
  {code:"PRICE",label:"Preço da corrida"},
  {code:"FOUND_ALTERNATIVE",label:"Encontrei outro transporte"},
  {code:"WRONG_ROUTE",label:"Origem ou destino incorreto"},
  {code:"TECHNICAL_PROBLEM",label:"Problema técnico"},
  {code:"OTHER",label:"Outro motivo"},
  {code:"PREFER_NOT_TO_SAY",label:"Prefiro não informar"},
];

/** Mount only AFTER the original cancellation has succeeded. Closing never writes a reason. */
export function PassengerCancellationReason({service,requestId,onClose}:{
  service:OrderService; requestId:string; onClose:()=>void;
}){
  const [selected,setSelected]=useState<CancellationReason|"">("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef(false);
  async function submit(){
    if(!selected||pending.current)return;
    pending.current=true;setBusy(true);setError("");
    try{
      const stored=await operationsService.recordCancellationReason(service,requestId,selected);
      if(stored)onClose();
      else setError("Não foi possível registrar esta resposta. A corrida continua cancelada.");
    }catch{
      setError("Motivo indisponível no momento. Você pode fechar e continuar.");
    }finally{pending.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[#121212] text-white border-white/15">
      <DialogTitle>Corrida cancelada</DialogTitle>
      <DialogDescription className="text-white/70">Se quiser, informe o motivo para nos ajudar a melhorar o atendimento. Sua corrida já foi cancelada.</DialogDescription>
      <label className="grid gap-2 text-sm font-medium">
        Motivo (opcional)
        <select value={selected} disabled={busy} onChange={e=>setSelected(e.target.value as CancellationReason|"")}
          className="min-h-12 rounded-xl border border-white/25 bg-[#121212] px-3 text-white">
          <option value="">Escolha um motivo</option>
          {reasons.map(r=><option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </label>
      {error&&<p role="alert" className="text-xs text-white/80">{error}</p>}
      <button type="button" disabled={!selected||busy} onClick={()=>void submit()}
        className="min-h-12 rounded-xl bg-[#FFBB00] text-[#121212] font-bold disabled:opacity-50">
        {busy?"Enviando…":"Enviar motivo"}
      </button>
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/25 text-sm">Fechar</button>
    </DialogContent>
  </Dialog>;
}
