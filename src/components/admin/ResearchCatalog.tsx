import { ResearchCompare } from "@/components/admin/ResearchCompare";
import { MunicipalResearchOverview } from "@/components/admin/MunicipalResearchOverview";
import { Link } from "@tanstack/react-router";
import { ResearchInsights } from "@/components/admin/ResearchInsights";
import { ResearchFormEditor } from "@/components/admin/ResearchFormEditor";
import { useEffect, useState, type FormEvent } from "react";
import { createResearchForm, listResearchForms, RESEARCH_NATURES, type ResearchForm } from "@/lib/formulario/research-catalog";
export function ResearchCatalog() {
 const [selected,setSelected]=useState<string|null>(null);
 const [tab,setTab]=useState<"pesquisas"|"inteligencia"|"comparacoes"|"municipios">("pesquisas");
 const [search,setSearch]=useState("");
 const [natureFilter,setNatureFilter]=useState("ALL");
 const [report,setReport]=useState<string|null>(null);
 const [items,setItems]=useState<ResearchForm[]>([]);
 const [error,setError]=useState("");
 const [title,setTitle]=useState("");
 const [code,setCode]=useState("");
 const [nature,setNature]=useState("EVENTO");
 const [audience,setAudience]=useState("GERAL");
 const [municipality,setMunicipality]=useState("");
 const [editing,setEditing]=useState(false);
 const [saving,setSaving]=useState(false);
 async function refresh(){try {setItems(await listResearchForms());setError("");}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar pesquisas");}}
 useEffect(()=>{void refresh();},[]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);try{
   if(!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(code)) throw Error("Código inválido");
   await createResearchForm({title,code,nature,audience,municipality});
   setEditing(false);setTitle("");setCode("");await refresh();
 }catch(e){setError(e instanceof Error?e.message:"Erro ao criar");}finally{setSaving(false);}}
 return <section className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-extrabold">Central de pesquisas</h2><p className="text-sm text-muted-foreground">Pesquisas por evento, educação, empresa e mobilidade local.</p></div>
   <button type="button" onClick={()=>{setTab("pesquisas");setEditing(!editing)}} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">+ Novo formulário</button>
  </div>
  <nav aria-label="Áreas da central" className="flex flex-wrap gap-2">{[["pesquisas","Pesquisas"],["inteligencia","Inteligência"],["comparacoes","Comparações"],["municipios","Municípios"]].map(([id,label])=><button key={id} onClick={()=>setTab(id as typeof tab)} className={tab===id?"rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-xl border px-4 py-2 text-sm"}>{label}</button>)}</nav>
  {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}. Confirme a implantação da migração.</p>}
  {tab==="pesquisas" && editing && <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
   <label className="text-sm">Título<input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Código<input required value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="UNIFOR-2026" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Natureza<select value={nature} onChange={e=>setNature(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
   <label className="text-sm">Público<select value={audience} onChange={e=>setAudience(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{["GERAL","PROFISSIONAIS","PASSAGEIROS","PREFEITURA"].map(p=><option key={p}>{p}</option>)}</select></label>
   {nature==="MOBILIDADE_LOCAL" && <label className="text-sm sm:col-span-2">Município<input value={municipality} onChange={e=>setMunicipality(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>}
   <button disabled={saving} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">{saving?"Criando...":"Criar rascunho"}</button>
  </form>}
  {tab==="pesquisas" && !report && <div className="flex flex-wrap gap-3"><input aria-label="Buscar pesquisas" placeholder="Buscar por título ou código" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-background p-3"/><select aria-label="Filtrar natureza" value={natureFilter} onChange={e=>setNatureFilter(e.target.value)} className="rounded-lg border bg-background p-3"><option value="ALL">Todas as naturezas</option>{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></div>}
  {tab==="pesquisas" && !report && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {items.filter(item=>(natureFilter==="ALL"||item.nature===natureFilter)&&(!search.trim()||(item.title+" "+item.code).toLowerCase().includes(search.trim().toLowerCase()))).map(item=><article key={item.id} className="rounded-xl border bg-card p-4"><p className="text-xs font-bold text-primary">{item.nature.replaceAll("_"," ")}</p><h3 className="mt-2 font-bold">{item.title}</h3><p className="text-sm text-muted-foreground">{item.code} · {item.audience} · {item.status}</p><div className="mt-3 flex flex-wrap gap-2"><Link to="/admin/formularios/$code" params={{code:item.code}} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Abrir pesquisa →</Link>{item.status!=="ENCERRADO"&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setSelected(item.id)}>Editar perguntas</button>}</div></article>)}
  </div>}
  {tab==="inteligencia" && (report ? <ResearchInsights forms={items} formId={report} onBack={()=>setReport(null)}/> : <ResearchInsights forms={items}/>)}
  {tab==="comparacoes" && <ResearchCompare forms={items}/>}
  {tab==="municipios" && <MunicipalResearchOverview/>}
  {tab==="pesquisas" && selected&&<ResearchFormEditor formId={selected} onClose={()=>{setSelected(null);void refresh();}}/>}
 </section>;
}
