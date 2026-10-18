export type ChartDatum={name:string;value:number};
export type ChartKind="horizontal"|"vertical"|"line"|"ranking";
export function validChartRows(rows:ChartDatum[]):ChartDatum[]{
 return rows.filter(r=>r.name.trim().length>0&&Number.isFinite(r.value)&&r.value>=0);
}
export function rankChartRows(rows:ChartDatum[]):ChartDatum[]{
 return [...validChartRows(rows)].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,"pt-BR"));
}
export function semanticMetricTone(label:string):"danger"|"warning"|"success"|"neutral"{
 const value=label.toLocaleLowerCase("pt-BR");
 if(/cancel|falha|erro|crític|grave|denúncia|incidente|atraso|reembolso/.test(value))return "danger";
 if(/pendente|aguardando|atenção|em análise|sem match|sem correspondência/.test(value))return "warning";
 if(/concluíd|resolvid|confirmad|validado|pago|sucesso/.test(value))return "success";
 return "neutral";
}
