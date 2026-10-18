import {describe,it,expect} from "vitest";
import {RESEARCH_TEMPLATES} from "./research-templates";
import {inspectSchema,reorder,cleanAnswers,cloneQuestion,validatePage,scheduleWarning} from "./research-schema";
describe("Research builder",()=>{
 it("ships useful valid templates for five natures",()=>{
  expect(RESEARCH_TEMPLATES.length).toBeGreaterThanOrEqual(14);
  expect(new Set(RESEARCH_TEMPLATES.map(t=>t.key)).size).toBe(RESEARCH_TEMPLATES.length);
  expect(RESEARCH_TEMPLATES.some(t=>t.key==="UNIVERSIDADE_URBANA_CARONAA" && t.nature==="EDUCACAO")).toBe(true);
  expect(new Set(RESEARCH_TEMPLATES.map(t=>t.nature)).size).toBe(5);
  for(const t of RESEARCH_TEMPLATES)expect(inspectSchema(t.schema)).toEqual([]);
 });
 it("reorders without mutating input",()=>{
  const data=["a","b","c"];expect(reorder(data,0,2)).toEqual(["b","c","a"]);expect(data).toEqual(["a","b","c"]);
 });
 it("removes hidden answers before submission",()=>{
  const schema={sections:[{title:"Teste",questions:[{id:"parent",label:"Pergunta pai",type:"single_choice" as const,required:true,options:["SIM","NAO"]},{id:"child",label:"Pergunta filha",type:"short_text" as const,required:true,options:[],showWhen:{questionId:"parent",equals:"SIM"}}]}]};
  expect(cleanAnswers(schema,{parent:"NAO",child:"Privado"})).toEqual({parent:"NAO"});
  expect(validatePage(schema.sections[0],{parent:"NAO"})).toEqual([]);
 });
 it("rejects invalid dependencies",()=>{
  const s=structuredClone(RESEARCH_TEMPLATES[0].schema);
  s.sections[0].questions[0].showWhen={questionId:"later",equals:"SIM"};
  expect(inspectSchema(s).some(x=>x.includes("condição"))).toBe(true);
 });
 it("duplicates without shared identity",()=>{
  const q=RESEARCH_TEMPLATES[0].schema.sections[0].questions[0];const copy=cloneQuestion(q);
  expect(copy.id).not.toEqual(q.id);expect(copy.semanticCode).toBeUndefined();
 });
 it("rejects invalid advanced field answers",()=>{
  const section={title:"Avançado",questions:[
   {id:"r",label:"Ordene opções",type:"ranking" as const,required:true,options:["A","B"]},
   {id:"m",label:"Avalie cada item",type:"matrix" as const,required:true,options:["Ruim","Bom"],rows:["Custo","Segurança"]},
   {id:"c",label:"Informe e-mail",type:"contact" as const,required:false,options:[]}
  ]};
  expect(validatePage(section,{r:["A","A"],m:["Custo::Bom"],c:"invalido"})).toHaveLength(3);
  expect(validatePage(section,{r:["A","B"],m:["Custo::Bom","Segurança::Ruim"],c:"a@b.com"})).toEqual([]);
 });
 it("accepts valid 24-hour time and rejects invalid clock times",()=>{
  const section={title:"Horários",questions:[{id:"arrival",label:"Horário de chegada",type:"time" as const,required:true,options:[]}]};
  expect(validatePage(section,{arrival:"17:30"})).toEqual([]);
  expect(validatePage(section,{arrival:"12:00"})).toEqual([]);
  expect(validatePage(section,{arrival:"25:30"})).not.toEqual([]);
 });
 it("blocks impossible days, negative fare and trip duration in legacy schemas",()=>{
  const section={title:"Rotina",questions:[
   {id:"days",label:"Dias por semana",type:"number" as const,required:true,options:[]},
   {id:"time",label:"Duração em minutos",type:"number" as const,required:true,options:[]},
   {id:"cost",label:"Valor em reais",type:"number" as const,required:true,options:[]}
  ]};
  expect(validatePage(section,{days:"47",time:"-28",cost:"-31"})).toHaveLength(3);
  expect(validatePage(section,{days:"7.5",time:"15",cost:"3"})).toHaveLength(1);
  expect(validatePage(section,{days:"5",time:"15",cost:"3"})).toEqual([]);
 });
 it("validates configured number limits instead of relying on question wording",()=>{
  const section={title:"Teste",questions:[{id:"capacity",label:"Número de convidados",type:"number" as const,required:true,options:[],minValue:1,maxValue:4,integerOnly:true}]};
  expect(validatePage(section,{capacity:"5"})).not.toEqual([]);
  expect(validatePage(section,{capacity:"2.5"})).not.toEqual([]);
  expect(validatePage(section,{capacity:"3"})).toEqual([]);
 });
 it("warns about possible next-day departure without rejecting valid HH:mm",()=>{
  const section={title:"Rotina",questions:[
   {id:"arrival",label:"Chegada",type:"time" as const,required:false,options:[]},
   {id:"departure",label:"Saída",type:"time" as const,required:false,options:[]}
  ]};
  expect(validatePage(section,{arrival:"17:30",departure:"12:00"})).toEqual([]);
  expect(scheduleWarning(section,{arrival:"17:30",departure:"12:00"})).toContain("dia seguinte");
  expect(scheduleWarning(section,{arrival:"08:00",departure:"17:30"})).toBeNull();
 });
 it("omits optional empty answers in persistence",()=>{
  const section={title:"Teste",questions:[{id:"optional",label:"Comentário opcional",type:"short_text" as const,required:false,options:[]}]};
  expect(cleanAnswers({sections:[section]},{optional:""})).toEqual({});
 });
});