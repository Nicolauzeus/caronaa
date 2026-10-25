import {supabase} from "@/integrations/supabase/client";
import type {Answers} from "@/lib/formulario/research-schema";
import {isVisible,getNumberBounds,validatePage} from "@/lib/formulario/research-schema";
import {ResearchSeatPicker} from "./ResearchSeatPicker";
import {SimpleMobilityPains} from "./SimpleMobilityPains";
import {isSimpleMobility} from "@/lib/formulario/mobility-simple";
import {formatResearchOption,getRatingScaleContext} from "@/lib/formulario/research-option-labels";
import type {SurveyQuestion,SurveySection,SurveySchema} from "@/lib/formulario/research-templates";
import {createResearchVisibility} from "@/lib/formulario/research-conditions";

export function ResearchSectionFields({section,answers,onChange,idPrefix="",errors={},allQuestions,schema,compact=false,externalRole}:{section:SurveySection;answers:Answers;onChange:(id:string,value:string|string[])=>void;idPrefix?:string;errors?:Record<string,string>;allQuestions?:SurveyQuestion[];schema?:SurveySchema;compact?:boolean;externalRole?:string|null}){
 if(schema && isSimpleMobility(schema) && section.questions.some(q=>q.semanticCode==="MOBILITY_PAINS")){
   // Keep extra editor-authored questions visible; never silently hide required fields.
   const extras=section.questions.filter(q=>!["MOBILITY_PAINS","MOBILITY_PRIMARY_PAIN","MOBILITY_OTHER_PAIN"].includes(q.semanticCode??""));
   return <div className="space-y-4">
     <SimpleMobilityPains schema={schema} answers={answers} errors={errors} onChange={onChange}/>
     {extras.length>0 && <ResearchSectionFields section={{...section,questions:extras}}
       answers={answers} onChange={onChange} idPrefix={idPrefix} errors={errors}
       allQuestions={allQuestions} schema={schema} compact={compact} externalRole={externalRole}/>}
   </div>;
 }
 return <div className={compact?"min-w-0 space-y-2":"space-y-5"}>{section.questions.filter(q=>schema?createResearchVisibility(schema,answers,externalRole).questionVisible(q):isVisible(q,answers,allQuestions)).map(q=>{
  const id=idPrefix+q.id;
  const value=answers[q.id];
  const select=(v:string|string[])=>onChange(q.id,v);
  const bounds=q.type==="number"?getNumberBounds(q):null;
  const seatQuestion=q.type==="number"&&["SEATS_AVAILABLE","EVENT_OFFER_SEATS"].includes(q.semanticCode??"");
  // A motorcycle may take only one passenger: show the restriction while the
  // respondent is typing rather than at the end of the survey.
  const motorcycle = Boolean((allQuestions??section.questions).some((item) =>
    ["URBAN_OFFER_VEHICLE","REGIONAL_OFFER_VEHICLE","EVENT_OFFER_VEHICLE"].includes(item.semanticCode??"")
    && answers[item.id]==="MOTO"));
  const seatMax = motorcycle ? 1 : bounds?.max ?? 7;
  const isText=q.type==="short_text"||q.type==="long_text"||q.type==="location";
  const charCount=isText?Array.from(String(value??"").trim()).length:0;
  const charMax=q.maxLength??(q.type==="long_text"?2000:240);
  const liveError=value===undefined||value===""||!schema?null:
    validatePage({title:"Campo",questions:[q]},answers,allQuestions,schema,externalRole)[0]??null;
  const choice=(options:string[])=><fieldset className="grid grid-cols-2 gap-2"><legend className="sr-only">{q.label}</legend>{options.map(opt=><label key={opt} className={"flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring "+(String(value)===opt?"border-primary bg-primary/10 font-semibold":"border-border hover:bg-muted/50")}><input type="radio" name={id} value={opt} checked={String(value??"")===opt} onChange={()=>select(opt)} className="accent-primary"/>{formatResearchOption(opt)}</label>)}</fieldset>;
  const rating=(max:number,min:number)=>{const scores=Array.from({length:max-min+1},(_,i)=>String(i+min));const context=getRatingScaleContext(q);return <fieldset className="space-y-2.5">
   <legend className="sr-only">{q.label}</legend>
   <div className={compact?"grid w-full grid-cols-1 gap-1":max===5?"grid grid-cols-5 gap-1.5 sm:gap-2":"w-full overflow-x-auto pb-1"} role="radiogroup" aria-label={q.label}>
    <div className={compact?"grid grid-cols-6 gap-1 sm:grid-cols-11":max===5?"contents":"grid min-w-[484px] grid-cols-11 gap-1"}>
     {scores.map(score=>{
      const checked=String(value??"")===score;
      const scoreNumber=Number(score);
      const emphasis=context.intent==="safety"
       ?(scoreNumber<3?"border-red-500 bg-red-500/10 text-red-700 dark:text-red-300":scoreNumber===3?"border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300":"border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")
       :"border-primary bg-primary/10 text-foreground";
      return <label key={score} className={"flex min-h-12 min-w-0 cursor-pointer items-center justify-center rounded-xl border text-center text-base font-semibold tabular-nums transition-all duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring "+(checked?emphasis+" shadow-sm":"border-border bg-background text-foreground hover:border-primary/60 hover:bg-muted/50")}>
       <input type="radio" name={id} value={score} checked={checked} onChange={()=>select(score)} aria-label={score+" de "+max+": "+(scoreNumber===min?context.low:scoreNumber===max?context.high:q.label)} className="sr-only"/>
       <span aria-hidden="true">{score}</span>
      </label>
     })}
    </div>
   </div>
   <div className="flex items-center justify-between gap-3 px-0.5 text-[11px] leading-tight text-muted-foreground sm:text-xs"><span>{min} · {context.low}</span><span className="text-right">{max} · {context.high}</span></div>
  </fieldset>};
  return <div key={q.id} className={compact?"min-w-0 space-y-1.5":"space-y-2"}>{["multiple_choice","yes_no","rating_1_5","rating_0_10","rating_stars","matrix","ranking"].includes(q.type)?
   <p className="text-sm font-semibold" id={id+"-prompt"}>{q.label}{q.required&&<span className="ml-1 text-destructive" aria-label="obrigatória">*</span>}</p>:
   <label htmlFor={id} className="block text-sm font-semibold">{q.label}{q.required&&<span className="ml-1 text-destructive" aria-label="obrigatória">*</span>}</label>}{q.helpText&&<p className="text-xs text-muted-foreground">{q.helpText}</p>}
  {q.type==="long_text"?<textarea id={id} value={String(value??"")} onChange={e=>select(e.target.value)} rows={4} className="w-full rounded-xl border bg-background p-3" maxLength={q.maxLength??2000} aria-invalid={Boolean(errors[q.id]||liveError)} aria-describedby={id+"-feedback"}/>:
  q.type==="single_choice"&&q.semanticCode==="RESEARCH_PARTICIPANT_ROLE"?
  <fieldset className="grid gap-2 sm:grid-cols-2">
    <legend className="sr-only">{q.label}</legend>
    {q.options.map(o=><label key={o} className={"flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors "+(value===o?"border-primary bg-primary/10 font-semibold":"border-border hover:bg-muted/50")}>
      <input type="radio" name={id} value={o} checked={value===o} onChange={()=>select(o)} className="accent-primary"/>
      <span>{o==="PASSAGEIRO"?"Quero encontrar carona":o==="MOTORISTA"?"Posso oferecer carona":o==="AMBOS"?"Quero encontrar e oferecer carona":"Atuo com transporte profissional"}</span>
    </label>)}
  </fieldset>:
  q.type==="single_choice"?<select id={id} required={q.required} value={String(value??"")} onChange={e=>select(e.target.value)} className="w-full rounded-xl border bg-background p-3"><option value="">Selecione</option>{q.options.map(o=><option key={o} value={o}>{formatResearchOption(o)}</option>)}</select>:
  q.type==="multiple_choice"?<fieldset className={compact?"grid min-w-0 grid-cols-2 gap-1.5 lg:grid-cols-3":q.options.every(opt=>formatResearchOption(opt).length<=48)?"grid grid-cols-1 gap-2 sm:grid-cols-2":"grid grid-cols-1 gap-2"}><legend className="sr-only">{q.label}</legend>{q.options.map(opt=>{
    const checked=Array.isArray(value)&&value.includes(opt);
    return <label key={opt} className={"flex min-w-0 cursor-pointer items-center rounded-xl border leading-tight transition-colors focus-within:ring-2 focus-within:ring-ring "+(compact?"min-h-10 gap-1.5 px-2 py-1.5 text-xs":"min-h-11 gap-2.5 px-3 py-2.5 text-sm")+" "+(checked?"border-primary bg-primary/10 font-medium":"border-border hover:bg-muted/40")}>
     <input type="checkbox" className="shrink-0 accent-primary" checked={checked}
      disabled={!checked && q.maxValue !== undefined && Array.isArray(value) && value.length>=q.maxValue}
      onChange={e=>{const current=Array.isArray(value)?value:[];select(e.target.checked?[...current,opt]:current.filter(v=>v!==opt))}}/>{formatResearchOption(opt)}
    </label>;
   })}{compact&&q.semanticCode==="MOBILITY_PAINS"&&Array.isArray(value)&&value.length>0&&(
      <p className="col-span-2 mt-1 rounded-lg bg-primary/10 px-2 py-1.5 text-xs leading-5">
        <strong>Principal:</strong> {formatResearchOption(value[0])}
        {value.length>1&&<span className="text-muted-foreground"> · Segunda: {formatResearchOption(value[1])}</span>}
      </p>
    )}</fieldset>:
  q.type==="yes_no"?choice(["SIM","NAO"]):
  q.type==="money_range"?<select id={id} value={String(value??"")} onChange={e=>select(e.target.value)} className="w-full rounded-lg border bg-background p-3"><option value="">Selecione a faixa</option>{q.options.map(o=><option key={o} value={o}>{formatResearchOption(o)}</option>)}</select>:
  q.type==="ranking"?<div className="space-y-2">{(!Array.isArray(value)?[]:value).length===0?<button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>select([...q.options])}>Começar ordenação</button>:(value as string[]).map((opt,index,items)=><div key={opt} className="flex items-center gap-2 rounded-lg border p-2"><span className="w-7 text-xs text-muted-foreground">{index+1}º</span><span className="flex-1 text-sm">{opt}</span><button type="button" disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];select(next)}} className="rounded border px-2 py-1 text-sm" aria-label={"Subir "+opt}>↑</button><button type="button" disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];select(next)}} className="rounded border px-2 py-1 text-sm" aria-label={"Descer "+opt}>↓</button></div>)}</div>:
  q.type==="matrix"?<div className="space-y-2">{(q.rows??[]).map(row=>{const found=Array.isArray(value)?value.find(x=>x.startsWith(row+"::")):undefined;return <label key={row} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="min-w-28 flex-1 font-medium">{row}</span><select value={found?.slice(row.length+2)??""} onChange={e=>{const current=Array.isArray(value)?value.filter(x=>!x.startsWith(row+"::")):[];select(e.target.value?[...current,row+"::"+e.target.value]:current)}} className="min-w-32 rounded-lg border bg-background p-2"><option value="">Escolha</option>{q.options.map(opt=><option key={opt}>{opt}</option>)}</select></label>})}</div>:
  q.type==="rating_1_5"||q.type==="rating_0_10"||q.type==="rating_stars"?rating(q.type==="rating_0_10"?10:5,q.type==="rating_0_10"?0:1):
  seatQuestion&&bounds?
  <ResearchSeatPicker id={id} value={String(value??"")} min={bounds.min} max={seatMax}
    onChange={select} error={errors[q.id]} />:
  q.type==="number"&&bounds?.integerOnly&&bounds.max-bounds.min<=10?
  <><select id={id} value={String(value??"")} onChange={e=>select(e.target.value)} required={q.required} aria-describedby={id+"-limits"} className="w-full rounded-xl border bg-background p-3"><option value="">Selecione a quantidade</option>{Array.from({length:bounds.max-bounds.min+1},(_,i)=>i+bounds.min).map(n=><option key={n} value={String(n)}>{n}</option>)}</select><p id={id+"-limits"} className="text-xs text-muted-foreground">Escolha entre {bounds.min} e {bounds.max}.</p></>:
  <><input id={id} type={q.type==="date"?"date":q.type==="time"?"time":q.type==="number"?"number":q.type==="contact"?"email":"text"} inputMode={q.type==="number"?(bounds?.integerOnly?"numeric":"decimal"):q.type==="contact"?"email":undefined} min={bounds?.min} max={bounds?.max} step={q.type==="number"?(bounds?.integerOnly?"1":"0.01"):undefined} value={String(value??"")} onChange={e=>select(e.target.value)} required={q.required} maxLength={isText?charMax:undefined} aria-invalid={Boolean(errors[q.id]||liveError)} aria-describedby={id+"-feedback"} className="w-full rounded-xl border bg-background p-3"/>{bounds&&<p id={id+"-limits"} className="text-xs text-muted-foreground">Valor permitido: {bounds.min} a {bounds.max}{bounds.integerOnly?" · somente números inteiros":""}.</p>}</>}
  {isText&&<p className="text-right text-[11px] tabular-nums text-muted-foreground">
    {q.minLength&&charCount<q.minLength&&charCount>0?`Faltam ${q.minLength-charCount} caracteres · `:""}
    {charCount} / {charMax} caracteres
  </p>}
  {q.type==="multiple_choice"&&q.maxValue!==undefined&&<p role="status" className="text-xs text-muted-foreground">
    {Array.isArray(value)?value.length:0} de {q.maxValue} opções selecionadas
  </p>}
  {!seatQuestion&&(errors[q.id]||liveError)&&<p id={id+"-feedback"} role="alert" className="text-xs font-medium text-destructive">{errors[q.id]||liveError}</p>}
  </div>;
 })}</div>;
}
export function ResearchBrandHeader({title,imagePath,alt,brandName,onEditImage,compact=false}:{title:string;imagePath?:string|null;alt?:string|null;brandName?:string|null;onEditImage?:()=>void;compact?:boolean}){
 const url=imagePath?supabase.storage.from("research-branding").getPublicUrl(imagePath).data.publicUrl:null;
 return <header className={compact?"rounded-xl border bg-card p-3 sm:p-4":"space-y-3 rounded-xl border bg-card p-5"}><div className="flex items-center gap-3">
  {onEditImage?<button type="button" aria-label={imagePath?"Trocar imagem do formulário":"Adicionar imagem ao formulário"} title="Personalizar imagem do formulário" onClick={onEditImage} className="group relative flex shrink-0 items-center gap-2 rounded-xl border-2 border-dashed border-primary/55 bg-primary/5 p-1 text-left transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
    {url?<img src={url} alt={alt||"Identidade visual da pesquisa"} className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain"/>:<span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-2xl font-black text-[#805900] dark:text-[#ffd166]">C</span>}
    <span className="max-w-24 text-xs font-semibold text-[#805900] dark:text-[#FFD166]">{url?"Trocar imagem":"Adicionar imagem"}</span>
   </button>:
   url?<img src={url} alt={alt||"Imagem de identidade visual da pesquisa"} className="h-16 w-16 shrink-0 rounded-xl border bg-white object-contain p-1" loading="lazy"/>:<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-black text-[#805900] dark:text-[#ffd166]" aria-hidden="true">C</div>}
  <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-[#805900] dark:text-[#ffd166]">{brandName||"Pesquisa CARONAA"}</p><h1 className={compact?"mt-1 break-words text-lg font-extrabold sm:text-xl":"mt-1 break-words text-2xl font-extrabold sm:text-3xl"}>{title}</h1></div>
 </div>{!compact&&<p className="text-xs text-muted-foreground">Questionário conduzido pela equipe responsável pela pesquisa. A imagem institucional somente deve ser utilizada com autorização.</p>}</header>;
}
