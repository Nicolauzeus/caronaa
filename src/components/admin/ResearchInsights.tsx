import { useEffect,useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RESEARCH_NATURES, type ResearchForm } from "@/lib/formulario/research-catalog";
const PAINS=[["DOR_01","Acesso a transporte"],["DOR_02","Lotação e desconforto"],["DOR_03","Preço elevado"],["DOR_04","Tempo de deslocamento"],["DOR_05","Vagas não aproveitadas"],["DOR_06","Confiança e segurança"]];
type PainRow={codigo_dor:string;selecionada:boolean;principal:boolean;intensidade:number|null;submission_id:string};
type Submission={submission_id:string;research_form_id:string|null;tipo_usuario:string;ocupacao:string|null;form_submission_pain_points:PainRow[]};
export function ResearchInsights({forms}:{forms:ResearchForm[]}){
 const [rows,setRows]=useState<Submission[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 const [form,setForm]=useState("ALL");const [nature,setNature]=useState("ALL");const [profile,setProfile]=useState("ALL");
 useEffect(()=>{let active=true;setLoading(true);
 // Bounded page explicitly signals that the BI requires server-side aggregation at scale.
 void (async()=>{const {data,error}=await (supabase as any).from("form_submissions").select("submission_id,research_form_id,tipo_usuario,ocupacao,form_submission_pain_points(submission_id,codigo_dor,selecionada,principal,intensidade)").order("created_at",{ascending:false}).limit(1000);
 if(!active)return;if(error)setError(error.message);else setRows(data??[]);setLoading(false);})();return()=>{active=false};},[]);
 const selected=rows.filter(r=>(form==="ALL"||r.research_form_id===form)&&(nature==="ALL"||forms.some(f=>f.id===r.research_form_id&&f.nature===nature))&&(profile==="ALL"||r.tipo_usuario===profile));
 const allOld=rows.some(r=>!r.research_form_id);
 return <section className="space-y-4 rounded-2xl border bg-card p-4">
 <h2 className="text-xl font-extrabold">Inteligência de pesquisas</h2>
 <p className="text-sm text-muted-foreground">Indicadores calculados a partir de respostas individuais, sem somar porcentagens.</p>
 <div className="grid gap-3 sm:grid-cols-3">
 <label className="text-sm">Pesquisa<select value={form} onChange={e=>setForm(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas</option>{forms.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label>
 <label className="text-sm">Natureza<select value={nature} onChange={e=>setNature(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todas</option>{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
 <label className="text-sm">Perfil<select value={profile} onChange={e=>setProfile(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="ALL">Todos</option>{["PASSAGEIRO","MOTORISTA","AMBOS"].map(p=><option key={p}>{p}</option>)}</select></label>
 </div>
 {loading?<p>Carregando respostas...</p>:error?<p role="alert" className="text-destructive">{error}</p>:<><p className="text-sm font-semibold">{selected.length} respostas no recorte carregado</p>
 {allOld&&<p className="text-sm text-muted-foreground">Existem respostas históricas ainda sem associação STS. A análise por pesquisa será completa após backfill auditado.</p>}
 {rows.length===1000&&<p className="text-sm text-destructive">Limite de 1.000 registros alcançado. Não use estas métricas como totais globais; é necessária agregação paginada no servidor.</p>}
 <div className="space-y-3">{PAINS.map(([code,label])=>{const related=selected.filter(r=>r.form_submission_pain_points?.some(p=>p.codigo_dor===code&&p.selecionada));const principal=selected.filter(r=>r.form_submission_pain_points?.some(p=>p.codigo_dor===code&&p.principal));const intens=related.flatMap(r=>r.form_submission_pain_points??[]).filter(p=>p.codigo_dor===code&&p.intensidade!==null).map(p=>p.intensidade as number);
 const percentage=selected.length?Math.round(related.length/selected.length*1000)/10:0;return <div key={code}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{label}</span><span className="font-semibold">{related.length} ({percentage}%) · principal: {principal.length} · intensidade: {intens.length?(intens.reduce((a,b)=>a+b,0)/intens.length).toFixed(1):"N/D"}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{width:percentage+"%"}}/></div></div>})}</div></>}
 </section>;
}
