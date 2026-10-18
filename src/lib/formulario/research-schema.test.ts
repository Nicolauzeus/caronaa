import {describe,it,expect} from "vitest";
import {RESEARCH_TEMPLATES} from "./research-templates";
import {inspectSchema,reorder,cleanAnswers,cloneQuestion,validatePage} from "./research-schema";
describe("Research builder",()=>{
 it("ships useful valid templates for five natures",()=>{
  expect(RESEARCH_TEMPLATES).toHaveLength(13);
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
});