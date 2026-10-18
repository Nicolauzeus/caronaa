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
 if(/pending|pendente|aguardando|atenção|em análise|em andamento|sem match|sem correspondência/.test(value))return "warning";
 if(/paid|completed|resolved|concluíd|concluido|resolvid|confirmad|validado|pago|sucesso/.test(value))return "success";
 return "neutral";
}
