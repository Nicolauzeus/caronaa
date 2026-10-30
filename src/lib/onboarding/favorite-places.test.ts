import {describe,it,expect} from "vitest";
import {suggestOppositeDestination} from "./favorite-places";
const places = [
 {kind:"HOME" as const,label:"Casa",lat:-3.73,lng:-38.52},
 {kind:"SCHOOL_WORK" as const,label:"Universidade",lat:-3.76,lng:-38.48},
];
describe("sugestão Casa / Escola-Trabalho",()=>{
 it("sugere trabalho quando está em casa",()=>{
  expect(suggestOppositeDestination(places,{lat:-3.73,lng:-38.52,accuracy:15})?.to.kind).toBe("SCHOOL_WORK");
 });
 it("sugere casa quando está no trabalho",()=>{
  expect(suggestOppositeDestination(places,{lat:-3.76,lng:-38.48,accuracy:15})?.to.kind).toBe("HOME");
 });
 it("não adivinha com sinal impreciso",()=>{
  expect(suggestOppositeDestination(places,{lat:-3.73,lng:-38.52,accuracy:500})).toBeNull();
 });
 it("não adivinha fora dos locais",()=>{
  expect(suggestOppositeDestination(places,{lat:-3.70,lng:-38.55,accuracy:15})).toBeNull();
 });
 it("exige ambos os locais",()=>{
  expect(suggestOppositeDestination(places.slice(0,1),{lat:-3.73,lng:-38.52,accuracy:10})).toBeNull();
 });
});
