import { useEffect, useState, type FormEvent } from "react";
import { createResearchForm, listResearchForms, RESEARCH_NATURES, type ResearchForm } from "@/lib/formulario/research-catalog";
export function ResearchCatalog() {
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
   <button type="button" onClick={()=>setEditing(!editing)} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">+ Novo formulário</button>
  </div>
  {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}. Confirme a implantação da migração.</p>}
  {editing && <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
   <label className="text-sm">Título<input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Código<input required value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="UNIFOR-2026" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Natureza<select value={nature} onChange={e=>setNature(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
   <label className="text-sm">Público<select value={audience} onChange={e=>setAudience(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{["GERAL","PROFISSIONAIS","PASSAGEIROS","PREFEITURA"].map(p=><option key={p}>{p}</option>)}</select></label>
   {nature==="MOBILIDADE_LOCAL" && <label className="text-sm sm:col-span-2">Município<input value={municipality} onChange={e=>setMunicipality(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>}
   <button disabled={saving} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">{saving?"Criando...":"Criar rascunho"}</button>
  </form>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {items.map(item=><article key={item.id} className="rounded-xl border bg-card p-4"><p className="text-xs font-bold text-primary">{item.nature.replaceAll("_"," ")}</p><h3 className="mt-2 font-bold">{item.title}</h3><p className="text-sm text-muted-foreground">{item.code} · {item.audience} · {item.status}</p></article>)}
  </div>
 </section>;
}
