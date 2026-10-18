import type {Answers} from "@/lib/formulario/research-schema";
import {isVisible} from "@/lib/formulario/research-schema";
import type {SurveyQuestion,SurveySection} from "@/lib/formulario/research-templates";

export function ResearchSectionFields({section,answers,onChange,idPrefix=""}:{section:SurveySection;answers:Answers;onChange:(id:string,value:string|string[])=>void;idPrefix?:string}){
 return <div className="space-y-5">{section.questions.filter(q=>isVisible(q,answers)).map(q=>{
  const id=idPrefix+q.id;
  const value=answers[q.id];
  const select=(v:string|string[])=>onChange(q.id,v);
  const choice=(options:string[])=> <div role="group" aria-label={q.label} className="grid gap-2 sm:grid-cols-2">{options.map(opt=><label key={opt} className={"flex cursor-pointer gap-2 rounded-lg border p-3 text-sm transition-colors "+(String(value)===opt?"border-primary bg-primary/10":"hover:bg-muted/50")}><input type="radio" name={id} checked={String(value??"")===opt} onChange={()=>select(opt)}/>{opt.replaceAll("_"," ")}</label>)}</div>;
  return <div key={q.id} className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold">{q.label}{q.required&&<span className="ml-1 text-destructive" aria-label="obrigatória">*</span>}</label>{q.helpText&&<p className="text-xs text-muted-foreground">{q.helpText}</p>}
  {q.type==="long_text"?<textarea id={id} value={String(value??"")} onChange={e=>select(e.target.value)} rows={4} className="w-full rounded-xl border bg-background p-3" maxLength={2000}/>:
  q.type==="single_choice"?<select id={id} required={q.required} value={String(value??"")} onChange={e=>select(e.target.value)} className="w-full rounded-xl border bg-background p-3"><option value="">Selecione</option>{q.options.map(o=><option key={o} value={o}>{o.replaceAll("_"," ")}</option>)}</select>:
  q.type==="multiple_choice"?<div className="space-y-2">{q.options.map(opt=><label key={opt} className="flex items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40"><input type="checkbox" className="mt-1" checked={Array.isArray(value)&&value.includes(opt)} onChange={e=>{const current=Array.isArray(value)?value:[];select(e.target.checked?[...current,opt]:current.filter(v=>v!==opt))}}/>{opt.replaceAll("_"," ")}</label>)}</div>:
  q.type==="yes_no"?choice(["SIM","NAO"]):
  q.type==="rating_1_5"||q.type==="rating_0_10"?choice(Array.from({length:q.type==="rating_1_5"?5:11},(_,i)=>String(q.type==="rating_1_5"?i+1:i))):
  <input id={id} type={q.type==="date"?"date":q.type==="time"?"time":q.type==="number"?"number":"text"} inputMode={q.type==="number"?"decimal":undefined} step={q.type==="number"?"any":undefined} value={String(value??"")} onChange={e=>select(e.target.value)} required={q.required} maxLength={q.type==="short_text"?240:undefined} className="w-full rounded-xl border bg-background p-3"/>}
  </div>;
 })}</div>;
}
export function ResearchBrandHeader({title,imagePath,alt,brandName}:{title:string;imagePath?:string|null;alt?:string|null;brandName?:string|null}){
 const url=imagePath? import.meta.env.VITE_SUPABASE_URL + "/storage/v1/object/public/research-branding/" + imagePath:null;
 return <header className="space-y-3 rounded-xl border bg-card p-5"><div className="flex items-center gap-3">
  {url?<img src={url} alt={alt||"Imagem de identidade visual da pesquisa"} className="h-16 w-16 shrink-0 rounded-xl border bg-white object-contain p-1" loading="lazy"/>:<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-black text-[#805900] dark:text-[#ffd166]" aria-hidden="true">C</div>}
  <div><p className="text-xs font-bold uppercase tracking-widest text-[#805900] dark:text-[#ffd166]">{brandName||"Pesquisa CARONAA"}</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{title}</h1></div>
 </div><p className="text-xs text-muted-foreground">Questionário conduzido pela equipe responsável pela pesquisa. A imagem institucional somente deve ser utilizada com autorização.</p></header>;
}
