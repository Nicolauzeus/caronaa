import {describe,expect,it} from "vitest";
import type { SurveyQuestion,SurveySchema } from "./research-templates";
import {cleanAnswers,validatePage,type Answers} from "./research-schema";
import {createUniforGroups,getUniforPainQuestions,setUniforPainAnswers} from "./unifor-compact-groups";

const q=(id:string,semanticCode:string,type:SurveyQuestion["type"],required=true,options=["SIM","NAO"]):SurveyQuestion=>
 ({id,label:id,semanticCode,type,required,options});
const pains=q("pain","MOBILITY_PAINS","multiple_choice",true,["DOR_01","DOR_02","DOR_03"]);
pains.maxValue=2;
const primary=q("primary","URBAN_PRIMARY_PAIN","single_choice",true,["DOR_01","DOR_02","DOR_03"]);
const offer=q("offer","URBAN_OFFER_POSSIBLE","single_choice");
const vehicle=q("vehicle","URBAN_OFFER_VEHICLE","single_choice",true,["CARRO","MOTO"]);
vehicle.showWhen={questionId:"offer",equals:"SIM"};
const seats=q("seats","SEATS_AVAILABLE","number");
seats.showWhen={questionId:"offer",equals:"SIM"};
const schema:SurveySchema={sections:[
 {title:"Rotina",questions:[
  q("academic","ACADEMIC_ROLE","single_choice"),
  q("transport","TRANSPORT_MODE","multiple_choice"),
  q("cost","COST_PER_TRIP","number",false,[]),pains,primary]},
 {title:"Oferta e confiança",questions:[
  offer,vehicle,seats,
  q("adoption","ADOPTION_INTENT","single_choice"),
  q("trust","TRUST_FACTORS","single_choice")]},
 {title:"Lançamento",questions:[
  q("motivation","URBAN_DRIVER_MOTIVATION","single_choice",false),
  q("newsletter","LAUNCH_PARTICIPATION_INTENT","yes_no"),
  q("prep","BOOKING_INTENT","yes_no")]}
]};

describe("UNIFOR compact questionnaire preserving published data contracts",()=>{
 it("compresses 13 published questions into six readable question screens",()=>{
  const groups=createUniforGroups(schema,{});
  expect(groups.map(items=>items.length)).toEqual([3,2,1]);
  expect(groups[0][1].questions.map(q=>q.semanticCode)).toEqual(["TRANSPORT_MODE","COST_PER_TRIP"]);
  expect(groups[1][0].questions.map(q=>q.semanticCode)).toEqual(["URBAN_OFFER_POSSIBLE"]);
  expect(groups[2][0].questions.map(q=>q.semanticCode)).toEqual(["URBAN_DRIVER_MOTIVATION","LAUNCH_PARTICIPATION_INTENT","BOOKING_INTENT"]);
 });
 it("does not display a redundant second pain question, but preserves both analytical answers",()=>{
  const first=setUniforPainAnswers(schema,{},"pain",["DOR_02"]);
  expect(first).toEqual({pain:["DOR_02"],primary:"DOR_02"});
  const second=setUniforPainAnswers(schema,first,"pain",["DOR_02","DOR_01"]);
  expect(second.primary).toBe("DOR_02");
  expect(createUniforGroups(schema,second)[0][2].questions.map(q=>q.id)).toEqual(["pain"]);
  expect(createUniforGroups(schema,second)[0][2].questions[0].helpText).toMatch(/primeira escolhida/);
  expect(validatePage(schema.sections[0],{
   academic:"SIM",transport:["SIM"],...second,
  },schema.sections.flatMap(s=>s.questions),schema)).toEqual([]);
  const remaining=setUniforPainAnswers(schema,second,"pain",["DOR_01"]);
  expect(remaining.primary).toBe("DOR_01");
  expect(cleanAnswers(schema,remaining).primary).toBe("DOR_01");
 });
 it("keeps offer, vehicle and seats on the same dynamic page when offering is confirmed",()=>{
  expect(createUniforGroups(schema,{offer:"SIM"})[1][0].questions.map(q=>q.id))
   .toEqual(["offer","vehicle","seats"]);
  expect(createUniforGroups(schema,{offer:"NAO"})[1][0].questions.map(q=>q.id))
   .toEqual(["offer"]);
 });
 it("does not discard an unrecognized or newly published question",()=>{
  const newSchema:SurveySchema={sections:[
   ...schema.sections.slice(0,1),
   {title:"Oferta e confiança",questions:[...schema.sections[1].questions,
    q("future","NEW_SEMANTIC_CODE","single_choice")]},
   schema.sections[2],
  ]};
  const groups=createUniforGroups(newSchema,{});
  expect(groups[1].flatMap(group=>group.questions).some(q=>q.id==="future")).toBe(true);
 });
 it("preserves ungrouped primary pain when the paired question does not exist",()=>{
  const original:SurveySchema={sections:[{title:"Único",questions:[primary]}]};
  expect(getUniforPainQuestions(original)).toMatchObject({primary});
  expect(createUniforGroups(original,{})[0].flatMap(group=>group.questions)[0]).toBe(primary);
 });
});

// New V2 roles use a versioned pain gate. Legacy required fields stay visible.
it("keeps required historical pains visible, but skips optional driver-only pains",()=>{
 const legacy=createUniforGroups(schema,{},false,"MOTORISTA");
 expect(legacy.flatMap(x=>x).flatMap(g=>g.questions).some(q=>q.semanticCode==="MOBILITY_PAINS")).toBe(true);
 const optional:SurveySchema={sections:schema.sections.map(s=>({
   ...s,questions:s.questions.map(q=>q.semanticCode==="MOBILITY_PAINS"?{...q,required:false}:q),
 }))};
 const driver=createUniforGroups(optional,{},false,"MOTORISTA");
 expect(driver.flatMap(x=>x).flatMap(g=>g.questions).some(q=>q.semanticCode==="MOBILITY_PAINS")).toBe(false);
});
