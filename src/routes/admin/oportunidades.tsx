import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceChart } from "@/components/admin/EvidenceChart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListPagination } from "@/components/admin/ListPagination";
import { MetricCard } from "@/components/admin/MetricCard";
import { getStrategicCrossings, type StrategicCrossings } from "@/lib/strategic-crossings";

export const Route = createFileRoute("/admin/oportunidades")({
  component: OpportunitiesPage,
  head: () => ({ meta: [{ name: "description", content: "Informações e acompanhamento de oportunidades." },{ property: "og:title", content: "Oportunidades — CARONAA" },
{ property: "og:description", content: "Informações e acompanhamento de oportunidades." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },{ title: "Oportunidades — CARONAA" }] }),
});
const pains: Record<string,string> = {DOR_01:"Acesso",DOR_02:"Conforto",DOR_03:"Preço",DOR_04:"Tempo",DOR_05:"Vagas",DOR_06:"Confiança"};
const profiles: Record<string,string> = {PASSAGEIRO:"Passageiros",MOTORISTA:"Motoristas",AMBOS:"Ambos"};
function OpportunitiesPage() {
 const [data,setData]=useState<StrategicCrossings|null>(null);
 const [failed,setFailed]=useState(false);
 const [page,setPage]=useState(0);
 useEffect(()=>{let active=true;void getStrategicCrossings().then(d=>{if(active)setData(d);}).catch(()=>{if(active)setFailed(true);});return ()=>{active=false;};},[]);
 if(failed)return <p role="alert" className="py-8 text-destructive">Não foi possível carregar as oportunidades.</p>;
 if(!data)return <p role="status" className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 size={18} className="animate-spin"/>Carregando oportunidades…</p>;
 const gaps=data.supplyDemandByRoute.filter(r=>r.requestGap>0);
 const demand=data.demandByTime.map(r=>({name:r.timeWindow??"Não informado",count:r.respondents}));
 const pain=data.painIntent.map(r=>({name:pains[r.painCode]??r.painCode,intensity:r.averageIntensity,intent:r.averageIntent}));
 const audiences=data.profilePainAndIntent.map(r=>({name:profiles[r.profile]??r.profile,count:r.respondents}));
 const total=data.profilePainAndIntent.reduce((sum,r)=>sum+r.respondents,0);
 return <div className="space-y-5">
 <header><p className="text-xs text-muted-foreground">VALIDAÇÃO / CARONAA</p><h1 className="mt-1 font-display text-3xl font-bold">Oportunidades</h1><p className="mt-2 text-sm text-muted-foreground">Respostas registradas e equilíbrio entre oferta e demanda.</p></header>
 <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><MetricCard label="Respostas por perfil" value={String(total)}/><MetricCard label="Rotas com dores fortes" value={String(data.routesWithStrongPain.length)}/><MetricCard label="Rotas com déficit" value={String(gaps.length)}/><MetricCard label="Pedidos sem oferta" value={String(gaps.reduce((sum,r)=>sum+r.requestGap,0))}/></div>
 <p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">Grupos com menos de 30 respostas são exploratórios; médias ausentes não são zero.</p>
 <Tabs defaultValue="demand" onValueChange={()=>setPage(0)}><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="demand">Demanda</TabsTrigger><TabsTrigger value="audience">Públicos e dores</TabsTrigger><TabsTrigger value="routes">Rotas prioritárias</TabsTrigger></TabsList>
 <TabsContent value="demand" className="space-y-5"><div className="grid gap-6 xl:grid-cols-2"><EvidenceChart title="Demanda por horário" rows={demand.slice(0,8)} series={[{key:"count",label:"Respostas"}]}/><EvidenceChart title="Oferta × demanda — maiores déficits" rows={[...gaps].sort((a,b)=>b.requestGap-a.requestGap).slice(0,6).map((r,i)=>({name:`Rota ${i+1}`,requests:r.requests,offers:r.offers}))} series={[{key:"requests",label:"Pedidos"},{key:"offers",label:"Ofertas"}]}/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="py-3">Trajeto / horário</th><th>Pedidos</th><th>Ofertas</th><th>Déficit</th></tr></thead><tbody>{[...gaps].sort((a,b)=>b.requestGap-a.requestGap).slice(page*8,(page+1)*8).map((r,i)=><tr key={`${r.origin}-${r.destination}-${r.timeWindow}`} className="border-b border-border"><td className="max-w-md py-3 pr-4 break-words"><span className="text-xs text-muted-foreground">Rota {page*8+i+1} · {r.timeWindow}</span><p>{r.origin} → {r.destination}</p></td><td>{r.requests}</td><td>{r.offers}</td><td className="font-semibold">{r.requestGap}</td></tr>)}</tbody></table>{!gaps.length&&<p className="py-8 text-muted-foreground">Não há déficit de oferta registrado.</p>}</div><ListPagination page={page} total={gaps.length} onChange={setPage}/></TabsContent>
 <TabsContent value="audience"><div className="grid gap-6 xl:grid-cols-2"><EvidenceChart title="Respostas por público" rows={audiences} series={[{key:"count",label:"Respostas"}]}/><EvidenceChart title="Dores e intenção — médias de 1 a 5" rows={pain} series={[{key:"intensity",label:"Intensidade"},{key:"intent",label:"Intenção"}]}/></div><div className="mt-5 flex flex-wrap gap-3">{data.painIntent.map(r=><Badge key={r.painCode} variant="outline">{pains[r.painCode]}: {r.respondents} respostas</Badge>)}</div></TabsContent>
 <TabsContent value="routes"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="py-3">Trajeto</th><th>Respostas com dor forte</th><th>Intensidade média</th></tr></thead><tbody>{data.routesWithStrongPain.slice(page*8,(page+1)*8).map(r=><tr key={`${r.origin}-${r.destination}`} className="border-b border-border"><td className="max-w-md break-words py-3 pr-4">{r.origin} → {r.destination}</td><td>{r.strongPainRespondents}</td><td>{r.averagePainIntensity==null?"N/D":r.averagePainIntensity.toLocaleString("pt-BR",{maximumFractionDigits:1})}</td></tr>)}</tbody></table>{!data.routesWithStrongPain.length&&<p className="py-8 text-muted-foreground">Ainda não há rotas com dores fortes registradas.</p>}</div><ListPagination page={Math.min(page,Math.max(0,Math.ceil(data.routesWithStrongPain.length/8)-1))} total={data.routesWithStrongPain.length} onChange={setPage}/></TabsContent>
 </Tabs></div>;
}
