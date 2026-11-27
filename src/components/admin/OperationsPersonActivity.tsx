import { useEffect, useState } from "react";
import { Activity, ArrowRight, CalendarDays, ChevronRight } from "lucide-react";
import { operationsService, type OperationalPersonHistory, type OrderService } from "@/services/operations-service";
import { Button } from "@/components/ui/button";
import { OperationsOrderEvidenceDialog } from "./OperationsOrderEvidenceDialog";
const fmt=(v:number|null)=>v===null?"N/D":v.toLocaleString("pt-BR");
const duration=(v:number|null)=>v===null?"N/D":Math.floor(Math.round(v)/60)+"m "+Math.round(v)%60+"s";
const date=(v:string)=>new Date(v).toLocaleString("pt-BR",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
const day=(d:Date)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const statuses:Record<string,string>={SEARCHING:"Aguardando",ACCEPTED:"Aceito",ARRIVED:"Chegada",IN_PROGRESS:"Em atendimento",PENDING_REVIEW:"Em revisão",COMPLETED:"Concluído",CANCELLED:"Cancelado",EXPIRED:"Expirado",OTHER:"Outro"};
export function OperationsPersonActivity({personId,role}:{personId:string;role:"driver"|"passenger"}){
 const [days,setDays]=useState(30),[service,setService]=useState<"all"|"flash"|"shared">("all"),[page,setPage]=useState(0),[reload,setReload]=useState(0);
 const [state,setState]=useState<{key:string;data:OperationalPersonHistory|null;error:string}|null>(null);
 const [selected,setSelected]=useState<{id:string;service:OrderService}|null>(null);
 const today=new Date(),to=day(today),from=day(new Date(today.getTime()-(days-1)*86400000));
 const key=JSON.stringify([personId,role,from,to,service,page,reload]);
 const current=state?.key===key?state:null;
 const data=current?.data??null;
 useEffect(()=>{
  let active=true;
  void Promise.resolve().then(()=>operationsService.getPersonHistory(personId,role,{from,to,service},10,page*10)).then(data=>{
   if(active)setState({key,data,error:data?"":"Conta não encontrada."});
  }).catch(()=>{if(active)setState({key,data:null,error:"Histórico indisponível. Verifique a migration 0259."});});
  return()=>{active=false;};
 },[personId,role,from,to,service,page,key]);
 const s=data?.summary;
 const driver=role==="driver";
 const metrics=s?[
  [driver?"Pedidos com participação registrada":"Pedidos realizados",fmt(s.orders)],
  ["Aceitos",fmt(s.accepted)],["Concluídos",fmt(s.completed)],
  [driver?"Cancelados pelo motorista":"Cancelados",fmt(s.cancelled)],
  ...(driver?[["Visualizações Flash",fmt(s.recorded_views)],["Dispensas Flash",fmt(s.recorded_skips)],["Elegíveis observados",fmt(s.observed_eligible)],["Tempo médio até aceite",duration(s.mean_accept_seconds)+" · "+s.accept_samples+" amostras"],["Tempo médio até chegada",duration(s.mean_arrival_seconds)+" · "+s.arrival_samples+" amostras"],["Tempo médio até visualização",duration(s.mean_view_seconds)+" · "+s.view_samples+" amostras"]]:[])
 ]:[];
 return <section className="space-y-3 border-t pt-4" aria-label={driver?"Desempenho individual":"Histórico do passageiro"}>
  <div className="flex items-start gap-2"><Activity size={19} className="mt-0.5 shrink-0 text-amber-700 dark:text-yellow-300"/><div><h3 className="font-[Sora] text-lg font-bold">{driver?"Desempenho individual":"Histórico de pedidos"}</h3><p className="text-xs text-muted-foreground">Data da solicitação · horário de Fortaleza.</p></div></div>
  <div className="ops-dialog-inset flex flex-wrap items-center gap-2 rounded-xl border p-2">
   <CalendarDays size={16} className="shrink-0 text-muted-foreground"/><select aria-label="Período de atividade" value={days} onChange={e=>{setDays(Number(e.target.value));setPage(0);}} className="min-h-10 rounded-lg border bg-background p-2 text-sm"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select>
   <select aria-label="Serviço da atividade" value={service} onChange={e=>{setService(e.target.value as typeof service);setPage(0);}} className="min-h-10 rounded-lg border bg-background p-2 text-sm"><option value="all">Todos</option><option value="flash">Flash</option><option value="shared">Caronas</option></select>
   <Button size="sm" variant="outline" onClick={()=>setReload(x=>x+1)}>Atualizar</Button>
  </div>
  {!current&&<p role="status" className="text-sm">Consultando histórico…</p>}
  {current?.error&&<p role="alert" className="text-sm text-muted-foreground">{current.error}</p>}
  {data&&s&&<>
   <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{metrics.map(([label,value])=><div key={label} className="ops-dialog-inset min-w-0 rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-[Sora] text-base font-bold tabular-nums">{value}</dd></div>)}</dl>
   <p className="text-xs text-muted-foreground">{driver?"Participação observada por pedido; aceite e cancelamento podem coexistir. Sem registro não comprova ausência de elegibilidade.":"Pedidos únicos e seu resultado atual; não inclui ofertas de motorista."}</p>
   <ul className="space-y-2" aria-label="Histórico de atividade">{data.rows.map(r=><li key={r.service+":"+r.id} className="rounded-xl border"><button type="button" className="block w-full min-w-0 space-y-1 p-3 text-left hover:bg-muted/30" onClick={()=>setSelected({id:r.id,service:r.service})}><span className="block text-xs text-muted-foreground">{date(r.requested_at)} · {r.service==="flash"?"Flash":"Carona"}</span><span className="block break-words text-sm font-semibold">{r.origin||"—"} <ArrowRight size={13} className="inline-block"/> {r.destination||"—"}</span><span className="block text-xs text-muted-foreground">Pedido: {statuses[r.status]??r.status}{driver?" · "+[r.accepted?"Aceite registrado":null,r.completed?"Conclusão registrada":null,r.cancelled?"Cancelamento pelo motorista":null,r.viewed?"Visualizado":null,r.skipped?"Dispensado":null].filter(Boolean).join(" · "):""}</span><span className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2">Ver evidências <ChevronRight size={13}/></span></button></li>)}</ul>
   {!data.rows.length&&<p className="text-sm text-muted-foreground">Nenhum registro no intervalo.</p>}
   <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs">Página {page+1} · {s.orders} registro(s)</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(x=>x-1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(page+1)*10>=s.orders} onClick={()=>setPage(x=>x+1)}>Próxima</Button></div></div>
  </>}
  {selected&&<OperationsOrderEvidenceDialog key={selected.service+":"+selected.id} {...selected} onClose={()=>setSelected(null)}/>}
 </section>;
}
