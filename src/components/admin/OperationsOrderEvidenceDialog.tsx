import { useEffect, useState } from "react";
import { Activity, ArrowRight, Clock3, FileText, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { operationsService, type OperationalEvidence, type OrderService } from "@/services/operations-service";
import { reasonLabels } from "./OperationsAdvancedOverview";
const eventLabels:Record<string,string>={
 queue_signal_recorded:"Sinal de atualização da fila registrado",
 radar_client_acknowledged:"Recebimento do radar declarado pelo aplicativo",
 creation_candidates_snapshot:"Candidatos no momento da criação",
 shared_attempt_cancel_reason:"Motivo da combinação cancelada",
 requested:"Pedido solicitado",accepted:"Aceite registrado",arrived:"Chegada ao embarque",
 pickup_confirmed:"Embarque confirmado",in_trip:"Viagem iniciada",completed:"Corrida concluída",
 passenger_cancelled:"Cancelamento pelo passageiro",driver_cancelled:"Cancelamento pelo motorista",
 driver_first_view:"Primeira visualização registrada",driver_last_view:"Última visualização registrada",
 driver_skipped:"Dispensa registrada",notification_eligible:"Elegibilidade observada",
 notification_send_attempted:"Tentativa de envio",notification_provider_accepted:"Aceite do provedor",
 notification_delivery_confirmed:"Entrega confirmada",notification_send_failed:"Falha de envio",
 notification_record_created:"Registro de notificação criado",notification_read:"Notificação lida",
 quote_issued:"Cotação emitida",expiry_deadline:"Prazo de expiração",ride_status_changed:"Mudança de status",
};
const fmtDate=(v:string)=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString("pt-BR",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Horário indisponível";};
const string=(x:unknown)=>typeof x==="string"?x:"";
export function OperationsOrderEvidenceDialog({service,id,onClose}:{service:OrderService;id:string;onClose:()=>void}){
 const [data,setData]=useState<OperationalEvidence|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  setLoading(true);setData(null);setError("");
  void Promise.resolve().then(()=>operationsService.getEvidence(service,id)).then(x=>{
   if(active){setData(x);if(!x)setError("Pedido não encontrado.");}
  }).catch(()=>{if(active)setError("Evidências indisponíveis para este pedido.");}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[service,id]);
 const order=data?.order;
 const fields=[["Motoristas elegíveis observados","drivers_eligible_observed"],["Visualizações registradas","drivers_with_recorded_view"],["Entregas confirmadas","drivers_delivery_confirmed_observed"],["Falhas de envio observadas","drivers_send_failed_observed"],["Sinais de fila registrados","queue_signals_recorded"],["Aplicativos que confirmaram retorno","drivers_radar_acknowledged"],["Candidatos na criação (pré-limite)","creation_radar_candidates"]] as const;
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
  <DialogContent className="ops-dialog flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-none p-4 sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl sm:p-6">
   <header className="shrink-0 border-b pb-3 pr-8"><div className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><FileText size={15}/> Rastreabilidade operacional</div><DialogTitle>Histórico individual do pedido</DialogTitle>
   <DialogDescription>Eventos registrados · horário de Fortaleza · precisão em segundos.</DialogDescription></header>
   {loading&&<p role="status">Consultando evidências…</p>}
   {error&&<p role="alert" className="text-sm">{error}</p>}
   {data&&order&&<div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
    <dl className="ops-dialog-inset grid grid-cols-2 gap-3 rounded-xl border p-3 text-sm">
     <div><dt className="text-xs text-muted-foreground">Passageiro</dt><dd>{string(order.passenger_name)||"Não identificado"}</dd></div>
     <div><dt className="text-xs text-muted-foreground">Motorista</dt><dd>{string(order.driver_name)||"Não atribuído / não identificado"}</dd></div>
     <div><dt className="text-xs text-muted-foreground">Solicitação</dt><dd>{fmtDate(order.requested_at)}</dd></div>
     <div><dt className="text-xs text-muted-foreground">Serviço</dt><dd>{service==="flash"?"Corrida Rápida":"Carona compartilhada"}</dd></div>
     <div className="col-span-2 min-w-0 border-t pt-3"><dt className="text-xs text-muted-foreground">Trajeto</dt><dd className="mt-1 flex flex-wrap items-center gap-2 break-words font-semibold"><MapPin size={16} className="shrink-0"/><span>{string(order.origin)||"—"}</span><ArrowRight size={14}/><span>{string(order.destination)||"—"}</span></dd></div>
    </dl>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
     {fields.map(([label,key])=><div key={key} className="ops-dialog-inset min-w-0 rounded-xl border p-3"><dt className="text-xs leading-snug text-muted-foreground">{label}</dt><dd className="mt-1 font-[Sora] text-xl font-extrabold tabular-nums">{typeof data.counts[key]==="number"?String(data.counts[key]):"N/D"}</dd></div>)}
    </dl>
    <details className="ops-dialog-inset rounded-xl border p-3"><summary className="cursor-pointer text-xs font-bold">Como interpretar as evidências</summary><p className="mt-2 text-xs text-muted-foreground">Cobertura parcial. Candidatos na criação usam a regra de radar 0233 antes do limite da fila. Elegibilidade observada é uma consulta posterior. Nomes refletem o cadastro atual. Sinal de fila é uma atualização no banco; confirmação do aplicativo não comprova push entregue. Ausência de confirmação não significa ausência de entrega.</p></details>
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-[Sora] text-base font-bold"><Activity size={18}/> Linha do tempo</h3><span className="text-xs text-muted-foreground">{data.events.length} eventos</span></div>
    {!data.events.length&&<p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
    <ol className="ops-timeline-list" aria-label="Linha do tempo">
     {data.events.map((event,i)=>{
      const actor=event.actor_id===order.passenger_id?"Passageiro":event.actor_id&&event.actor_id===order.driver_id?"Motorista atribuído":event.actor_id?"Outro participante registrado":"Responsável não comprovado";
      const reason=reasonLabels[string(event.detail.reason_code)];
      const actorName=string(event.detail.actor_name_current);
      const recipientName=string(event.detail.recipient_name_current);
      const projected=event.detail.evidence==="deadline_not_observed_transition";
      const candidates=typeof event.detail.candidate_count==="number"?event.detail.candidate_count:null;
      return <li key={event.occurred_at+":"+event.event_type+":"+i} className="space-y-1 pb-4 pt-3 text-sm">
       <time className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground" dateTime={event.occurred_at}><Clock3 size={12}/>{fmtDate(event.occurred_at)}</time>
       <strong>{eventLabels[event.event_type]??event.event_type.replaceAll("_"," ")}</strong>
       <p className="text-xs text-muted-foreground">{actor}{actorName?" · "+actorName:""}{recipientName?" · Destinatário: "+recipientName:""}{reason?" · "+reason:""}{projected?" · Prazo calculado, não transição registrada":""}{candidates!==null?" · "+candidates+" candidatos pré-limite":""}</p>
      </li>;
     })}
    </ol>
   </div>}
   <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl border px-4 font-semibold">Voltar</button>
  </DialogContent>
 </Dialog>;
}
