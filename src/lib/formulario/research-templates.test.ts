import {describe,it,expect} from "vitest";
import {MUNICIPAL_TEMPLATES} from "./research-templates";
describe("Municipal research templates",()=>{
 it("covers professionals residents and municipal management",()=>{
  expect(MUNICIPAL_TEMPLATES.map(t=>t.key)).toEqual(["PROFISSIONAIS","PASSAGEIROS","PREFEITURA"]);
 });
 it.each(MUNICIPAL_TEMPLATES)("has unique question identifiers in $key",({schema})=>{
  const questions=schema.sections.flatMap(s=>s.questions);
  expect(questions.length).toBeGreaterThan(0);
  expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);
  for(const q of questions){
   expect(q.label.trim().length).toBeGreaterThan(8);
   if(q.type.includes("choice"))expect(q.options.length).toBeGreaterThanOrEqual(2);
  }
 });
 it("asks professionals about real-time adoption and mobile connectivity",()=>{
  const q=MUNICIPAL_TEMPLATES[0].schema.sections.flatMap(s=>s.questions).map(q=>q.id);
  expect(q).toContain("adoption");expect(q).toContain("internet");
 });
 it("asks residents about waits and access",()=>{
  const q=MUNICIPAL_TEMPLATES[1].schema.sections.flatMap(s=>s.questions).map(q=>q.id);
  expect(q).toContain("wait_minutes");expect(q).toContain("availability");
 });
});
