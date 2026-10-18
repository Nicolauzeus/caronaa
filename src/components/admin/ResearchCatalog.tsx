import {supabase} from "@/integrations/supabase/client";
import {RESEARCH_TEMPLATES} from "@/lib/formulario/research-templates";
import { ResearchCompare } from "@/components/admin/ResearchCompare";
import { MunicipalResearchOverview } from "@/components/admin/MunicipalResearchOverview";
import { Link } from "@tanstack/react-router";
import { ResearchInsights } from "@/components/admin/ResearchInsights";
import { ResearchFormEditor } from "@/components/admin/ResearchFormEditor";
import { ResearchFormRemovalDialog } from "@/components/admin/ResearchFormRemovalDialog";
import { useEffect, useState, type FormEvent } from "react";
import { createResearchForm, archiveResearchForm, restoreResearchForm, duplicateResearchForm, renameResearchForm, setResearchFormEnabled, researchPublicPath, researchPublicUrl, listResearchForms, RESEARCH_NATURES, type ResearchForm } from "@/lib/formulario/research-catalog";
export function ResearchCatalog() {
 const [selected,setSelected]=useState<string|null>(null);
 const [libraryView,setLibraryView]=useState<"library"|"trash">("library");
 const [removing,setRemoving]=useState<ResearchForm|null>(null);
 const [renaming,setRenaming]=useState<string|null>(null);
 const [renameTitle,setRenameTitle]=useState("");
 const [managing,setManaging]=useState<string|null>(null);
 async function saveTitle(form:ResearchForm){setManaging(form.id);try{await renameResearchForm(form.id,renameTitle);setRenaming(null);await refresh()}catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar título")}finally{setManaging(null)}}
 async function performAction(form:ResearchForm,action:"duplicate"|"archive"|"restore"){if(action==="archive"&&!window.confirm('Arquivar "'+form.title+'"? O link público será desativado.'))return;setManaging(form.id);try{if(action==="duplicate")await duplicateResearchForm(form);else if(action==="archive")await archiveResearchForm(form);else await restoreResearchForm(form);await refresh()}catch(e){setError(e instanceof Error?e.message:"Falha na operação")}finally{setManaging(null)}}

 const [tab,setTab]=useState<"pesquisas"|"inteligencia"|"comparacoes"|"municipios">("pesquisas");
 const [search,setSearch]=useState("");
 const [natureFilter,setNatureFilter]=useState("ALL");
 const [statusFilter,setStatusFilter]=useState("ALL");
 const [availabilityFilter,setAvailabilityFilter]=useState("ALL");
 const [report,setReport]=useState<string|null>(null);
 const [items,setItems]=useState<ResearchForm[]>([]);
 const activeItems=items.filter((item)=>!item.trashed_at);
 const trashedItems=items.filter((item)=>Boolean(item.trashed_at));
 const [error,setError]=useState("");
 const [title,setTitle]=useState("");
 const [code,setCode]=useState("");
 const [nature,setNature]=useState("EVENTO");
 const [templateKey,setTemplateKey]=useState("");
 const [audience,setAudience]=useState("GERAL");
 const [municipality,setMunicipality]=useState("");
 const [editing,setEditing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [toggling,setToggling]=useState<string|null>(null);
 async function toggleForm(form:ResearchForm){setToggling(form.id);setError("");try{await setResearchFormEnabled(form,!form.is_enabled);await refresh()}catch(e){setError(e instanceof Error?e.message:"Falha ao alterar disponibilidade")}finally{setToggling(null)}}
 async function refresh(){try {setItems(await listResearchForms({ includeTrashed: true }));}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar pesquisas");}}
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!selected)return;const frame=requestAnimationFrame(()=>document.getElementById("research-form-editor")?.scrollIntoView({behavior:"smooth",block:"start"}));return()=>cancelAnimationFrame(frame)},[selected]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);try{
   if(!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(code)) throw Error("Código inválido");
   const id=await createResearchForm({title,code,nature,audience,municipality,templateKey});
   setSelected(id);setTemplateKey("");
   setEditing(false);setTitle("");setCode("");await refresh();
 }catch(e){setError(e instanceof Error?e.message:"Erro ao criar");}finally{setSaving(false);}}
 return <section className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-extrabold">Central de pesquisas</h2><p className="text-sm text-muted-foreground">Pesquisas por evento, educação, empresa e mobilidade local.</p></div>
   {libraryView==="library"&&<button type="button" onClick={()=>{setTab("pesquisas");setEditing(!editing)}} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">+ Novo formulário</button>}
  </div>

  <nav aria-label="Visualizações da biblioteca de pesquisas" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/30 p-2">
   <button type="button" aria-pressed={libraryView==="library"} onClick={()=>setLibraryView("library")}
    className={libraryView==="library"?"rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-lg px-4 py-2 text-sm font-semibold hover:bg-muted"}>
    Biblioteca ({activeItems.length})
   </button>
   <button type="button" aria-pressed={libraryView==="trash"}
    onClick={()=>{setLibraryView("trash");setTab("pesquisas");setEditing(false);setSelected(null);setReport(null);setRenaming(null)}}
    className={libraryView==="trash"?"rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-lg px-4 py-2 text-sm font-semibold hover:bg-muted"}>
    Lixeira ({trashedItems.length})
   </button>
  </nav>
  {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}. Confirme a implantação da migração.</p>}
  {tab==="pesquisas" && libraryView==="library" && editing && <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
   <label className="text-sm">Título<input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Código<input required value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="UNIFOR-2026" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">Natureza<select value={nature} onChange={e=>{setNature(e.target.value);setTemplateKey("")}} className="mt-1 w-full rounded-lg border bg-background p-3">{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
   <label className="text-sm">Público<select value={audience} onChange={e=>setAudience(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{["GERAL","PROFISSIONAIS","PASSAGEIROS","PREFEITURA"].map(p=><option key={p}>{p}</option>)}</select></label>
   {nature==="MOBILIDADE_LOCAL" && <label className="text-sm sm:col-span-2">Município<input value={municipality} onChange={e=>setMunicipality(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>}
   <div className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:col-span-2"><div><p className="font-semibold">Começar de um modelo pronto</p><p className="text-xs text-muted-foreground">Personalize as perguntas depois. Iniciar do zero também é possível.</p></div><div role="group" aria-label="Modelos disponíveis" className="grid gap-2 md:grid-cols-2"><button type="button" aria-pressed={!templateKey} onClick={()=>setTemplateKey("")} className={!templateKey?"rounded-lg border-2 border-primary bg-primary/10 p-3 text-left":"rounded-lg border p-3 text-left"}><span className="font-semibold">Em branco</span><p className="mt-1 text-xs text-muted-foreground">Você cria todas as seções e perguntas.</p></button>{RESEARCH_TEMPLATES.filter(t=>t.nature===nature).map(t=><button type="button" key={t.key} aria-pressed={templateKey===t.key} onClick={()=>setTemplateKey(t.key)} className={templateKey===t.key?"rounded-lg border-2 border-primary bg-primary/10 p-3 text-left":"rounded-lg border p-3 text-left"}><span className="font-semibold">{t.label}</span><p className="mt-1 text-xs text-muted-foreground">{t.description}</p><p className="mt-2 text-xs font-medium text-[#805900] dark:text-[#ffd166]">{t.schema.sections.length} seções · {t.schema.sections.reduce((n,s)=>n+s.questions.length,0)} perguntas · ~{t.estimatedMinutes} min</p></button>)}</div></div>
   <button disabled={saving} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">{saving?"Criando...":"Criar rascunho"}</button>
  </form>}
  {removing&&<ResearchFormRemovalDialog form={removing} onClose={()=>setRemoving(null)} onCompleted={()=>{setRemoving(null);setSelected(null);void refresh()}}/>}
  {tab==="pesquisas" && libraryView==="library" && selected&&<ResearchFormEditor formId={selected} onPublished={()=>{setSelected(null);void refresh();}} onClose={()=>{setSelected(null);void refresh();}}/>}
  {tab==="pesquisas" && libraryView==="library" && !report && <div className="flex flex-wrap gap-3"><input aria-label="Buscar pesquisas" placeholder="Buscar por título ou código" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-background p-3"/><select aria-label="Filtrar natureza" value={natureFilter} onChange={e=>setNatureFilter(e.target.value)} className="rounded-lg border bg-background p-3"><option value="ALL">Todas as naturezas</option>{RESEARCH_NATURES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select><select aria-label="Filtrar situação" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-lg border bg-background p-3"><option value="ALL">Todos os estados</option>{["RASCUNHO","PUBLICADO","ARQUIVADO","ENCERRADO"].map(x=><option key={x} value={x}>{x}</option>)}</select><select aria-label="Filtrar disponibilidade" value={availabilityFilter} onChange={e=>setAvailabilityFilter(e.target.value)} className="rounded-lg border bg-background p-3"><option value="ALL">Todas disponibilidades</option><option value="ATIVO">Habilitados</option><option value="INATIVO">Desabilitados</option></select></div>}
  {tab==="pesquisas" && libraryView==="library" && !report && <div className="divide-y overflow-hidden rounded-xl border border-border/70 bg-card/30">
   {activeItems.filter(item=>(availabilityFilter==="ALL"||(availabilityFilter==="ATIVO"?item.is_enabled:!item.is_enabled))&&(statusFilter==="ALL"||item.status===statusFilter)&&(natureFilter==="ALL"||item.nature===natureFilter)&&(!search.trim()||(item.title+" "+item.code).toLowerCase().includes(search.trim().toLowerCase()))).map(item=><article key={item.id} className="px-4 py-4 transition-colors hover:bg-accent/20"><p className="text-xs font-bold text-primary">{item.nature.replaceAll("_"," ")}</p><div className="mt-2 flex items-center gap-3">
 <Link to="/admin/formularios/$code" params={{code:item.code}} hash="imagem" aria-label={"Personalizar imagem da pesquisa "+item.title} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-1 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
  {item.brand_image_path?<img className="h-full w-full rounded bg-white object-contain" loading="lazy" alt={item.brand_image_alt||"Imagem da pesquisa"} src={supabase.storage.from("research-branding").getPublicUrl(item.brand_image_path).data.publicUrl}/>:<span aria-hidden="true" className="font-black text-[#805900] dark:text-[#ffd166]">C</span>}
 </Link>
 <div className="min-w-0"><h3 className="font-bold">{item.title}</h3><Link to="/admin/formularios/$code" params={{code:item.code}} hash="imagem" className="text-xs font-semibold text-[#805900] underline-offset-2 hover:underline dark:text-[#ffd166]">{item.brand_image_path?"Trocar imagem":"Adicionar imagem ou logomarca"} →</Link></div></div>{renaming===item.id&&<form className="mt-2 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void saveTitle(item)}}><input aria-label="Novo título" required minLength={2} maxLength={180} className="min-w-0 flex-1 rounded-lg border bg-background p-2 text-sm" value={renameTitle} onChange={e=>setRenameTitle(e.target.value)}/><button type="submit" disabled={managing===item.id} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Salvar</button><button type="button" onClick={()=>setRenaming(null)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button></form>}<p className="text-sm text-muted-foreground">{item.code} · {item.audience} · {item.status}</p><div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/60 p-2"><span className="text-xs font-semibold">{item.is_enabled?"Disponível publicamente":"Indisponível"}</span><label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" aria-label={"Habilitar formulário "+item.title} disabled={toggling===item.id||item.status!=="PUBLICADO"} checked={Boolean(item.is_enabled)} onChange={()=>void toggleForm(item)}/>{item.is_enabled?"Ativo":"Inativo"}</label></div>{item.status==="RASCUNHO"&&<p className="mt-2 text-xs text-muted-foreground">Para habilitar, primeiro publique uma versão com perguntas. Use “Editar perguntas” abaixo.</p>}{item.is_enabled&&<div className="mt-2 flex flex-wrap items-center gap-2"><a target="_blank" rel="noreferrer" href={researchPublicPath(item.code)} className="break-all text-xs text-primary">{researchPublicPath(item.code)}</a><button className="rounded border px-2 py-1 text-xs" onClick={()=>void navigator.clipboard.writeText(researchPublicUrl(item.code))}>Copiar link</button><a className="rounded border px-2 py-1 text-xs" target="_blank" rel="noreferrer" href={"https://wa.me/?text="+encodeURIComponent("Participe da pesquisa CARONAA: "+item.title+" — "+window.location.origin+researchPublicPath(item.code))}>WhatsApp ↗</a></div>}<div className="mt-3 flex flex-wrap items-center gap-2"><Link to="/admin/formularios/$code" params={{code:item.code}} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Abrir pesquisa →</Link>{item.status==="RASCUNHO"&&<button type="button" onClick={()=>{setSelected(item.id);setEditing(false)}} className="rounded-lg border border-primary/60 px-3 py-2 text-sm font-semibold text-[#805900] dark:text-[#FFD166]">Revisar e publicar</button>}<details className="min-w-0"><summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Mais ações</summary><div className="mt-2 flex flex-wrap gap-2">{item.status!=="ENCERRADO"&&item.status!=="ARQUIVADO"&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setSelected(item.id)}>{item.status==="RASCUNHO"?"Preparar e publicar":"Editar perguntas"}</button>}<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{setRenaming(item.id);setRenameTitle(item.title)}} >Editar título</button><button disabled={managing===item.id} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void performAction(item,"duplicate")}>Duplicar</button>{item.status==="ARQUIVADO"&&<button disabled={managing===item.id} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void performAction(item,"restore")}>Restaurar</button>}{item.status!=="ENCERRADO"&&<button type="button" disabled={managing===item.id} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive" onClick={()=>setRemoving(item)}>Arquivar / Lixeira</button>}</div></details></div></article>)}
  </div>}
  {tab==="pesquisas" && libraryView==="trash" && (
   <section aria-label="Pesquisas na lixeira" className="space-y-3">
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
     <h3 className="font-semibold">Lixeira de pesquisas</h3>
     <p className="mt-1 text-sm text-muted-foreground">As pesquisas na lixeira não aceitam novas respostas. Restaurar não reativa o link público automaticamente. A exclusão definitiva exige verificação dos vínculos e confirmação reforçada.</p>
    </div>
    {trashedItems.length===0&&<p role="status" className="rounded-xl border p-5 text-sm text-muted-foreground">A lixeira está vazia.</p>}
    <div className="divide-y overflow-hidden rounded-xl border bg-card/30">
     {trashedItems.filter((item)=>!search.trim()||(item.title+" "+item.code).toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))).map((item)=>(
      <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
       <div className="min-w-0">
        <h3 className="font-semibold">{item.title}</h3>
        <p className="mt-1 break-all text-xs text-muted-foreground">{item.code} · Anteriormente: {item.trash_previous_status??"indefinido"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Movida para a lixeira em {item.trashed_at?new Date(item.trashed_at).toLocaleString("pt-BR"):"data indisponível"}</p>
       </div>
       <button type="button" onClick={()=>setRemoving(item)} className="rounded-lg border border-primary/50 px-4 py-2.5 text-sm font-semibold hover:bg-muted/40">
        Restaurar / Excluir definitivamente
       </button>
      </article>
     ))}
    </div>
   </section>
  )}
  {tab==="inteligencia" && (report ? <ResearchInsights forms={activeItems} formId={report} onBack={()=>setReport(null)}/> : <ResearchInsights forms={activeItems}/>)}
  {tab==="comparacoes" && <ResearchCompare forms={activeItems}/>}
  {tab==="municipios" && <MunicipalResearchOverview/>}
  
 </section>;
}
