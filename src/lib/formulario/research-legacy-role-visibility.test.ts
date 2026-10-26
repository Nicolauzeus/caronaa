import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { freshTemplate, type SurveySchema } from "./research-templates";
import { urbanUniversityTemplate } from "./urban-university";
import { regionalUniversityTemplate } from "./regional-university";
import { createResearchVisibility } from "./research-conditions";
import { cleanAnswers,validatePage } from "./research-schema";
import { createUniforGroups } from "./unifor-compact-groups";

function legacyUnifor(): SurveySchema {
 const schema=freshTemplate(urbanUniversityTemplate);
 // Mirrors the published UNIFOR v2: role is chosen in a separate journey step,
 // and the original first offer question has no explicit role condition.
 schema.sections[0].questions=schema.sections[0].questions.filter(q=>q.semanticCode!=="RESEARCH_PARTICIPANT_ROLE");
 for(const s of schema.sections)for(const q of s.questions) if(q.semanticCode==="URBAN_OFFER_POSSIBLE") delete q.condition;
 return schema;
}

describe("legacy and newly published university profile filtering",()=>{
 it("never shows mandatory driver questions to the legacy PASSAGEIRO profile",()=>{
  const schema=legacyUnifor(),q=schema.sections.flatMap(s=>s.questions);
  const offer=q.find(v=>v.semanticCode==="URBAN_OFFER_POSSIBLE")!;
  const vehicle=q.find(v=>v.semanticCode==="URBAN_OFFER_VEHICLE")!;
  const seats=q.find(v=>v.semanticCode==="SEATS_AVAILABLE")!;
  const reasons=q.find(v=>v.semanticCode==="URBAN_DRIVER_MOTIVATION")!;
  const input={[offer.id]:"SIM",[vehicle.id]:"CARRO",[seats.id]:"4",[reasons.id]:"AJUDAR"};
  const passenger=createResearchVisibility(schema,input,"PASSAGEIRO");
  for(const field of [offer,vehicle,seats,reasons]) expect(passenger.questionVisible(field)).toBe(false);
  expect(cleanAnswers(schema,input,"PASSAGEIRO")).toEqual({});
  for(const section of schema.sections)
   expect(validatePage({...section,questions:section.questions.filter(x=>[offer.id,vehicle.id,seats.id,reasons.id].includes(x.id))}, {},undefined,schema,"PASSAGEIRO")).toEqual([]);
  expect(createUniforGroups(schema,input,false,"PASSAGEIRO").flat().flatMap(g=>g.questions).some(v=>v.id===offer.id)).toBe(false);
 });
 it("shows driver questions only when allowed, and respects nested offer answer",()=>{
  const schema=legacyUnifor(),q=schema.sections.flatMap(s=>s.questions);
  const offer=q.find(v=>v.semanticCode==="URBAN_OFFER_POSSIBLE")!;
  const vehicle=q.find(v=>v.semanticCode==="URBAN_OFFER_VEHICLE")!;
  const seats=q.find(v=>v.semanticCode==="SEATS_AVAILABLE")!;
  expect(createResearchVisibility(schema,{[offer.id]:"SIM"},"MOTORISTA").questionVisible(vehicle)).toBe(true);
  expect(createResearchVisibility(schema,{[offer.id]:"SIM"},"AMBOS").questionVisible(seats)).toBe(true);
  expect(createResearchVisibility(schema,{[offer.id]:"NAO",[vehicle.id]:"CARRO"},"MOTORISTA").questionVisible(vehicle)).toBe(false);
  expect(cleanAnswers(schema,{[offer.id]:"NAO",[vehicle.id]:"CARRO",[seats.id]:"4"},"MOTORISTA")).toEqual({[offer.id]:"NAO"});
 });
 it("keeps regional published role-aware conditional flow and ordinary passenger questions",()=>{
  const schema=freshTemplate(regionalUniversityTemplate),q=schema.sections.flatMap(s=>s.questions);
  const role=q.find(v=>v.semanticCode==="RESEARCH_PARTICIPANT_ROLE")!;
  const offered=q.find(v=>v.semanticCode==="SEATS_AVAILABLE")!;
  const wait=q.find(v=>v.semanticCode==="WAIT_TIME")!;
  const v=(role:string)=>createResearchVisibility(schema,{[q.find(x=>x.semanticCode==="RESEARCH_PARTICIPANT_ROLE")!.id]:role});
  // Passengers and drivers answer different questions.
  expect(v("PASSAGEIRO").questionVisible(wait)).toBe(true);
  expect(v("MOTORISTA").questionVisible(wait)).toBe(false);
  expect(v("AMBOS").questionVisible(wait)).toBe(true);
  expect(v("PROFISSIONAL").questionVisible(offered)).toBe(false);
  const academic=q.find(v=>v.semanticCode==="ACADEMIC_ROLE")!;
  expect(createResearchVisibility(schema,{[role.id]:"PASSAGEIRO"}).questionVisible(offered)).toBe(false);
  expect(createResearchVisibility(schema,{[role.id]:"PASSAGEIRO"}).questionVisible(academic)).toBe(true);
  expect(createResearchVisibility(schema,{[role.id]:"MOTORISTA"}).questionVisible(offered)).toBe(true);
  expect(createResearchVisibility(schema,{}).questionVisible(offered)).toBe(false);
 });
 it("pins the SQL contract for published versions without rewriting historical answers",()=>{
  const sql=readFileSync("drizzle/migrations/0112_research_role_conditional_guard.sql","utf8");
  expect(sql).toContain("app.research_journey_role");
  expect(sql).toContain("IF selected_role='PASSAGEIRO' THEN RETURN false;");
  expect(sql).toContain("public.research_question_visible(jsonb,jsonb,text,integer)");
  expect(sql).toContain("public.submit_configured_research_answer");
  expect(sql).not.toMatch(/DELETE FROM public.research_answers|UPDATE public.research_form_versions/);
 });
});
