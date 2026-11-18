import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Dispute = {
 ride_id:string; municipality:string; vehicle_type:string; status:string;
 requested_at:string; passenger_name:string; driver_name:string;
 origin_label:string; destination_label:string; passenger_response:string|null;
 completion_request_method?:string|null;driver_review_reason?:string|null;
 finish_distance_m?:number|null;finish_accuracy_m?:number|null;
 admin_decision:string|null; admin_reason:string|null;
 admin_resolved_at:string|null; admin_resolved_by:string|null; audit_at:string|null;
};

export function QuickRideDisputesAdmin() {
 const [items,setItems]=useState<Dispute[]>([]);
 const [filter,setFilter]=useState<"pending"|"all">("pending");
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);
  const {data,error:rpcError}=await (supabase as any).rpc("admin_quick_ride_disputes");
  if(rpcError){setError("Não foi possível consultar contestações: "+rpcError.message);}
  else {setItems(Array.isArray(data)?data:[]);setError("");}
  setLoading(false);
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const pending=items.filter(item=>(item.status==="PENDING_REVIEW"||
   item.status==="IN_PROGRESS"&&item.passenger_response==="CONTESTED")&&!item.admin_decision);
 const visible=filter==="pending"?pending:items;
 async function decide(ride:Dispute,decision:"COMPLETE"|"CANCEL"){
  const reason=(reasons[ride.ride_id]||"").trim();
  if(reason.length<20||reason.length>2000){setError("Escreva uma justificativa de 20 a 2000 caracteres.");return;}
  const label=decision==="COMPLETE"?"concluir":"cancelar";
  if(!window.confirm(`Deseja ${label} esta corrida? A decisão será auditada e não poderá ser revertida por esta tela.`))return;
  setBusy(ride.ride_id);setError("");setNotice("");
  const {data,error:rpcError}=await (supabase as any).rpc("admin_resolve_quick_ride_dispute",{
   p_ride_id:ride.ride_id,p_decision:decision,p_reason:reason
  });
  if(rpcError||data!==true)setError("Não foi possível resolver: "+(rpcError?.message||"Resposta inesperada"));
  else {setNotice("Decisão registrada com auditoria.");setReasons(prev=>({...prev,[ride.ride_id]:""}));}
  await refresh();setBusy(null);
 }
 return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Revisões de encerramento de corrida">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-bold">Revisões de encerramento</h2>
    <p className="text-sm text-muted-foreground">{pending.length} aguardando análise · decisões registradas no histórico.</p>
   </div>
   <Button type="button" variant="outline" onClick={()=>void refresh()} disabled={loading||busy!==null}>Atualizar</Button>
  </div>
  <div className="flex gap-2" role="group" aria-label="Filtrar contestações">
   <Button type="button" variant={filter==="pending"?"default":"outline"} onClick={()=>setFilter("pending")}>Pendentes ({pending.length})</Button>
   <Button type="button" variant={filter==="all"?"default":"outline"} onClick={()=>setFilter("all")}>Todas ({items.length})</Button>
  </div>
  {error&&<p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
  {loading?<p className="text-sm text-muted-foreground">Carregando…</p>:
    visible.length===0?<p className="text-sm text-muted-foreground">Nenhuma contestação nesta visualização.</p>:
    <div className="space-y-3">{visible.map(ride=>{
     const open=(ride.status==="PENDING_REVIEW"||ride.status==="IN_PROGRESS"&&ride.passenger_response==="CONTESTED")&&!ride.admin_decision;
     return <article key={ride.ride_id} className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
       <strong>{ride.municipality} · {ride.vehicle_type==="MOTO"?"Moto":"Carro"}</strong>
       <span>{ride.admin_decision?(ride.admin_decision==="COMPLETE"?"Concluída pela administração":"Cancelada pela administração"):"Aguardando decisão"} · {ride.status}</span>
      </div>
      <p className="break-all text-xs text-muted-foreground">Corrida: {ride.ride_id} · {new Date(ride.requested_at).toLocaleString("pt-BR")}</p>
      <p className="text-sm"><strong>Passageiro:</strong> {ride.passenger_name} · <strong>Motorista:</strong> {ride.driver_name}</p>
      <p className="text-sm"><strong>Embarque:</strong> {ride.origin_label}</p>
      <p className="text-sm"><strong>Destino:</strong> {ride.destination_label}</p>
      <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-sm">
        <strong>Motivo da revisão:</strong> {ride.passenger_response==="CONTESTED"
          ?"Desembarque contestado pelo passageiro"
          :ride.completion_request_method==="MANUAL_REVIEW"
            ?"Pedido manual do motorista (GPS sem verificação)"
            :"Prazo de confirmação encerrado sem resposta do passageiro"}
      </p>
      {ride.driver_review_reason&&<p className="break-words text-sm">
        <strong>Justificativa do motorista:</strong> {ride.driver_review_reason}
      </p>}
      {ride.finish_distance_m!=null&&<p className="text-xs text-muted-foreground">
        GPS registrado no pedido de encerramento: {Math.round(ride.finish_distance_m)} m
        do destino (precisão ±{Math.round(ride.finish_accuracy_m??0)} m).
      </p>}
      {ride.admin_decision?<div className="space-y-1 rounded-lg bg-secondary/40 p-3 text-sm">
       <p><strong>Justificativa:</strong> {ride.admin_reason}</p>
       <p className="text-xs text-muted-foreground">Responsável: {ride.admin_resolved_by||"—"} · {ride.admin_resolved_at?new Date(ride.admin_resolved_at).toLocaleString("pt-BR"):"—"}</p>
      </div>:open?<div className="space-y-2">
       <label htmlFor={`reason-${ride.ride_id}`} className="block text-sm font-semibold">Justificativa fundamentada (obrigatória)</label>
       <textarea id={`reason-${ride.ride_id}`} className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
        placeholder="Descreva as evidências analisadas e o motivo da decisão."
        maxLength={2000} value={reasons[ride.ride_id]||""}
        onChange={e=>setReasons(prev=>({...prev,[ride.ride_id]:e.target.value}))}/>
       <p className="text-xs text-muted-foreground">Analise evidências e ouça as partes antes de decidir. A decisão não confirma pagamentos.</p>
       <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy!==null||(reasons[ride.ride_id]||"").trim().length<20} onClick={()=>void decide(ride,"COMPLETE")}>Confirmar conclusão</Button>
        <Button type="button" variant="destructive" disabled={busy!==null||(reasons[ride.ride_id]||"").trim().length<20} onClick={()=>void decide(ride,"CANCEL")}>Cancelar corrida</Button>
       </div>
      </div>:<p className="text-sm text-muted-foreground">Situação da corrida não permite decisão nesta fila. Verifique o histórico.</p>}
     </article>;
    })}</div>}
 </section>;
}
