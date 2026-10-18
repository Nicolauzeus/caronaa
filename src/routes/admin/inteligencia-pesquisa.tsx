import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {listResearchForms,type ResearchForm} from "@/lib/formulario/research-catalog";
import {ResearchInsights} from "@/components/admin/ResearchInsights";
import {ResearchCompare} from "@/components/admin/ResearchCompare";
import {MunicipalResearchOverview} from "@/components/admin/MunicipalResearchOverview";
export const Route=createFileRoute("/admin/inteligencia-pesquisa")({component:ResearchIntelligenceCenter});
type View="overview"|"insights"|"compare"|"municipal";
function ResearchIntelligenceCenter(){
 const [forms,setForms]=useState<ResearchForm[]>([]),[view,setView]=useState<View>("overview"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;void listResearchForms().then(data=>{if(active)setForms(data)}).catch(err=>{if(active)setError(err instanceof Error?err.message:"Falha ao carregar pesquisas")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const closed=forms.filter(f=>f.status==="ENCERRADO").length,enabled=forms.filter(f=>f.is_enabled).length;
 return <main className="space-y-6">
 <header><p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary">CARONAA · Inteligência de Mercado</p><h1 className="mt-1 text-3xl font-extrabold">Centro de Pesquisa e Validação</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Estudos, hipóteses e comparações sem transformar intenção declarada em adoção comprovada.</p></header>
 {error&&<p role="alert" className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive">{error}</p>}
 <section className="grid gap-3 sm:grid-cols-3">{[{label:"Pesquisas cadastradas",value:forms.length},{label:"Habilitadas",value:enabled},{label:"Encerradas",value:closed}].map(x=><article className="rounded-xl border bg-card p-4" key={x.label}><p className="text-xs text-muted-foreground">{x.label}</p><p className="mt-2 text-3xl font-bold">{loading||error?"N/D":x.value}</p><p className="mt-2 text-xs text-muted-foreground">Fonte: research_forms · contagem de formulários, não de respostas</p></article>)}</section>
 <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas de inteligência">{([["overview","Metodologia"],["insights","BI e Dores"],["compare","Comparações"],["municipal","Municípios"]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={view===id} onClick={()=>setView(id)} className={view===id?"rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-lg border px-4 py-2 text-sm"}>{label}</button>)}</div>
 {view==="overview"&&<><section className="divide-y rounded-xl border border-border/70 bg-card/30">{[
 {title:"Descoberta do problema",text:"Contagem de pessoas elegíveis que relataram dificuldades, com frequência, intensidade e denominador por pergunta."},
 {title:"Validação da solução",text:"Intenção declarada, objeções, interesse em experimentar e disposição de pagar, sem apresentar intenção como utilização."},
 {title:"Aquisição real",text:"Cadastros confirmados, contas vinculadas e primeira viagem exigem rastreabilidade entre eventos, respostas e contas."},
 {title:"Qualidade da evidência",text:"Informar população, método de recrutamento, não respostas, tamanho de amostra, versões e limitações por pesquisa."}
 ].map(x=><details key={x.title} className="px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">{x.title}</summary><p className="mt-2 text-sm text-muted-foreground">{x.text}</p></details>)}</section><section className="rounded-xl border bg-card p-4"><h2 className="font-bold">Biblioteca de estudos</h2><div className="mt-3 divide-y border-t">{forms.map(f=><Link to={"/admin/formularios/"+encodeURIComponent(f.code)} key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-primary"><span className="font-medium">{f.title}</span><span className="text-xs text-muted-foreground">{f.code} · {f.status}</span></Link>)}{!loading&&!forms.length&&<p className="text-sm text-muted-foreground">Nenhum estudo disponível.</p>}</div></section><section className="rounded-xl border bg-secondary/20 p-4"><h2 className="font-bold">Cuidados estatísticos</h2><p className="mt-2 text-sm text-muted-foreground">O STS contou com 35 respostas históricas verificadas anteriormente. Essa amostra não representa automaticamente uma cidade ou instituição. Dores múltiplas são contadas por respondente elegível e não devem ser somadas como pessoas únicas.</p><Link to="/admin/formularios" className="mt-3 inline-block text-sm font-semibold text-primary">Gerenciar formulários →</Link></section></>}
 {view==="insights"&&!loading&&!error&&<ResearchInsights forms={forms}/>}
 {view==="compare"&&!loading&&!error&&<ResearchCompare forms={forms}/>}
 {view==="municipal"&&!loading&&!error&&<MunicipalResearchOverview/>}
 </main>;
}
