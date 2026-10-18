import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {ExecutiveGovernance} from "@/components/admin/ExecutiveGovernance";
import {InsightChart} from "@/components/admin/InsightChart";
import {useAdminModuleSection} from "@/lib/admin/use-admin-module-section";
import {getOperationalMetrics,type OperationalMetrics} from "@/lib/operational-metrics";
import {getMainFunnelMetrics,type MainFunnelSummary} from "@/lib/main-funnel-metrics";
import {getFormMetrics,type FormMetricsSummary} from "@/lib/formulario/metrics";
export const Route=createFileRoute("/admin/executivo")({component:ExecutivePage});
function ExecutivePage(){
 const [section]=useAdminModuleSection({overview:"overview",okrs:"okrs",decisions:"decisions",risk:"risk"},"overview");
 const [data,setData]=useState<{operations:OperationalMetrics|null;funnel:MainFunnelSummary|null;forms:FormMetricsSummary|null}>({operations:null,funnel:null,forms:null});
 const [failed,setFailed]=useState<string[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const start=new Date();start.setDate(start.getDate()-30);const periodStart=start.toISOString();
 void Promise.allSettled([getOperationalMetrics({periodStart}),getMainFunnelMetrics({periodStart},"user_registered"),getFormMetrics({periodStart})]).then(r=>{if(!active)return;setData({operations:r[0].status==="fulfilled"?r[0].value:null,funnel:r[1].status==="fulfilled"?r[1].value:null,forms:r[2].status==="fulfilled"?r[2].value:null});setFailed(r.flatMap((x,i)=>x.status==="rejected"?[["Operações","Funil","Pesquisas"][i]]:[]));setLoading(false)});return()=>{active=false}},[]);
 const fmt=(n:number|null|undefined)=>typeof n==="number"&&Number.isFinite(n)?n.toLocaleString("pt-BR"):"N/D";
 const metrics=[{label:"Solicitações elegíveis",value:data.operations?.request.eligibleRequests,source:"Eventos operacionais"},{label:"Correspondências",value:data.operations?.match.total,source:"Eventos operacionais"},{label:"Viagens concluídas",value:data.operations?.match.completed,source:"Eventos operacionais"},{label:"Coorte de cadastros",value:data.funnel?.cohortSize,source:"Funil por usuários registrados"}];
 return <main className="space-y-7">
 <header><p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary">CARONAA · ESS / MIS</p><h1 className="mt-1 text-3xl font-extrabold">Centro Executivo</h1><p className="mt-2 text-sm text-muted-foreground">Indicadores dos últimos 30 dias e registros administrativos estratégicos. Sem dados simulados.</p></header>
 {failed.length>0&&<p role="alert" className="rounded-xl border p-3 text-sm text-muted-foreground">Fontes indisponíveis: {failed.join(", ")}. Indicadores afetados mostram N/D.</p>}
 {section==="overview"&&<><section aria-label="Indicadores executivos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><article key={m.label} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{m.label}</p><p className="mt-3 text-3xl font-bold">{loading?"…":fmt(m.value)}</p><p className="mt-2 text-xs text-muted-foreground">Fonte: {m.source}</p></article>)}</section>
 <section className="space-y-3"><h2 className="text-xl font-bold">Funil de ativação</h2>{loading?<p role="status" className="text-sm">Carregando...</p>:data.funnel?.stages?.length?<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.funnel.stages.map(stage=><div key={stage.key} className="rounded-xl border bg-card p-4"><p className="text-sm font-medium">{stage.label}</p><p className="mt-2 text-2xl font-bold">{fmt(stage.count)}</p><p className="text-xs text-muted-foreground">{stage.unavailableReason??"Coorte: últimos 30 dias"}</p></div>)}</div>:<p className="rounded-xl border p-4 text-sm text-muted-foreground">Funil indisponível.</p>}</section>
 <InsightChart title="Funil de ativação por etapa" description="Volume de registros por etapa da coorte. Os números não devem ser somados como pessoas distintas." rows={(data.funnel?.stages??[]).filter(s=>typeof s.count==="number").map(s=>({name:s.label,value:Number(s.count)}))}/></>}
 {section!=="overview"&&<ExecutiveGovernance/>}
 </main>;
}
