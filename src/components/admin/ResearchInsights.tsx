import {ResearchChart} from "@/components/admin/ResearchChart";
import { ResearchMobilityDimensions } from "@/components/admin/ResearchMobilityDimensions";
import { useEffect,useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RESEARCH_NATURES,type ResearchForm } from "@/lib/formulario/research-catalog";

const PAINS:[string,string][]=[["DOR_01","Acesso ao transporte"],["DOR_02","Lotação e desconforto"],["DOR_03","Preço elevado"],["DOR_04","Tempo de deslocamento"],["DOR_05","Vagas não aproveitadas"],["DOR_06","Confiança e segurança"]];
type Category={category:string;total:number};
type Pain={code:string;selectedCount:number;principalCount?:number|null;averageIntensity?:number|null};
type BI={total:number;painEligible:number;profiles:Category[];occupations:Category[];pains:Pain[];sources:Category[]};
type Legacy={pains:{code:string;total:number}[];barriers:{role:string;code:string;total:number}[];covered:number;questionEligibleCount:number};
const count=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
export function ResearchInsights({forms,formId,onBack}:{forms:ResearchForm[];formId?:string|null;onBack?:()=>void}){
 const [legacy,setLegacy]=useState<Legacy|null>(null);
 const [painCode,setPainCode]=useState("ALL");
 const [id,setId]=useState("ALL"),[nature,setNature]=useState("ALL"),[profile,setProfile]=useState("ALL"),[occupation,setOccupation]=useState("ALL"),[data,setData]=useState<BI|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const selectedId=formId||id, selectedForm=forms.find(f=>f.id===selectedId);
 useEffect(()=>{let mounted=true;setLoading(true);setError("");
 void (supabase as any).rpc("get_research_unified_bi",{
 p_form_id:selectedId==="ALL"?null:selectedId,p_nature:nature==="ALL"?null:nature,
 p_profile:profile==="ALL"?null:profile,p_occupation:occupation==="ALL"?null:occupation,p_pain_code:painCode==="ALL"?null:painCode
 }).then(({data,error}:{data:BI|null;error:{message:string}|null})=>{
 if(!mounted)return;if(error){setError(error.message);setData(null)}else setData(data);setLoading(false);
 });return()=>{mounted=false};},[selectedId,nature,profile,occupation,painCode]);
 useEffect(()=>{let alive=true;setLegacy(null);void (supabase as any).rpc("get_research_legacy_metrics",{p_form_id:selectedId==="ALL"?null:selectedId,p_nature:nature==="ALL"?null:nature,p_profile:profile==="ALL"?null:profile,p_occupation:occupation==="ALL"?null:occupation}).then(({data,error}:{data:Legacy|null;error:any})=>{if(alive&&!error)setLegacy(data)});return()=>{alive=false};},[selectedId,nature,profile,occupation]);
 const total=data?.total??0;

 const pains=PAINS.map(([code,label])=>{const canonical=data?.pains.find(p=>p.code===code);return {code,label,selectedCount:canonical?.selectedCount??0,principalCount:canonical?.principalCount??null,averageIntensity:canonical?.averageIntensity??null,normalized:Boolean(canonical)};}).sort((a,b)=>b.selectedCount-a.selectedCount);
 const profileData=data?.profiles??[], occupationData=data?.occupations??[];
 return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 md:p-6" aria-label="Inteligência de pesquisas">
 <div className="flex flex-wrap items-center justify-between gap-3"><div>
 {onBack&&<button onClick={onBack} className="mb-2 text-sm text-primary">← Todas as pesquisas</button>}
 <h2 className="text-xl font-extrabold">{selectedForm?selectedForm.title:"Inteligência global de pesquisas"}</h2>
 <p className="text-sm text-muted-foreground">Dados reais calculados no banco, com filtros aplicados a todos os indicadores.</p></div>
 <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{selectedForm?selectedForm.code:"Visão consolidada"}</span></div>
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {!formId&&<label className="text-sm">Pesquisa<select value={id} onChange={e=>setId(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas as pesquisas</option>{forms.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label>}
 <label className="text-sm">Natureza<select value={nature} onChange={e=>setNature(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas as naturezas</option>{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
 <label className="text-sm">Perfil de mobilidade<select value={profile} onChange={e=>setProfile(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todos</option>{["PASSAGEIRO","MOTORISTA","AMBOS"].map(p=><option key={p} value={p}>{p}</option>)}</select></label>
 <label className="text-sm">Ocupação<select value={occupation} onChange={e=>setOccupation(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas</option>{["ESTUDANTE","TRABALHADOR","ESTUDANTE_TRABALHADOR","OUTRO"].map(p=><option key={p} value={p}>{p.replaceAll("_"," ")}</option>)}</select></label>
 </div>
 <div className="max-w-sm"><label className="text-sm">Cruzamento por dor<select aria-label="Filtrar por dor" value={painCode} onChange={e=>setPainCode(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas as dores</option>{PAINS.map(([code,label])=><option key={code} value={code}>{code} · {label}</option>)}</select></label></div>
 {loading?<p role="status">Calculando indicadores...</p>:error?<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-destructive">Não foi possível carregar o BI: {error}. Verifique a função get_research_unified_bi (migração 0075).</p>:<>
 <div className="grid gap-3 sm:grid-cols-3">
 <div className="rounded-xl border bg-background p-4"><p className="text-xs uppercase text-muted-foreground">Respostas</p><p className="mt-2 text-3xl font-extrabold">{count(total)}</p></div>
 <div className="rounded-xl border bg-background p-4"><p className="text-xs uppercase text-muted-foreground">Dores relatadas</p><p className="mt-2 text-3xl font-extrabold">{count(pains.reduce((a,p)=>a+p.selectedCount,0))}</p><p className="text-xs text-muted-foreground">Uma pessoa pode relatar várias dores</p></div>
 <div className="rounded-xl border bg-background p-4"><p className="text-xs uppercase text-muted-foreground">Perfis classificados</p><p className="mt-2 text-3xl font-extrabold">{count(profileData.reduce((a,p)=>a+p.total,0))}</p></div>
 </div>
 {legacy&&<div className="rounded-xl border p-4"><h3 className="font-bold">Barreiras de adoção — STS histórico</h3><p className="text-xs text-muted-foreground">Respostas originais do JSON, sem misturar barreiras com as seis dores.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{legacy.barriers.map(b=><div key={b.role+b.code} className="flex justify-between rounded-lg bg-secondary/40 p-2 text-sm"><span>{b.role} · {b.code.replaceAll("_"," ")}</span><strong>{b.total}</strong></div>)}</div></div>}
 {(!selectedForm||selectedForm.code==="STS-2026")&&<ResearchMobilityDimensions formId={selectedId==="ALL"?null:selectedId} nature={nature==="ALL"?null:nature} profile={profile==="ALL"?null:profile} occupation={occupation==="ALL"?null:occupation} painCode={painCode==="ALL"?null:painCode}/>}
 <div className="grid gap-4 xl:grid-cols-2"><ResearchChart title="Perfil dos participantes" description="Distribuição no recorte selecionado" rows={profileData.map(p=>({name:p.category.replaceAll("_"," "),value:p.total}))}/><ResearchChart title="Ranking de dores" description={"Base elegível: "+(data?.painEligible??0)+" participantes"} rows={pains.map(p=>({name:p.label,value:p.selectedCount}))}/><ResearchChart title="Ocupações" rows={occupationData.map(p=>({name:p.category.replaceAll("_"," "),value:p.total}))}/><ResearchChart title="Origem das respostas" rows={(data?.sources??[]).map(p=>({name:p.category==="LEGACY"?"STS / histórico":"Formulários novos",value:p.total}))}/></div>
 <div className="grid gap-5 lg:grid-cols-2">
 <div className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">Perfil dos respondentes</h3>{profileData.map(p=><div key={p.category}><div className="flex justify-between text-sm"><span>{p.category}</span><strong>{p.total} · {total?(p.total/total*100).toFixed(1):"0"}%</strong></div><div className="mt-1 h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{width:(total?p.total/total*100:0)+"%"}}/></div></div>)}{!profileData.length&&<p className="text-sm text-muted-foreground">Sem respostas no recorte.</p>}</div>
 <div className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">Ocupação</h3>{occupationData.map(p=><div key={p.category}><div className="flex justify-between text-sm"><span>{p.category.replaceAll("_"," ")}</span><strong>{p.total} · {total?(p.total/total*100).toFixed(1):"0"}%</strong></div><div className="mt-1 h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{width:(total?p.total/total*100:0)+"%"}}/></div></div>)}{!occupationData.length&&<p className="text-sm text-muted-foreground">Sem dados.</p>}</div>
 </div>
 <div className="space-y-4 rounded-xl border p-4"><h3 className="text-lg font-bold">Ranking das seis dores</h3>
 {pains.map(p=>{const eligible=data?.painEligible??0;const percent=eligible?p.selectedCount/eligible*100:null;return <div key={p.code}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{p.label}</span><span className="font-bold">{p.selectedCount} · {percent===null?"N/D":percent.toFixed(1)+"%"}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{width:(percent??0)+"%"}}/></div><p className="mt-1 text-xs text-muted-foreground">{p.normalized?"Códigos padronizados · ": ""}Principal: {p.principalCount || "N/D"} · Intensidade média: {p.averageIntensity??"N/D"}</p></div>})}
 <p className="text-xs text-muted-foreground">Este ranking utiliza os seis códigos históricos. Os novos modelos F01 usam categorias mais específicas, exibidas em Resultados do questionário, sem misturar bases não equivalentes. Denominador elegível à pergunta: {data?.painEligible??0}. </p>
 <p className="text-xs text-muted-foreground">Percentual = respondentes que relataram a dor ÷ respondentes elegíveis à questão. Não somamos percentuais entre formulários.</p>
 </div></>}
 </section>;
}
