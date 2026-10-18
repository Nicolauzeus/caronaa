export type ChartDatum={name:string;value:number};
export type ChartKind="horizontal"|"vertical"|"line"|"ranking";
export function validChartRows(rows:ChartDatum[]):ChartDatum[]{
 return rows.filter(r=>r.name.trim().length>0&&Number.isFinite(r.value)&&r.value>=0);
}
export function rankChartRows(rows:ChartDatum[]):ChartDatum[]{
 return [...validChartRows(rows)].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,"pt-BR"));
}
export function semanticMetricTone(label:string):"danger"|"warning"|"success"|"neutral"{
 const value=label.toLocaleLowerCase("pt-BR").replaceAll("_"," ");
 if(/cancel|failed|refunded|reembols|falha|erro|crític|critica|grave|denúncia|incidente|atraso|déficit/.test(value))return "danger";
 if(/pending|pendente|pausad|suspens|negociac|aguardando|atenção|em análise|em analise|em andamento|sem match|sem correspondência/.test(value))return "warning";
 if(/paid|completed|resolved|convertid|ativa|ativo|concluíd|concluido|resolvid|confirmad|validado|pago|sucesso/.test(value))return "success";
 return "neutral";
}

/** Tailwind-safe semantic colors: never infer quality from a numeric value alone. */
export function statusTextClass(value:string){
 const tone=semanticMetricTone(value);
 return tone==="danger"?"text-destructive font-semibold":tone==="warning"?"text-amber-600 dark:text-amber-400 font-semibold":tone==="success"?"text-emerald-600 dark:text-emerald-400 font-semibold":"text-foreground";
}
