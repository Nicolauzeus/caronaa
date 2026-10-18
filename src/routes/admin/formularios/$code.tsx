import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {ResearchInsights} from "@/components/admin/ResearchInsights";
import {ResearchAnswerInsights} from "@/components/admin/ResearchAnswerInsights";
import {ResearchFormEditor} from "@/components/admin/ResearchFormEditor";
import type {ResearchForm} from "@/lib/formulario/research-catalog";
import {researchPublicPath,researchPublicUrl} from "@/lib/formulario/research-catalog";
import {ResearchShare} from "@/components/admin/ResearchShare";
import {ResearchBrandHeader} from "@/components/research/ResearchFields";
export const Route=createFileRoute("/admin/formularios/$code")({component:ResearchDetail});
function ResearchDetail(){
 const {code}=Route.useParams(),[form,setForm]=useState<ResearchForm|null>(null),[tab,setTab]=useState("analise"),[editing,setEditing]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true;void (supabase as any).from("research_forms").select("*").eq("code",code).maybeSingle().then(({data,error}:any)=>{if(!mounted)return;if(error)setError(error.message);else if(!data)setError("Pesquisa não encontrada");else setForm(data);setLoading(false)});return()=>{mounted=false}},[code]);
 return <main className="space-y-5">
 <Link to="/admin/formularios" className="text-sm font-medium text-primary">← Central de Pesquisas</Link>
 {loading?<p>Carregando pesquisa...</p>:error?<p role="alert">{error}</p>:form&&<>
 <div className="space-y-2"><ResearchBrandHeader title={form.title} imagePath={form.brand_image_path} alt={form.brand_image_alt} brandName={form.brand_display_name}/><p className="text-xs text-muted-foreground">{form.nature.replaceAll("_"," ")} · {form.code} · {form.status} · {form.audience}{form.municipality?" · "+form.municipality:""}</p></div>
 <nav className="flex flex-wrap gap-2" aria-label="Seções da pesquisa">{[["analise","Inteligência"],["respostas","Respostas"],["perguntas","Perguntas"],["config","Configurações"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined} className={tab===id?"rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground":"rounded-xl border px-4 py-2 text-sm"}>{label}</button>)}</nav>
 {tab==="analise"&&<div className="space-y-4"><ResearchInsights forms={[form]} formId={form.id}/><ResearchAnswerInsights formId={form.id}/></div>}
 {tab==="respostas"&&<section className="rounded-xl border p-4"><p className="text-sm">As respostas históricas são consultadas na lista administrativa. Respostas de novas pesquisas são agregadas no painel de inteligência para proteger dados individuais.</p><Link to="/admin/formularios/respostas" className="mt-2 inline-block text-sm text-primary">Ver registros históricos →</Link></section>}
 {tab==="perguntas"&&<div className="space-y-3">{form.status==="ENCERRADO"?<p className="rounded-xl border p-4 text-sm">Pesquisa histórica encerrada. O questionário original não pode ser reescrito.</p>:<button className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground" onClick={()=>setEditing(true)}>Abrir editor de perguntas</button>}{editing&&<ResearchFormEditor formId={form.id} onClose={()=>setEditing(false)}/>}</div>}
 {tab==="config"&&<section className="space-y-3 rounded-xl border p-4"><p className="font-medium">Código: {form.code}</p><p className="text-sm">Natureza: {form.nature}</p><p className="text-sm">Público: {form.audience}</p><p className="text-sm">Modalidade: {form.mobility_mode}</p><p className="text-sm">Status: {form.status}</p>{form.status==="PUBLICADO"&&form.is_enabled&&<a className="text-sm text-primary" target="_blank" rel="noreferrer" href={researchPublicUrl(form.code)}>Abrir formulário público ↗</a>}</section>}
 {tab==="config"&&form.status==="PUBLICADO"&&form.is_enabled&&<ResearchShare title={form.title} url={researchPublicUrl(form.code)}/>}
 </>}
 </main>;
}
