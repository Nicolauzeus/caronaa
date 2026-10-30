import {describe,it,expect} from "vitest";
import {summarizeResearchHints} from "./research-suggestions";
describe("reaproveitamento seguro de pesquisas verificadas",()=>{
 it("identifica UNIFOR e perfil sem criar viagem",()=>{
  const result=summarizeResearchHints([{form_code:"UNIFOR_2026",institution:"UNIFOR",region:"Fortaleza",profile:"PASSAGEIRO",origin:"Centro",destination:"UNIFOR",outbound_time:"07:00"}]);
  expect(result.region).toBe("FORTALEZA");
  expect(result.role).toBe("PASSAGEIRO");
  expect(result.journey?.origin).toBe("Centro");
 });
 it("não seleciona automaticamente respostas conflitantes",()=>{
  const result=summarizeResearchHints([
   {form_code:"UNIFOR",institution:"UNIFOR",region:"Fortaleza",profile:"PASSAGEIRO",origin:null,destination:null,outbound_time:null},
   {form_code:"UNILAB",institution:"UNILAB",region:"Baturité",profile:"MOTORISTA",origin:null,destination:null,outbound_time:null},
  ]);
  expect(result.conflict).toBe(true);
  expect(result.region).toBeNull();
  expect(result.role).toBeNull();
 });
 it("suporta conta sem pesquisas",()=>{
  expect(summarizeResearchHints([])).toEqual({region:null,role:null,journey:null,sourceCount:0,conflict:false});
 });
});
