import {describe,it,expect,vi,beforeEach} from "vitest";
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
import {isValidParticipationReceipt,storePendingParticipation,readPendingParticipations,removePendingParticipation} from "./research-participation";
beforeEach(()=>sessionStorage.clear());
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
 it("does not accept a form code as participation proof",()=>{
  expect(()=>storePendingParticipation("STS-2026")).toThrow("Recibo inválido");
 });
});