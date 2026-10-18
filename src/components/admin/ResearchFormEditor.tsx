import {useEffect,useMemo,useState,type ChangeEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {RESEARCH_TEMPLATES,QUESTION_TYPES,freshTemplate,type SurveyQuestion,type SurveySchema} from "@/lib/formulario/research-templates";
import {emptySurveySchema,newSurveyQuestion,reorder,cloneQuestion,inspectSchema,validatePage,type Answers} from "@/lib/formulario/research-schema";
import {ResearchSectionFields,ResearchBrandHeader} from "@/components/research/ResearchFields";
const db=supabase as any;
export function ResearchFormEditor({formId,onClose,onPublished}:{formId:string;onClose:()=>void;onPublished?:()=>void}){
 const [versionId,setVersionId]=useState(""),[version,setVersion]=useState(1),[published,setPublished]=useState(false),[schema,setSchema]=useState<SurveySchema>(emptySurveySchema());
 const [saved,setSaved]=useState(""),[undo,setUndo]=useState<SurveySchema[]>([]),[redo,setRedo]=useState<SurveySchema[]>([]);
 const [busy,setBusy]=useState(true),[error,setError]=useState(""),[preview,setPreview]=useState(false);
 const [templateKey,setTemplateKey]=useState(""),[formNature,setFormNature]=useState("EVENTO"),[formTitle,setFormTitle]=useState("Pesquisa");
 const [brandName,setBrandName]=useState(""),[brandAlt,setBrandAlt]=useState(""),[brandPath,setBrandPath]=useState<string|null>(null),[brandBusy,setBrandBusy]=useState(false);
 const [previewAnswers,setPreviewAnswers]=useState<Answers>({}),[previewStep,setPreviewStep]=useState(0);
 useEffect(()=>{let alive=true;setBusy(true);void Promise.all([
  db.from("research_form_versions").select("id,version_number,schema_json,published_at").eq("form_id",formId).order("version_number",{ascending:false}).limit(1).single(),
  db.from("research_forms").select("title,nature,brand_image_path,brand_image_alt,brand_display_name").eq("id",formId).single()
 ]).then(([v,f]:any[])=>{if(!alive)return;if(v.error||f.error){setError(v.error?.message??f.error?.message);return}
  const initial:SurveySchema=v.data.schema_json?.sections?.length?v.data.schema_json:emptySurveySchema();
  setVersionId(v.data.id);setVersion(v.data.version_number);setPublished(Boolean(v.data.published_at));setSchema(initial);setSaved(JSON.stringify(initial));
  setFormNature(f.data.nature);setFormTitle(f.data.title);setBrandName(f.data.brand_display_name??"");setBrandAlt(f.data.brand_image_alt??"");setBrandPath(f.data.brand_image_path??null);
 }).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[formId]);
 const dirty=JSON.stringify(schema)!==saved;
 const issues=useMemo(()=>inspectSchema(schema),[schema]);
 function apply(next:SurveySchema){if(published)return;setUndo(u=>[...u.slice(-29),structuredClone(schema)]);setRedo([]);setSchema(next)}
 function revert(){const previous=undo.at(-1);if(!previous)return;setRedo(r=>[...r,structuredClone(schema)]);setUndo(u=>u.slice(0,-1));setSchema(previous)}
 function forward(){const next=redo.at(-1);if(!next)return;setUndo(u=>[...u,structuredClone(schema)]);setRedo(r=>r.slice(0,-1));setSchema(next)}
 function changeSection(i:number,patch:Partial<SurveySchema["sections"][number]>){apply({sections:schema.sections.map((s,j)=>j===i?{...s,...patch}:s)})}
 function changeQuestion(si:number,qi:number,patch:Partial<SurveyQuestion>){changeSection(si,{questions:schema.sections[si].questions.map((q,i)=>i===qi?{...q,...patch}:q)})}
 function deleteQuestion(si:number,qi:number){const item=schema.sections[si].questions[qi];const dependent=schema.sections.flatMap(s=>s.questions).filter(q=>q.showWhen?.questionId===item.id);if(dependent.length&&!confirm("Há "+dependent.length+" perguntas dependentes. Remover esta pergunta e suas condições?"))return;
  apply({sections:schema.sections.map((s,i)=>({...s,questions:s.questions.filter(q=>q.id!==item.id).map(q=>q.showWhen?.questionId===item.id?{...q,showWhen:undefined}:q)}))});
 }
 function shiftQuestion(si:number,qi:number,direction:number){changeSection(si,{questions:reorder(schema.sections[si].questions,qi,qi+direction)})}
 function moveQuestion(si:number,qi:number,target:number){if(target===si)return;const item=schema.sections[si].questions[qi];if(item.showWhen){setError("Remova a condição da pergunta antes de transferi-la de seção.");return}
  apply({sections:schema.sections.map((s,i)=>({...s,questions:i===si?s.questions.filter((_,j)=>j!==qi):i===target?[...s.questions,item]:s.questions}))});
 }
 function insertTemplate(){const model=RESEARCH_TEMPLATES.find(t=>t.key===templateKey);if(!model)return;if(schema.sections.some(s=>s.questions.length)&&!confirm("O modelo substituirá as seções atuais do rascunho. Pode desfazer depois. Continuar?"))return;apply(freshTemplate(model));setPreviewStep(0);setPreviewAnswers({})}
 async function persist(action:"save"|"publish"){setBusy(true);setError("");try{
 if(published)throw Error("Versão publicada. Crie uma nova versão antes de editar.");
 if(!versionId)throw Error("Versão ainda não carregada.");
 if(action==="publish"&&issues.length)throw Error("Corrija antes de publicar: "+issues.join(" "));
 if(action==="publish"){
  const result=await db.rpc("publish_research_form",{p_form_id:formId,p_version_id:versionId,p_schema:schema});
  if(result.error)throw Error(result.error.message);
  setPublished(true);onPublished?.();
 }else{
  const result=await db.from("research_form_versions").update({schema_json:schema}).eq("id",versionId).is("published_at",null).select("id").maybeSingle();
  if(result.error||!result.data)throw Error(result.error?.message??"Rascunho não está editável.");
 }
 setSaved(JSON.stringify(schema));
 }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar")}finally{setBusy(false)}}
 async function newVersion(){setBusy(true);setError("");try{
  const {data,error}=await db.from("research_form_versions").insert({form_id:formId,version_number:version+1,schema_json:schema}).select("id").single();
  if(error)throw Error(error.message);
  setVersionId(data.id);setVersion(v=>v+1);setPublished(false);setSaved(JSON.stringify(schema));setUndo([]);setRedo([]);
 }catch(e){setError(e instanceof Error?e.message:"Não foi possível criar nova versão")}finally{setBusy(false)}}
 async function uploadImage(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;e.target.value="";
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2097152){setError("Use PNG, JPEG ou WebP de até 2 MB.");return}
 setBrandBusy(true);setError("");try{
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=formId+"/"+crypto.randomUUID()+"."+extension;
  const {error}=await db.storage.from("research-branding").upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw Error(error.message);
  setBrandPath(path);
 }catch(err){setError(err instanceof Error?err.message:"Erro de imagem")}finally{setBrandBusy(false)}}
 async function saveBrand(){setBrandBusy(true);setError("");try{
  const {error}=await db.from("research_forms").update({brand_image_path:brandPath,brand_image_alt:brandAlt.trim()||null,brand_display_name:brandName.trim()||null}).eq("id",formId);
  if(error)throw Error(error.message);
 }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar identidade")}finally{setBrandBusy(false)}}
 function continuePreview(){const e=validatePage(schema.sections[previewStep],previewAnswers);if(e.length){setError(e[0]);return}setError("");setPreviewStep(p=>Math.min(schema.sections.length-1,p+1))}
 const visibleParents=(si:number,qi:number)=>schema.sections.flatMap((section,i)=>section.questions.filter((q,j)=>(i<si||(i===si&&j<qi))&&q.type==="single_choice"));
 return <section className="space-y-5 rounded-xl border bg-card/50 p-4 md:p-6">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Construtor de pesquisa</h2><p className="text-sm text-muted-foreground">Versão {version} · {published?"Publicada e protegida":dirty?"Alterações não salvas":"Rascunho salvo"}</p></div>
 <div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setPreview(v=>!v)}>{preview?"Voltar ao editor":"Pré-visualizar como participante"}</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{if(!dirty||confirm("Existem alterações não salvas. Fechar mesmo assim?"))onClose()}}>Fechar</button></div></header>
 {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
 <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Identidade visual e logomarca do formulário</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">
  <label className="text-sm">Nome exibido no cabeçalho<input value={brandName} maxLength={120} onChange={e=>setBrandName(e.target.value)} placeholder="Ex.: Pesquisa de mobilidade universitária" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
  <label className="text-sm">Descrição acessível da imagem<input value={brandAlt} maxLength={180} onChange={e=>setBrandAlt(e.target.value)} placeholder="Ex.: Identidade visual da pesquisa" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
  <label className="text-sm sm:col-span-2">Imagem (PNG, JPG ou WebP, até 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadImage(e)} className="mt-1 block w-full text-sm"/></label>
  <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={brandBusy} onClick={()=>void saveBrand()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Salvar identidade</button>{brandPath&&<button onClick={()=>setBrandPath(null)} className="text-sm text-destructive">Remover imagem (salvar para confirmar)</button>}</div>
  <p className="text-xs text-muted-foreground sm:col-span-2">Use logomarcas institucionais apenas quando autorizado. A imagem ficará pública para permitir que participantes vejam o formulário.</p>
 </div></details>
 {!published&&!preview&&<div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3"><label className="min-w-48 flex-1 text-sm font-medium">Modelo recomendado<select value={templateKey} onChange={e=>setTemplateKey(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">Escolher modelo (opcional)</option>{RESEARCH_TEMPLATES.filter(t=>t.nature===formNature).map(t=><option key={t.key} value={t.key}>{t.label} · {t.estimatedMinutes} min</option>)}</select></label><button type="button" disabled={!templateKey} onClick={insertTemplate} className="rounded-lg border px-3 py-2 text-sm font-semibold">Aplicar modelo</button><button disabled={!undo.length} onClick={revert} className="rounded-lg border px-3 py-2 text-sm">Desfazer</button><button disabled={!redo.length} onClick={forward} className="rounded-lg border px-3 py-2 text-sm">Refazer</button></div>}
 {preview?<div className="mx-auto max-w-xl space-y-4"><ResearchBrandHeader title={formTitle} imagePath={brandPath} alt={brandAlt} brandName={brandName}/><div className="text-xs text-muted-foreground">Prévia fiel · etapa {previewStep+1} de {schema.sections.length} · sem gravação no banco</div>
 {schema.sections[previewStep]&&<div className="rounded-xl border p-4"><h3 className="mb-4 text-lg font-bold">{schema.sections[previewStep].title}</h3><ResearchSectionFields section={schema.sections[previewStep]} answers={previewAnswers} onChange={(id,value)=>setPreviewAnswers(a=>({...a,[id]:value}))} idPrefix="preview-"/></div>}
 <div className="flex justify-between gap-2"><button disabled={previewStep===0} onClick={()=>setPreviewStep(p=>p-1)} className="rounded-lg border px-4 py-2">Anterior</button><button onClick={continuePreview} disabled={previewStep===schema.sections.length-1} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Próxima etapa</button></div></div>:
 <div className="space-y-3">{schema.sections.map((section,si)=><details key={section.id??si} open={undefined} className="rounded-xl border bg-background/70 p-3" draggable={!published} onDragStart={e=>e.dataTransfer.setData("text/plain",String(si))} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));if(Number.isInteger(from)&&!published)apply({sections:reorder(schema.sections,from,si)})}}>
 <summary className="cursor-pointer font-semibold">{si+1}. {section.title||"Sem título"} <span className="text-xs font-normal text-muted-foreground"> · {section.questions.length} perguntas</span></summary>
 <div className="mt-3 space-y-3">
 <div className="flex flex-wrap items-center gap-2"><label className="min-w-40 flex-1 text-sm">Nome da seção<input value={section.title} disabled={published} onChange={e=>changeSection(si,{title:e.target.value})} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
 <button disabled={published||si===0} onClick={()=>apply({sections:reorder(schema.sections,si,si-1)})} className="rounded-lg border px-3 py-2 text-sm" aria-label={"Mover seção "+(si+1)+" para cima"}>↑</button><button disabled={published||si===schema.sections.length-1} onClick={()=>apply({sections:reorder(schema.sections,si,si+1)})} className="rounded-lg border px-3 py-2 text-sm" aria-label={"Mover seção "+(si+1)+" para baixo"}>↓</button>
 <button disabled={published} onClick={()=>{const questions=section.questions.map(cloneQuestion);apply({sections:[...schema.sections.slice(0,si+1),{...section,id:crypto.randomUUID(),title:section.title+" (cópia)",questions},...schema.sections.slice(si+1)]})}} className="rounded-lg border px-3 py-2 text-sm">Duplicar</button>
 <button disabled={published||schema.sections.length===1} onClick={()=>{if(confirm("Excluir a seção e suas perguntas?"))apply({sections:schema.sections.filter((_,i)=>i!==si)})}} className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">Excluir</button></div>
 {section.questions.map((q,qi)=><div key={q.id} className="space-y-2 rounded-lg border bg-muted/20 p-3">
 <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Pergunta {qi+1}</span><button disabled={published||qi===0} onClick={()=>shiftQuestion(si,qi,-1)} className="rounded border px-2 py-1 text-xs" aria-label="Mover pergunta para cima">↑</button><button disabled={published||qi===section.questions.length-1} onClick={()=>shiftQuestion(si,qi,1)} className="rounded border px-2 py-1 text-xs" aria-label="Mover pergunta para baixo">↓</button><button disabled={published} onClick={()=>changeSection(si,{questions:[...section.questions.slice(0,qi+1),cloneQuestion(q),...section.questions.slice(qi+1)]})} className="rounded border px-2 py-1 text-xs">Duplicar</button><button disabled={published} onClick={()=>deleteQuestion(si,qi)} className="ml-auto text-xs text-destructive">Excluir pergunta</button></div>
 <input aria-label="Enunciado da pergunta" disabled={published} value={q.label} onChange={e=>changeQuestion(si,qi,{label:e.target.value})} className="w-full rounded-lg border bg-background p-2"/>
 <div className="flex flex-wrap items-center gap-3"><label className="text-xs">Tipo<select disabled={published} value={q.type} onChange={e=>changeQuestion(si,qi,{type:e.target.value as SurveyQuestion["type"],options:["single_choice","multiple_choice","ranking","matrix","money_range"].includes(e.target.value)?(q.options.length?q.options:["Opção 1","Opção 2"]):[],rows:e.target.value==="matrix"?(q.rows?.length?q.rows:["Critério 1","Critério 2"]):undefined,showWhen:undefined})} className="ml-2 rounded-lg border bg-background p-2">{QUESTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
 <label className="text-xs"><input disabled={published} type="checkbox" checked={q.required} onChange={e=>changeQuestion(si,qi,{required:e.target.checked})}/> Obrigatória</label>
 <label className="text-xs">Mover para<select disabled={published} value="" onChange={e=>moveQuestion(si,qi,Number(e.target.value))} className="ml-2 rounded-lg border bg-background p-2"><option value="">Esta seção</option>{schema.sections.map((s,i)=>i!==si?<option key={s.id??i} value={i}>{s.title}</option>:null)}</select></label></div>
 {["single_choice","multiple_choice","ranking","matrix","money_range"].includes(q.type)&&<label className="block text-xs">Alternativas (uma por linha)<textarea disabled={published} value={q.options.join("\n")} onChange={e=>changeQuestion(si,qi,{options:e.target.value.split("\n")})} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>}
 {q.type==="matrix"&&<label className="block text-xs">Linhas da matriz (uma por linha)<textarea disabled={published} value={(q.rows??[]).join("\\n")} onChange={e=>changeQuestion(si,qi,{rows:e.target.value.split("\\n")})} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>}
 <label className="block text-xs">Classificação analítica opcional<input disabled={published} value={q.semanticCode??""} onChange={e=>changeQuestion(si,qi,{semanticCode:e.target.value.trim().toUpperCase()})} placeholder="Ex.: MOBILITY_PAINS" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
 <label className="block text-xs">Ajuda opcional<input disabled={published} value={q.helpText??""} onChange={e=>changeQuestion(si,qi,{helpText:e.target.value})} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
 <label className="block text-xs">Mostrar somente quando<select disabled={published} value={q.showWhen?.questionId??""} onChange={e=>changeQuestion(si,qi,{showWhen:e.target.value?{questionId:e.target.value,equals:""}:undefined})} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">Sempre</option>{visibleParents(si,qi).map(parent=><option key={parent.id} value={parent.id}>{parent.label}</option>)}</select></label>
 {q.showWhen&&<label className="block text-xs">Resposta necessária<select disabled={published} value={q.showWhen.equals} onChange={e=>changeQuestion(si,qi,{showWhen:{questionId:q.showWhen!.questionId,equals:e.target.value}})} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">Escolha</option>{schema.sections.flatMap(s=>s.questions).find(other=>other.id===q.showWhen?.questionId)?.options.map(o=><option key={o}>{o}</option>)}</select></label>}
 </div>)}
 {!published&&<button onClick={()=>changeSection(si,{questions:[...section.questions,newSurveyQuestion()]})} className="rounded-lg border px-3 py-2 text-sm">+ Pergunta</button>}
 </div></details>)}
 {!published&&<button className="rounded-lg border px-4 py-2 text-sm" onClick={()=>apply({sections:[...schema.sections,{id:crypto.randomUUID(),title:"Nova seção",questions:[]}]})}>+ Adicionar seção</button>}</div>}
 {!published&&!preview&&<div className="space-y-3 border-t pt-4"><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void persist("save")} className="rounded-lg border px-4 py-2 font-medium">Salvar rascunho</button><button disabled={busy||issues.length>0} onClick={()=>void persist("publish")} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">Revisar e publicar</button></div>
 {issues.length>0&&<details className="rounded-lg border border-amber-400/40 p-3 text-sm"><summary className="cursor-pointer font-semibold">Checklist: {issues.length} pendência(s)</summary><ul className="mt-2 list-disc pl-5">{issues.slice(0,15).map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}</div>}
 {published&&<button disabled={busy} onClick={()=>void newVersion()} className="rounded-lg border px-4 py-2 font-semibold">Criar nova versão editável</button>}
 </section>;
}
