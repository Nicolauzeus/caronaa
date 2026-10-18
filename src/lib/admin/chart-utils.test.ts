import {describe,it,expect} from "vitest";
import {rankChartRows,validChartRows,semanticMetricTone} from "./chart-utils";
describe("Admin chart utilities",()=>{
 it("does not mutate original series",()=>{
  const input=[{name:"B",value:2},{name:"A",value:8}];
  expect(rankChartRows(input).map(x=>x.name)).toEqual(["A","B"]);
  expect(input[0].name).toBe("B");
 });
 it("preserves real zeros but filters invalid values",()=>{
  expect(validChartRows([{name:"Zero",value:0},{name:"Inválido",value:NaN},{name:"Negativo",value:-1}])).toEqual([{name:"Zero",value:0}]);
 });
 it("uses meaning rather than high numbers for warning colors",()=>{
  expect(semanticMetricTone("Cancelamentos")).toBe("danger");
  expect(semanticMetricTone("Viagens concluídas")).toBe("success");
  expect(semanticMetricTone("Total de solicitações")).toBe("neutral");
 });
});