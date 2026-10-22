import { createResearchVisibility } from "./research-conditions";
import type { Answers } from "./research-schema";
import type { SurveyQuestion, SurveySchema } from "./research-templates";

/**
 * Presentation-only grouping for university research, based on the UNIFOR design. Question UUIDs,
 * required flags and the published schema remain intact for analytics/history.
 * Dynamic rules still determine which dependent questions can be displayed.
 */
const GROUPS = [
  { title:"Sua rotina universitária", semantics:["ACADEMIC_ROLE"] },
  { title:"Como você se desloca", semantics:["TRANSPORT_MODE","COST_PER_TRIP"] },
  { title:"Desafios do seu percurso", semantics:["MOBILITY_PAINS"] },
  { title:"Disponibilidade para oferecer", semantics:["URBAN_OFFER_POSSIBLE","URBAN_OFFER_VEHICLE","SEATS_AVAILABLE"] },
  { title:"Confiança e preferência", semantics:["ADOPTION_INTENT","TRUST_FACTORS"] },
  { title:"Lançamento CARONAA", semantics:["URBAN_DRIVER_MOTIVATION","LAUNCH_PARTICIPATION_INTENT","BOOKING_INTENT"] },
] as const;

export type CompactResearchGroup = { title:string; sectionIndex:number; questions:SurveyQuestion[] };

export function getUniforPainQuestions(schema:SurveySchema){
 const questions=schema.sections.flatMap(section=>section.questions);
 return {
  pains:questions.find(q=>q.semanticCode==="MOBILITY_PAINS"),
  primary:questions.find(q=>q.semanticCode==="URBAN_PRIMARY_PAIN"),
 };
}

/** The first selected pain is the reported main pain. Unselecting it promotes
 * the next selected pain, preserving both legacy database semantic indicators. */
export function setUniforPainAnswers(schema:SurveySchema,previous:Answers,id:string,value:string|string[]):Answers {
 const next:Answers={...previous,[id]:value};
 const {pains,primary}=getUniforPainQuestions(schema);
 if(pains && primary && id===pains.id && Array.isArray(value)) {
  if(value.length)next[primary.id]=value[0];
  else delete next[primary.id];
 }
 return next;
}

/** Group adjacent, related questions; never discard unrecognized fields. */
export function createUniforGroups(schema:SurveySchema,answers:Answers,combineUnknown=false,externalRole?:string|null):CompactResearchGroup[][] {
 const visibility=createResearchVisibility(schema,answers,externalRole);
 const {pains,primary}=getUniforPainQuestions(schema);
 const consolidate=Boolean(pains&&primary);
 return schema.sections.map((section,sectionIndex)=>{
  const visible=section.questions.filter(q=>visibility.questionVisible(q) &&
   !(consolidate&&q.id===primary?.id));
  const used=new Set<string>();
  const list:CompactResearchGroup[]=[];
  for(const definition of GROUPS) {
   const questions=definition.semantics.flatMap(code=>visible.filter(q=>q.semanticCode===code && !used.has(q.id)));
   if(!questions.length)continue;
   // The UI displays the ranking rule, without modifying the stored form/version.
   const decorated=questions.map(q=>q.id===pains?.id?{
    ...q,label:"Quais são suas maiores dificuldades no deslocamento?",
    helpText:"Marque até duas. A primeira escolhida será registrada como a principal.",
   }:q);
   for(const q of questions)used.add(q.id);
   list.push({title:definition.title,sectionIndex,questions:decorated});
  }
  // Use the same compact presentation for university models, without
  // hiding unexpected or required questions and without changing stored schema.
  const remaining=visible.filter(question=>!used.has(question.id));
  const chunk=combineUnknown?2:1;
  for(let i=0;i<remaining.length;i+=chunk) {
   list.push({title:section.title,sectionIndex,questions:remaining.slice(i,i+chunk)});
  }
  return list;
 });
}
