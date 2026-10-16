import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Question = {id:string;label:string;type:"short_text"|"long_text"|"single_choice"|"multiple_choice"|"number";required:boolean;options:string[]};
type Schema = {sections:{title:string;questions:Question[]}[]};
const db=supabase as any;
const newQuestion=():Question=>({id:crypto.randomUUID(),label:"Nova pergunta",type:"short_text",required:false,options:[]});
export function ResearchFormEditor({formId,onClose}:{formId:string;onClose:()=>void}){
 const [versionId,setVersionId]=useState("");
 const [schema,setSchema]=useState<Schema>({sections:[{title:"Perguntas",questions:[]}]});
 const [busy,setBusy]=useState(true);const [error,setError]=useState("");
 const [preview,setPreview]=useState(false);
 useEffect(()=>{let active=true;void db.from("research_form_versions").select("id,schema_json,published_at").eq("form_id",formId).order("version_number",{ascending:false}).limit(1).single().then(({data,error}:any)=>{
 if(!active)return;if(error){setError(error.message)}else if(data){setVersionId(data.id);if(data.schema_json?.sections?.length)setSchema(data.schema_json);}
 setBusy(false);});return()=>{active=false};},[formId]);
 const update=(idx:number,patch:Partial<Question>)=>setSchema(s=>({sections:s.sections.map((sec,i)=>i===0?{...sec,questions:sec.questions.map((q,j)=>j===idx?{...q,...patch}:q)}:sec)}));
 async function save(){setBusy(true);setError("");const {error}=await db.from("research_form_versions").update({schema_json:schema}).eq("id",versionId).is("published_at",null);if(error)setError(error.message);setBusy(false)}
 async function publish(){setBusy(true);setError("");try{if(schema.sections[0].questions.length===0)throw Error("Inclua pelo menos uma pergunta");const {error:e}=await db.from("research_form_versions").update({schema_json:schema,published_at:new Date().toISOString()}).eq("id",versionId).is("published_at",null);if(e)throw Error(e.message);const {error:u}=await db.from("research_forms").update({status:"PUBLICADO"}).eq("id",formId);if(u)throw Error(u.message);onClose()}catch(e){setError(e instanceof Error?e.message:"Falha ao publicar")}finally{setBusy(false)}}
 const questions=schema.sections[0]?.questions??[];
 return <div className="space-y-4 rounded-2xl border bg-card p-4">
 <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-bold">Editor visual de perguntas</h3><button onClick={onClose} className="rounded-lg border px-3 py-2">Fechar</button></div>
 <p className="text-sm text-muted-foreground">Crie perguntas e opções sem escrever código. Previsualização mobile. Publicação bloqueia alterações nesta versão.</p>
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 <button onClick={()=>setPreview(!preview)} className="rounded-lg border px-4 py-2">{preview?"Editar":"Pré-visualizar"}</button>
 {preview?<div className="mx-auto max-w-sm space-y-4 rounded-2xl border bg-background p-4">{questions.map(q=><label key={q.id} className="block text-sm font-medium">{q.label}{q.required?" *":""}{q.type.includes("choice")?<select disabled className="mt-2 w-full rounded-lg border bg-background p-2"><option>Selecione</option>{q.options.map(x=><option key={x}>{x}</option>)}</select>:<input disabled className="mt-2 w-full rounded-lg border bg-background p-2" placeholder="Sua resposta"/>}</label>)}</div>:
 <div className="space-y-3">{questions.map((q,i)=><div key={q.id} className="space-y-3 rounded-xl border p-3">
 <input aria-label="Enunciado" value={q.label} onChange={e=>update(i,{label:e.target.value})} className="w-full rounded-lg border bg-background p-3"/>
 <div className="flex flex-wrap gap-3"><select aria-label="Tipo da pergunta" value={q.type} onChange={e=>update(i,{type:e.target.value as Question["type"]})} className="rounded-lg border bg-background p-2">{[["short_text","Texto curto"],["long_text","Texto longo"],["single_choice","Escolha única"],["multiple_choice","Múltipla escolha"],["number","Número"]].map(([val,label])=><option key={val} value={val}>{label}</option>)}</select>
 <label className="flex items-center gap-2"><input type="checkbox" checked={q.required} onChange={e=>update(i,{required:e.target.checked})}/> Obrigatória</label>
 <button className="ml-auto text-sm text-destructive" onClick={()=>setSchema(s=>({sections:[{...s.sections[0],questions:s.sections[0].questions.filter(x=>x.id!==q.id)}]}))}>Remover</button></div>
 {q.type.includes("choice")&&<label className="block text-sm">Opções (uma por linha)<textarea value={q.options.join("\n")} onChange={e=>update(i,{options:e.target.value.split("\n")})} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>}
 </div>)}
 <button onClick={()=>setSchema(s=>({sections:[{...s.sections[0],questions:[...s.sections[0].questions,newQuestion()]}]}))} className="rounded-lg border px-4 py-2">+ Adicionar pergunta</button></div>}
 <div className="flex flex-wrap gap-2"><button disabled={busy||!versionId} onClick={()=>void save()} className="rounded-lg border px-4 py-2 disabled:opacity-50">Salvar rascunho</button><button disabled={busy||!versionId} onClick={()=>void publish()} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">Publicar formulário</button></div>
 </div>;
}
