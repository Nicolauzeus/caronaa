import type {SurveyQuestion,SurveySchema,SurveySection} from "./research-templates";
export const newSurveyQuestion=():SurveyQuestion=>({id:crypto.randomUUID(),label:"Nova pergunta",type:"short_text",required:false,options:[]});
export const emptySurveySchema=():SurveySchema=>({sections:[{id:crypto.randomUUID(),title:"Primeira seção",questions:[]}]});
export const reorder=<T,>(items:T[],from:number,to:number):T[]=>{
 if(from<0||from>=items.length||to<0||to>=items.length||from===to)return [...items];
 const copy=[...items];const [item]=copy.splice(from,1);copy.splice(to,0,item);return copy;
};
export const cloneQuestion=(q:SurveyQuestion):SurveyQuestion=>({...structuredClone(q),id:crypto.randomUUID(),semanticCode:undefined,showWhen:undefined});
export function inspectSchema(schema:SurveySchema):string[]{
 const errors:string[]=[];
 if(schema.sections.length===0)errors.push("Adicione pelo menos uma seção.");
 if(schema.sections.length>30)errors.push("Limite de 30 seções.");
 const ids=new Set<string>();const prior=new Map<string,SurveyQuestion>();
 let total=0;
 schema.sections.forEach((s,si)=>{
  if(s.title.trim().length<2)errors.push("A seção "+(si+1)+" precisa de título.");
  if(!s.questions.length)errors.push("A seção "+(si+1)+" está vazia.");
  s.questions.forEach((q,qi)=>{
   total++;
   const name="Seção "+(si+1)+", pergunta "+(qi+1);
   if(ids.has(q.id))errors.push(name+": identificador duplicado.");
   ids.add(q.id);
   if(q.label.trim().length<3)errors.push(name+": enunciado muito curto.");
   if(["single_choice","multiple_choice"].includes(q.type)){
    const options=q.options.map(x=>x.trim()).filter(Boolean);
    if(options.length<2||new Set(options).size!==options.length)errors.push(name+": alternativas insuficientes ou duplicadas.");
   }
   if(q.showWhen){
    const parent=prior.get(q.showWhen.questionId);
    if(!parent||parent.type!=="single_choice"||!parent.options.includes(q.showWhen.equals))errors.push(name+": a condição deve depender de pergunta anterior de escolha única.");
   }
   prior.set(q.id,q);
  });
 });
 if(total>200)errors.push("Limite de 200 perguntas.");
 if(total===0)errors.push("Adicione perguntas antes de publicar.");
 return errors;
}
export type AnswerValue=string|string[];
export type Answers=Record<string,AnswerValue>;
export function isVisible(q:SurveyQuestion,answers:Answers):boolean{
 return !q.showWhen||String(answers[q.showWhen.questionId]??"")===q.showWhen.equals;
}
export function cleanAnswers(schema:SurveySchema,answers:Answers):Answers{
 const result:Answers={};
 for(const section of schema.sections)for(const q of section.questions)if(isVisible(q,answers)&&answers[q.id]!==undefined)result[q.id]=answers[q.id];
 return result;
}
export function validatePage(section:SurveySection,answers:Answers):string[]{
 return section.questions.filter(q=>isVisible(q,answers)).flatMap(q=>{
  const value=answers[q.id];
  if(q.required&&(!value||(Array.isArray(value)&&!value.length)))return ["Responda: "+q.label];
  if(value===undefined||value==="")return [];
  if(q.type==="number"&&(!Number.isFinite(Number(value))||Array.isArray(value)))return ["Número inválido: "+q.label];
  if(q.type==="rating_1_5"&&(!/^[1-5]$/.test(String(value))))return ["Escolha uma nota entre 1 e 5: "+q.label];
  if(q.type==="rating_0_10"&&(!/^(10|[0-9])$/.test(String(value))))return ["Escolha uma nota entre 0 e 10: "+q.label];
  if(q.type==="yes_no"&&!["SIM","NAO"].includes(String(value)))return ["Escolha sim ou não: "+q.label];
  if(q.type==="single_choice"&&!q.options.includes(String(value)))return ["Alternativa inválida: "+q.label];
  if(q.type==="multiple_choice"&&(!Array.isArray(value)||value.some(x=>!q.options.includes(x))))return ["Alternativas inválidas: "+q.label];
  return [];
 });
}
