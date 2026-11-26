import { OperationsAudienceDiagnostics } from "./OperationsAudienceDiagnostics";
import type { OperationalOverview } from "@/services/operations-service";

const count=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("pt-BR");
const pct=(v:number|null)=>v==null?"—":v.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const seconds=(v:number|null)=>v==null?"—":Math.floor(v/60)+"m "+Math.round(v%60)+"s";
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
 if(loading)return <p role="status" className="rounded-xl border bg-card p-4 text-sm">Carregando inteligência operacional…</p>;
 if(!data)return <p role="status" className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{error||"Indicadores avançados indisponíveis."}</p>;
 return <section className="space-y-3" aria-label="Inteligência operacional avançada">
  <article className="rounded-2xl border bg-card p-4">
   <h2 className="font-[Sora] text-lg font-bold">Atendimento e retenção</h2>
   <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
    {operationalAggregateRows(data).map(x=><div key={x.label} className="min-w-0 rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{x.label}</dt><dd className="mt-1 break-words text-lg font-extrabold tabular-nums">{x.value}</dd></div>)}
   </dl>
   <p className="mt-3 text-xs text-muted-foreground">Demanda não atendida: cancelados ou expirados sem aceite. Valores cotados não são receitas; confirmação bilateral não é liquidação bancária. Ausência de evidência não prova falha.</p>
  </article>
  <div className="grid gap-3 lg:grid-cols-2">
   <article className="rounded-2xl border bg-card p-4">
    <h2 className="font-[Sora] text-lg font-bold">Conversão por cotação</h2>
    {data.funnel.rows.map(x=><div key={x.service} className="mt-3 space-y-2">
     <h3 className="text-sm font-semibold">{x.service==="flash"?"Corrida Rápida":"Caronas compartilhadas"}</h3>
     {([["Emitidas",x.quotes_issued],["Com pedido",x.quotes_with_request],["Com aceite",x.quotes_with_acceptance],["Com conclusão",x.quotes_with_completion]] as const).map(([label,n])=><div key={label}><div className="flex justify-between text-xs"><span>{label}</span><strong>{count(n)}</strong></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-[#FFBB00]" style={{width:(x.quotes_issued?100*n/x.quotes_issued:0)+"%"}}/></div></div>)}
     <p className="text-xs text-muted-foreground">Conclusão por cotação: {pct(x.completion_pct)}</p>
    </div>)}
    <p className="mt-3 text-xs text-muted-foreground">Cada etapa conta IDs de cotação, não pedidos. Cotações compartilhadas incluem ofertas de motoristas.</p>
   </article>
   <article className="rounded-2xl border bg-card p-4">
    <h2 className="font-[Sora] text-lg font-bold">Cancelamentos registrados</h2>
    {data.cancellations.groups.length===0?<p className="mt-3 text-sm text-muted-foreground">Nenhum cancelamento no período.</p>:<ul className="mt-3 divide-y">{data.cancellations.groups.map(g=><li key={g.actor+":"+g.reason_code} className="flex items-start justify-between gap-2 py-2 text-sm"><div><strong>{actorLabels[g.actor]??g.actor}</strong><p className="text-xs text-muted-foreground">{reasonLabels[g.reason_code]??"Motivo não classificado"} · {g.before_acceptance} antes / {g.after_acceptance} após aceite</p></div><strong>{count(g.cancelled_orders)}</strong></li>)}</ul>}
    <p className="mt-3 text-xs text-muted-foreground">Responsável desconhecido não significa cancelamento pelo sistema.</p>
   </article>
  </div>
  <OperationsAudienceDiagnostics data={data}/>
 </section>;
}
