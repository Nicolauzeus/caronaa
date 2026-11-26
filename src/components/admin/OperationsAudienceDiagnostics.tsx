import type { OperationalOverview } from "@/services/operations-service";

export type OperationalFinding={id:string;title:string;detail:string;next:string};
export function buildOperationalFindings(data:OperationalOverview):OperationalFinding[]{
 const s=data.kpis.summary,a=data.audience,n=data.diagnostics.notification_diagnostics;
 const out:OperationalFinding[]=[];
 if(s.unserved>0)out.push({id:"unserved",title:"Demanda encerrada sem atendimento",detail:`${s.unserved} de ${s.requested} pedidos foram cancelados ou expiraram sem aceite.`,next:"Cruzar horários, territórios e motivos registrados."});
 if(a&&a.unserved_snapshot_zero>0)out.push({id:"zero",title:"Sem candidatos no momento da criação",detail:`${a.unserved_snapshot_zero} pedidos Flash não atendidos tinham zero candidatos no radar pré-limite 0233 na criação.`,next:"Verificar cobertura, disponibilidade, GPS, capacidade e modalidade. O cenário pode mudar após a solicitação."});
 if(a&&a.unserved_snapshot_with_candidates>0)out.push({id:"with-candidates",title:"Demanda não atendida apesar de candidatos iniciais",detail:`${a.unserved_snapshot_with_candidates} pedidos Flash não atendidos tinham ao menos um candidato inicial.`,next:"Examinar visualizações, dispensas, aceites e confirmações do aplicativo; não presumir recusa ou entrega."});
 if(a&&a.snapshot_unknown>0)out.push({id:"unknown",title:"Cobertura de candidatos incompleta",detail:`${a.snapshot_unknown} de ${a.flash_orders} pedidos Flash não possuem captura de candidatos na criação.`,next:"Dados anteriores à coleta ou falhas de captura não podem ser classificados como ausência de motoristas."});
 if(n.orders_with_observed_send_failure>0)out.push({id:"send",title:"Falhas de envio registradas",detail:`${n.orders_with_observed_send_failure} pedidos tiveram ao menos uma falha registrada; ${n.unserved_with_observed_send_failure} encerraram sem atendimento.`,next:"Inspecionar os eventos; associação não prova causalidade."});
 const peak=[...data.kpis.hours].filter(h=>h.unserved>0).sort((a,b)=>b.unserved-a.unserved||a.hour-b.hour)[0];
 if(peak)out.push({id:"hour",title:"Horário de maior demanda não atendida",detail:`${String(peak.hour).padStart(2,"0")}h: ${peak.unserved} de ${peak.requests} pedidos encerrados sem aceite, no horário de Fortaleza.`,next:"Avaliar a oferta nesse intervalo. O número é agregado por hora e não prova falta de motorista."});
 return out;
}
export function OperationsAudienceDiagnostics({data}:{data:OperationalOverview}){
 const a=data.audience,findings=buildOperationalFindings(data);
 const metrics=a?[["Pedidos Flash",a.flash_orders],["Captura conhecida",a.snapshot_known],["Sem candidatos iniciais",a.snapshot_zero],["Com candidatos iniciais",a.snapshot_with_candidates],["Captura indisponível",a.snapshot_unknown],["Pedidos com retorno confirmado pelo app",a.orders_with_app_ack],["Pedidos com sinal de fila",a.orders_with_queue_signal]] as const:[];
 return <section className="rounded-2xl border bg-card p-4 space-y-3" aria-label="Diagnósticos operacionais">
  <header><h2 className="font-[Sora] text-lg font-bold">Diagnósticos operacionais</h2><p className="text-xs text-muted-foreground">Sinais verificáveis para orientar a investigação; não são causas comprovadas.</p></header>
  {a&&<><dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{metrics.map(([label,value])=><div key={label} className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-bold tabular-nums text-xl">{value.toLocaleString("pt-BR")}</dd></div>)}</dl>
  <p className="text-xs text-muted-foreground">Candidatos Flash na criação segundo radar 0233, antes do limite individual. Retorno confirmado pelo aplicativo não comprova entrega de push. Zero confirmado é diferente de captura ausente.</p></>}
  {data.kpis.service!=="shared"&&!a&&<p className="text-sm text-muted-foreground">Captura de candidatos e confirmação do app indisponíveis.</p>}
  {!findings.length?<p className="text-sm text-muted-foreground">Nenhum diagnóstico acionável nos registros disponíveis. Isso não comprova ausência de problemas.</p>:
  <ul className="divide-y">{findings.map(f=><li key={f.id} className="space-y-1 py-3"><h3 className="font-semibold text-sm">{f.title}</h3><p className="text-sm">{f.detail}</p><p className="text-xs text-muted-foreground">{f.next}</p></li>)}</ul>}
 </section>;
}
