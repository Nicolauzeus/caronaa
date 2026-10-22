import {describe,it,expect,vi,beforeEach} from "vitest";
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
import {isValidParticipationReceipt,storePendingParticipation,readPendingParticipations,removePendingParticipation} from "./research-participation";
beforeEach(()=>{sessionStorage.clear();localStorage.clear();});
describe("survey participation receipt safety",()=>{
 it("requires a private v4 UUID rather than a visible form code or title",()=>{
  expect(isValidParticipationReceipt("TESTE-25")).toBe(false);
  expect(isValidParticipationReceipt("UNILAB")).toBe(false);
  expect(isValidParticipationReceipt("00000000-0000-0000-0000-000000000000")).toBe(false);
  expect(isValidParticipationReceipt("10975917-c190-4928-a466-5bd76959fd6f")).toBe(true);
 });
 it("deduplicates and clears opted-in pending receipts",()=>{
  const token="10975917-c190-4928-a466-5bd76959fd6f";
  storePendingParticipation(token);
  storePendingParticipation(token);
  expect(readPendingParticipations()).toEqual([token]);
  removePendingParticipation(token);
  expect(readPendingParticipations()).toEqual([]);
 });
 it("keeps a short-lived launch receipt across email-confirmation tabs",()=>{
  const token="10975917-c190-4928-a466-5bd76959fd6f";
  storePendingParticipation(token,true);
  sessionStorage.clear();
  expect(readPendingParticipations()).toEqual([token]);
  removePendingParticipation(token);
  expect(readPendingParticipations()).toEqual([]);
 });
 it("persists two distinct campaign receipts, and removing one leaves the other",()=>{
  const first="10975917-c190-4928-a466-5bd76959fd6f";
  const second="12d64e74-5c70-487a-9f1a-f7d59c07f8a0";
  storePendingParticipation(first,true);
  storePendingParticipation(second,true);
  sessionStorage.clear();
  expect(readPendingParticipations()).toEqual([first,second]);
  removePendingParticipation(first);
  expect(readPendingParticipations()).toEqual([second]);
 });
 it("does not accept an expired stored launch receipt",()=>{
  localStorage.setItem("caronaa.researchLaunch.pending.v1",JSON.stringify([
   {receipt:"10975917-c190-4928-a466-5bd76959fd6f",expires:Date.now()-1000}
  ]));
  expect(readPendingParticipations()).toEqual([]);
 });
 it("does not accept a form code as participation proof",()=>{
  expect(()=>storePendingParticipation("STS-2026")).toThrow("Recibo inválido");
 });
});