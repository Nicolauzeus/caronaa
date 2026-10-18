import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {MUNICIPAL_TEMPLATES,type SurveySchema,type SurveyQuestion} from "@/lib/formulario/research-templates";
const db=supabase as any;
const empty=():SurveySchema=>({sections:[{title:"Seção 1",questions:[]}]});
const newQuestion=():SurveyQuestion=>({id:crypto.randomUUID(),label:"Nova pergunta",type:"short_text",required:false,options:[]});
export function ResearchFormEditor({formId,onClose,onPublished}:{formId:string;onClose:()=>void;onPublished?:()=>void}){
 const [versionId,setVersionId]=useState(""),[version,setVersion]=useState(1),[published,setPublished]=useState(false),[schema,setSchema]=useState<SurveySchema>(empty());
 const [busy,setBusy]=useState(true),[error,setError]=useState(""),[preview,setPreview]=useState(false);
 useEffect(()=>{let alive=true;void db.from("research_form_versions").select("id,version_number,schema_json,published_at").eq("form_id",formId).order("version_number",{ascending:false}).limit(1).single().then(({data,error}:any)=>{if(!alive)return;if(error)setError(error.message);else if(data){setVersionId(data.id);setVersion(data.version_number);setPublished(Boolean(data.published_at));setSchema(data.schema_json?.sections?.length?data.schema_json:empty());}setBusy(false)});return()=>{alive=false}},[formId]);
 const sections=schema.sections;
 const patchSection=(si:number,patch:Partial<{title:string;questions:SurveyQuestion[]}>)=>setSchema(old=>({sections:old.sections.map((x,i)=>i===si?{...x,...patch}:x)}));
 const patchQuestion=(si:number,qi:number,patch:Partial<SurveyQuestion>)=>patchSection(si,{questions:sections[si].questions.map((q,i)=>i===qi?{...q,...patch}:q)});
 async function persist(action:"save"|"publish"){setBusy(true);setError("");try{
  if(published)throw Error("Esta versão foi publicada. Crie outra versão para editar.");
  if(action==="publish"&&!sections.some(s=>s.questions.length))throw Error("Inclua perguntas antes da publicação.");
  for(const s of sections)for(const q of s.questions){if(!q.label.trim())throw Error("Há perguntas sem enunciado.");if(q.type.includes("choice")&&q.options.filter(Boolean).length<2)throw Error("Perguntas de escolha exigem pelo menos duas opções.");}
  const allQuestions=sections.flatMap(sec=>sec.questions);
  if(new Set(allQuestions.map(q=>q.id)).size!==allQuestions.length)throw Error("IDs de perguntas duplicados.");
  for(const q of allQuestions){if(q.showWhen){const parent=allQuestions.find(p=>p.id===q.showWhen?.questionId);if(!parent||parent.type!=="single_choice"||!parent.options.includes(q.showWhen.equals))throw Error("Configure uma condição de exibição válida para: "+q.label);}}
  const {data,error}=await db.from("research_form_versions").update({schema_json:schema,...(action==="publish"?{published_at:new Date().toISOString()}:{})}).eq("id",versionId).is("published_at",null).select("id").single();
  if(error||!data)throw Error(error?.message||"A versão não está mais editável.");
  if(action==="publish"){const r=await db.from("research_forms").update({status:"PUBLICADO",is_enabled:true}).eq("id",formId);if(r.error)throw Error(r.error.message);setPublished(true);onPublished?.();}
 }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar");}finally{setBusy(false)}}
 async function startNewVersion(){setBusy(true);setError("");try{const r=await db.from("research_form_versions").insert({form_id:formId,version_number:version+1,schema_json:schema}).select("id").single();if(r.error)throw Error(r.error.message);setVersionId(r.data.id);setVersion(v=>v+1);setPublished(false);}catch(e){setError(e instanceof Error?e.message:"Falha ao criar versão")}finally{setBusy(false)}}
 return <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-6">
 <div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-lg font-bold">Editor de formulário</h3><p className="text-sm text-muted-foreground">Versão {version} · {published?"Publicada (somente leitura)":"Rascunho"}</p></div><button className="rounded-lg border px-3 py-2" onClick={onClose}>Fechar</button></div>
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 <div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2" onClick={()=>setPreview(!preview)}>{preview?"Editar":"Pré-visualizar"}</button>{published&&<button disabled={busy} className="rounded-lg border px-3 py-2" onClick={()=>void startNewVersion()}>Criar nova versão</button>}</div>
 {!published&&<div className="flex flex-wrap gap-2"><span className="text-sm text-muted-foreground">Modelos:</span>{MUNICIPAL_TEMPLATES.map(t=><button key={t.key} type="button" title={t.description} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setSchema(structuredClone(t.schema))}>{t.label}</button>)}</div>}
 {sections.map((section,si)=><div key={si} className="space-y-3 rounded-xl border p-3">
 {preview?<h4 className="font-bold">{section.title}</h4>:<div className="flex gap-2"><input disabled={published} aria-label="Título da seção" className="w-full rounded-lg border bg-background p-2 font-semibold" value={section.title} onChange={e=>patchSection(si,{title:e.target.value})}/><button disabled={published||sections.length===1} onClick={()=>setSchema(s=>({sections:s.sections.filter((_,i)=>i!==si)}))} className="text-xs text-destructive">Excluir seção</button></div>}
 {section.questions.map((q,qi)=><div key={q.id} className="space-y-2 rounded-xl bg-secondary/30 p-3">
 {preview?<p className="font-medium">{q.label}{q.required?" *":""}</p>:<>
 <input disabled={published} aria-label="Pergunta" className="w-full rounded-lg border bg-background p-2" value={q.label} onChange={e=>patchQuestion(si,qi,{label:e.target.value})}/>
 <div className="flex flex-wrap items-center gap-2"><select disabled={published} value={q.type} onChange={e=>patchQuestion(si,qi,{type:e.target.value as SurveyQuestion["type"]})} className="rounded-lg border bg-background p-2">{[["short_text","Texto curto"],["long_text","Texto longo"],["number","Número"],["single_choice","Escolha única"],["multiple_choice","Múltipla escolha"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><label className="text-sm"><input disabled={published} type="checkbox" checked={q.required} onChange={e=>patchQuestion(si,qi,{required:e.target.checked})}/> Obrigatória</label><button disabled={published} className="ml-auto text-sm text-destructive" onClick={()=>patchSection(si,{questions:section.questions.filter((_,i)=>i!==qi)})}>Remover</button></div>
 {q.type.includes("choice")&&<label className="block text-sm">Alternativas (uma por linha)<textarea disabled={published} value={q.options.join("\n")} onChange={e=>patchQuestion(si,qi,{options:e.target.value.split("\n")})} className="mt-1 w-full rounded-lg border bg-background p-2" rows={3}/></label>}
 <label className="block text-sm">Exibir somente quando
 <select disabled={published} value={q.showWhen?.questionId??""} onChange={e=>patchQuestion(si,qi,{showWhen:e.target.value?{questionId:e.target.value,equals:""}:undefined})} className="mt-1 w-full rounded-lg border bg-background p-2">
 <option value="">Sempre visível</option>
 {sections.flatMap(sec=>sec.questions).filter(other=>other.id!==q.id&&other.type==="single_choice").map(other=><option key={other.id} value={other.id}>{other.label}</option>)}
 </select></label>
 {q.showWhen&&<label className="block text-sm">Quando a resposta for
 <select disabled={published} value={q.showWhen.equals} onChange={e=>patchQuestion(si,qi,{showWhen:{questionId:q.showWhen!.questionId,equals:e.target.value}})} className="mt-1 w-full rounded-lg border bg-background p-2">
 <option value="">Selecione uma alternativa</option>
 {(sections.flatMap(sec=>sec.questions).find(other=>other.id===q.showWhen?.questionId)?.options??[]).map(o=><option key={o} value={o}>{o}</option>)}
 </select></label>}
 </>}
 {preview&&<div className="text-sm text-muted-foreground">{q.type.includes("choice")?q.options.join(" • "):"Campo de resposta"}</div>}
 </div>)}
 {!published&&!preview&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>patchSection(si,{questions:[...section.questions,newQuestion()]})}>+ Pergunta</button>}
 </div>)}
 {!published&&!preview&&<button className="rounded-lg border px-3 py-2" onClick={()=>setSchema(s=>({sections:[...s.sections,{title:"Nova seção",questions:[]}]}))}>+ Seção</button>}
 <div className="flex flex-wrap gap-2">{!published&&<><button disabled={busy} className="rounded-lg border px-4 py-2" onClick={()=>void persist("save")}>Salvar rascunho</button><button disabled={busy} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" onClick={()=>void persist("publish")}>Publicar e habilitar</button></>}</div>
 </section>;
}
