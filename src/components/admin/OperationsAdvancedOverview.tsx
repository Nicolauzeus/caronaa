import { Activity, ArrowDownRight, BellOff, Clock3, Coins, Filter, UsersRound, XCircle } from "lucide-react";
import { OperationsAudienceDiagnostics } from "./OperationsAudienceDiagnostics";
import type { OperationalOverview } from "@/services/operations-service";

const count=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("pt-BR");
const pct=(v:number|null)=>v==null?"—":v.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const seconds=(v:number|null)=>v==null?"—":Math.floor(Math.round(v)/60)+"m "+Math.round(v)%60+"s";
const money=(v:number|null)=>v==null?"—":(v/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const actorLabels:Record<string,string>={PASSENGER:"Passageiro",DRIVER:"Motorista",ADMIN:"Administração",OTHER_RECORDED_ACTOR:"Outro responsável registrado",AMBIGUOUS:"Ambíguo",UNKNOWN:"Desconhecido"};
export const reasonLabels:Record<string,string>={WAIT_TOO_LONG:"Demora",CHANGED_PLANS:"Mudança de planos",PRICE:"Preço",FOUND_ALTERNATIVE:"Outro transporte",WRONG_ROUTE:"Trajeto incorreto",TECHNICAL_PROBLEM:"Problema técnico",OTHER:"Outro",PREFER_NOT_TO_SAY:"Prefere não informar",REASON_NOT_RECORDED:"Motivo não registrado",REASON_NOT_CLASSIFIED:"Motivo não classificado"};
export function operationalAggregateRows(data:OperationalOverview){
 const s=data.kpis.summary,r=data.conversion.retention,n=data.diagnostics.notification_diagnostics;
 return [
  {label:"Demanda não atendida",value:count(s.unserved)},
  {label:"Espera média até aceite",value:seconds(s.mean_wait_seconds)},
  {label:"Espera mediana até aceite",value:seconds(s.median_wait_seconds)},
  {label:"Amostras de tempo de espera",value:count(s.wait_samples)},
  {label:"Retenção do período anterior",value:pct(r.previous_cohort_retention_pct)},
  {label:"Passageiros que voltaram após intervalo",value:count(r.returned_after_gap)},
  {label:"Valor bruto cotado não atendido",value:money(s.unserved_quoted_value_cents)},
  {label:"Pedidos com falha de envio observada",value:count(n.orders_with_observed_send_failure)},
  {label:"Pedidos sem evidência de notificação",value:count(n.orders_without_receipts)},
  ...(data.diagnostics.flash_manual_pix?[{label:"Pix com confirmação bilateral (Flash)",value:count(data.diagnostics.flash_manual_pix.bilateral_pix_orders)}]:[]),
 ];
}
export function OperationsAdvancedOverview({data,loading,error}:{data:OperationalOverview|null;loading:boolean;error:string}){
 if(loading)return <div role="status" className="ops-panel p-4"><p className="text-sm text-muted-foreground">Carregando inteligência operacional…</p><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-hidden="true">{Array.from({length:6},(_,i)=><div key={i} className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"/>)}</div></div>;
 if(!data)return <p role="status" className="ops-panel p-4 text-sm text-muted-foreground">{error||"Indicadores avançados indisponíveis."}</p>;
 const s=data.kpis.summary,r=data.conversion.retention,n=data.diagnostics.notification_diagnostics;
 const tiles=[
  {title:"Demanda não atendida",value:count(s.unserved),hint:pct(s.unserved_pct)+" dos pedidos",icon:ArrowDownRight,tone:"text-red-600 dark:text-red-300"},
  {title:"Espera média até aceite",value:seconds(s.mean_wait_seconds),hint:count(s.wait_samples)+" amostras · mediana "+seconds(s.median_wait_seconds),icon:Clock3,tone:"text-amber-700 dark:text-yellow-300"},
  {title:"Retenção",value:pct(r.previous_cohort_retention_pct),hint:count(r.retained_from_previous)+" de "+count(r.previous_passengers)+" passageiros anteriores",icon:UsersRound,tone:"text-emerald-700 dark:text-emerald-300"},
  {title:"Valor bruto cotado não atendido",value:money(s.unserved_quoted_value_cents),hint:"Não é receita · "+count(s.unserved_unknown_fare)+" sem valor",icon:Coins,tone:"text-amber-700 dark:text-yellow-300"},
  {title:"Falhas de envio observadas",value:count(n.orders_with_observed_send_failure),hint:"Pedidos com evidência registrada",icon:Activity,tone:"text-red-600 dark:text-red-300"},
  {title:"Sem evidência de notificação",value:count(n.orders_without_receipts),hint:"Não comprova falha de entrega",icon:BellOff,tone:"text-muted-foreground"},
 ];
 const cancellationTotal=data.cancellations.total_cancelled;
 const actors=new Map<string,number>();
 for(const g of data.cancellations.groups)actors.set(g.actor,(actors.get(g.actor)??0)+g.cancelled_orders);
 const actorColors:Record<string,string>={PASSENGER:"#FFBB00",DRIVER:"#E58B39",ADMIN:"#8B8B8B",OTHER_RECORDED_ACTOR:"#5B9EB3",AMBIGUOUS:"#9A78B2",UNKNOWN:"#64748B"};
 let offset=0;
 const segments=[...actors].map(([actor,value])=>{const from=offset;offset+=cancellationTotal?value/cancellationTotal*100:0;return {actor,value,color:actorColors[actor]??"#64748B",from,to:offset};});
 const ring=segments.length&&cancellationTotal>0?"conic-gradient("+segments.map(x=>x.color+" "+x.from+"% "+x.to+"%").join(",")+")":"var(--ops-line,#e4e4e7)";
 return <section className="space-y-4" aria-label="Inteligência operacional avançada">
  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de atendimento">
   {tiles.map(({title,value,hint,icon:Icon,tone})=><div key={title} className="ops-metric p-3 sm:p-4"><div className="flex items-start gap-2"><span className="ops-icon"><Icon size={18} className={tone} aria-hidden="true"/></span><dt className="text-xs font-semibold leading-snug text-muted-foreground">{title}</dt></div><dd className="ops-metric-value mt-3">{value}</dd><p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p></div>)}
  </dl>
  <div className="grid min-w-0 gap-3 lg:grid-cols-2">
   <article className="ops-panel p-4">
    <header className="flex items-start gap-2"><span className="ops-icon"><Filter size={19} className="text-amber-700 dark:text-yellow-300"/></span><div><h2 className="font-[Sora] text-lg font-bold">Conversão por cotação</h2><p className="text-xs text-muted-foreground">Coorte de cotações emitidas · vínculos persistidos</p></div></header>
    {data.funnel.rows.map(x=><div key={x.service} className="mt-4 rounded-xl border p-3">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-1"><h3 className="text-sm font-bold">{x.service==="flash"?"Corrida Rápida":"Caronas compartilhadas"}</h3><span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold">Conclusão: {pct(x.completion_pct)}</span></div>
     <div className="grid grid-cols-4 gap-2" aria-label={"Etapas de cotação "+x.service}>
     {([["Emitidas",x.quotes_issued],["Com pedido",x.quotes_with_request],["Com aceite",x.quotes_with_acceptance],["Concluídas",x.quotes_with_completion]] as const).map(([label,value],i)=><div key={label} className="flex min-w-0 flex-col items-center justify-end gap-1 text-center"><span className="text-xs font-bold tabular-nums">{count(value)}</span><div className="flex h-24 w-full items-end rounded-md bg-muted/40" aria-hidden="true"><div className="w-full rounded-t-md" style={{height:(x.quotes_issued?100*value/x.quotes_issued:0)+"%",backgroundColor:["#FFBB00","#E9AB00","#CA9500","#A77B00"][i]}}/></div><span className="min-h-8 text-[10px] leading-tight text-muted-foreground sm:text-xs">{label}</span></div>)}
     </div>
    </div>)}
    <p className="mt-3 text-xs text-muted-foreground">Cada etapa conta IDs de cotação, não pedidos. Cotações compartilhadas incluem ofertas de motoristas.</p>
   </article>
   <article className="ops-panel p-4">
    <header className="flex items-start gap-2"><span className="ops-icon"><XCircle size={19} className="text-red-600 dark:text-red-300"/></span><div><h2 className="font-[Sora] text-lg font-bold">Cancelamentos registrados</h2><p className="text-xs text-muted-foreground">Resultado terminal · responsabilidade observada</p></div></header>
    {cancellationTotal===0?<p className="mt-5 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">Nenhum cancelamento no período.</p>:<>
      <div className="mt-4 flex flex-wrap items-center gap-4">
       <div className="relative mx-auto grid size-32 shrink-0 place-items-center rounded-full" style={{background:ring}} role="img" aria-label={segments.map(x=>(actorLabels[x.actor]??x.actor)+": "+x.value).join("; ")}><div className="grid size-24 place-content-center rounded-full text-center" style={{background:"var(--ops-surface,#fff)"}}><strong className="text-2xl tabular-nums">{count(cancellationTotal)}</strong><span className="text-[10px] text-muted-foreground">cancelamentos</span></div></div>
       <ul className="min-w-[120px] flex-1 space-y-2">{segments.map(x=><li key={x.actor} className="flex items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{background:x.color}}/><span className="flex-1">{actorLabels[x.actor]??x.actor}</span><strong className="tabular-nums">{count(x.value)}</strong></li>)}</ul>
      </div>
      <details className="ops-disclosure mt-4 rounded-xl border"><summary>Detalhar motivos <span className="sr-only">de cancelamento</span></summary><ul className="divide-y px-3">{data.cancellations.groups.map(g=><li key={g.actor+":"+g.reason_code} className="flex items-start justify-between gap-2 py-2 text-sm"><div><strong>{actorLabels[g.actor]??g.actor}</strong><p className="text-xs text-muted-foreground">{reasonLabels[g.reason_code]??"Motivo não classificado"} · {g.before_acceptance} antes / {g.after_acceptance} após aceite</p></div><strong>{count(g.cancelled_orders)}</strong></li>)}</ul></details>
    </>}
    <p className="mt-3 text-xs text-muted-foreground">Responsável desconhecido não significa cancelamento pelo sistema. Expiração é um resultado separado.</p>
   </article>
  </div>
  <OperationsAudienceDiagnostics data={data}/>
  <details className="ops-disclosure ops-panel"><summary>Indicadores complementares de atendimento</summary><div className="grid gap-2 p-3 sm:grid-cols-2">
   <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Passageiros que voltaram após intervalo</p><strong>{count(r.returned_after_gap)}</strong></div>
   {data.diagnostics.flash_manual_pix&&<div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Pix com confirmação bilateral (Flash)</p><strong>{count(data.diagnostics.flash_manual_pix.bilateral_pix_orders)}</strong><p className="text-xs text-muted-foreground">Não comprova liquidação bancária.</p></div>}
  </div></details>
 </section>;
}
