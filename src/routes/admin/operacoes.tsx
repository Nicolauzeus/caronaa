import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useMemo,useState} from "react";
import {getOperationalMetrics,type OperationalMetrics} from "@/lib/operational-metrics";
import {BarChart,Bar,ResponsiveContainer,XAxis,YAxis,CartesianGrid,Tooltip} from "recharts";

export const Route=createFileRoute("/admin/operacoes")({component:MobilityOperationsCenter});
const destinations=[
 {name:"Caronas",description:"Ofertas e viagens registradas",url:"/admin/caronas"},
 {name:"Solicitações",description:"Pedidos de passageiros",url:"/admin/solicitacoes"},
 {name:"Correspondências",description:"Matches e compatibilidade",url:"/admin/matching"},
 {name:"Motoristas",description:"Base de motoristas",url:"/admin/motoristas"},
 {name:"Passageiros",description:"Base de passageiros",url:"/admin/passageiros"}
] as const;
const display=(value:number|null|undefined,suffix="")=>typeof value==="number"&&Number.isFinite(value)?value.toLocaleString("pt-BR",{maximumFractionDigits:1})+suffix:"N/D";
function MobilityOperationsCenter(){
 const [days,setDays]=useState<7|30|90>(30);
 const [metrics,setMetrics]=useState<OperationalMetrics|null>(null);
 const [pending,setPending]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setPending(true);setError("");const start=new Date();start.setDate(start.getDate()-days);
 void getOperationalMetrics({periodStart:start.toISOString()}).then(data=>{if(active)setMetrics(data)}).catch(err=>{if(active){setMetrics(null);setError(err instanceof Error?err.message:"Indicadores indisponíveis")}}).finally(()=>{if(active)setPending(false)});
 return()=>{active=false}},[days,refresh]);
 const totals=useMemo(()=>metrics?[
 {label:"Solicitações elegíveis",value:metrics.request.eligibleRequests},
 {label:"Sem correspondência",value:metrics.request.unmatchedRequests},
 {label:"Ofertas elegíveis",value:metrics.offer.eligibleOffers},
 {label:"Combinações",value:metrics.match.total},
 {label:"Viagens concluídas",value:metrics.match.completed},
 {label:"Cancelamentos",value:metrics.match.cancelled}
 ]:[],[metrics]);
 const comparison=useMemo(()=>metrics?[
 {name:"Solicitações",total:metrics.request.eligibleRequests,comMatch:metrics.request.matchedRequests},
 {name:"Ofertas",total:metrics.offer.eligibleOffers,comMatch:metrics.offer.utilizedOffers}
 ]:[],[metrics]);
 return <main className="space-y-6">
 <header className="flex flex-wrap items-end justify-between gap-3"><div><Link to="/admin/departamentos/operations" className="text-sm font-semibold text-primary">← Operações de Mobilidade</Link><p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary">CARONAA · Centro Operacional</p><h1 className="mt-1 text-3xl font-extrabold">Inteligência da operação</h1><p className="mt-2 text-sm text-muted-foreground">Dados operacionais consolidados a partir de eventos confiáveis, sem valores simulados.</p></div><div className="flex flex-wrap gap-2"><label className="text-sm">Período<select aria-label="Período das operações" className="ml-2 rounded-lg border bg-background p-2" value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select></label><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setRefresh(v=>v+1)}>Atualizar</button></div></header>
 {error&&<p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive" role="alert">Não foi possível carregar as métricas: {error}. As informações indisponíveis não foram substituídas por zero.</p>}
 <section aria-label="Indicadores operacionais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(pending?Array.from({length:6},(_,i)=>({label:["Solicitações elegíveis","Sem correspondência","Ofertas elegíveis","Combinações","Viagens concluídas","Cancelamentos"][i],value:null})):totals.length?totals:Array.from({length:6},(_,i)=>({label:["Solicitações elegíveis","Sem correspondência","Ofertas elegíveis","Combinações","Viagens concluídas","Cancelamentos"][i],value:null}))).map(m=><article key={m.label} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{m.label}</p><p className="mt-3 text-3xl font-extrabold">{pending?"…":display(m.value)}</p><p className="mt-2 text-xs text-muted-foreground">Fonte: get_operational_metrics · {days} dias</p></article>)}</section>
 <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"><div className="min-w-0 space-y-3 rounded-xl border bg-card p-4"><h2 className="text-lg font-bold">Oferta e demanda</h2><p className="text-xs text-muted-foreground">Contagens absolutas. O grupo com correspondência está contido no total e não deve ser somado novamente.</p>{metrics?<div className="h-64 w-full" role="img" aria-label="Gráfico comparativo de solicitações e ofertas"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison}><CartesianGrid strokeDasharray="3 3" opacity={0.15}/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar name="Total" dataKey="total" fill="#e4ac18"/><Bar name="Com correspondência" dataKey="comMatch" fill="#888888"/></BarChart></ResponsiveContainer></div>:<p className="py-12 text-center text-sm text-muted-foreground">{pending?"Carregando gráfico...":"Sem dados disponíveis"}</p>}</div>
 <div className="space-y-3 rounded-xl border bg-card p-4"><h2 className="text-lg font-bold">Eficiência operacional</h2><dl className="space-y-4 text-sm">{[
 ["Taxa de correspondência de solicitações",metrics?.request.requestMatchRate,"%"],
 ["Taxa de utilização das ofertas",metrics?.offer.offerMatchRate,"%"],
 ["Ocupação dos assentos",metrics?.seats.seatFillRate,"%"],
 ["Tempo médio até o match",metrics?.match.averageMinutesToMatch," min"]
 ].map(([label,value,suffix])=><div key={String(label)} className="flex justify-between gap-3 border-b pb-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-bold">{pending?"…":display(value as number|null|undefined,String(suffix))}</dd></div>)}</dl><p className="text-xs text-muted-foreground">Taxas calculadas pela fonte de métricas operacionais. N/D indica ausência de medição válida.</p></div></section>
 <section className="space-y-3"><h2 className="text-xl font-bold">Gestão das operações</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{destinations.map(d=><Link key={d.url} to={d.url} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary"><h3 className="font-bold">{d.name} →</h3><p className="mt-2 text-sm text-muted-foreground">{d.description}</p></Link>)}</div></section>
 <section className="rounded-xl border bg-secondary/20 p-4"><h2 className="font-bold">Mobilidade profissional local</h2><p className="mt-2 text-sm text-muted-foreground">Monitoramento de profissionais online, despacho em tempo real e operações municipais permanecem planejados até a validação da modalidade e das fontes operacionais. Nenhuma chamada ou corrida é simulada.</p></section>
 </main>
}
