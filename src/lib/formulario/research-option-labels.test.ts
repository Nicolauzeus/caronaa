import {describe,expect,it} from "vitest";
import {formatResearchOption,getRatingScaleContext} from "./research-option-labels";

describe("public survey answer presentation",()=>{
 it("translates historic codes while keeping original answer keys",()=>{
  expect(formatResearchOption("DOR_01")).toContain("transporte");
  expect(formatResearchOption("DOR_06")).toContain("Insegurança");
  expect(formatResearchOption("IDENTIFICACAO")).toContain("Identificação");
  expect(formatResearchOption("PRECO_ANTECIPADO")).toContain("preço");
  expect(formatResearchOption("NAO")).toBe("Não");
 });
 it("preserves readable custom answer labels",()=>{
  expect(formatResearchOption("Minha opção personalizada")).toBe("Minha opção personalizada");
  expect(formatResearchOption("TRANSPORTE_COLETIVO")).toBe("Transporte coletivo");
  expect(formatResearchOption("DOR_99")).toContain("DOR_99");
 });
 it("associates safety ratings with meaningful endpoints",()=>{
  const labels=getRatingScaleContext({id:"safety",label:"Quão seguro considera o trajeto atual?",type:"rating_1_5"});
  expect(labels).toMatchObject({low:"Muito inseguro",high:"Muito seguro",intent:"safety"});
 });
 it("does not incorrectly call unrelated scales safe or unsafe",()=>{
  const labels=getRatingScaleContext({id:"score",label:"Como avalia o transporte até o evento?",type:"rating_0_10"});
  expect(labels.intent).toBe("generic");
  expect(labels.high).toBe("Excelente");
 });
});