import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const waiting = readFileSync(resolve(process.cwd(),"src/routes/_authenticated/aguardando.tsx"),"utf8");
describe("Generic launch waiting room",()=>{
 it("uses institution-specific server state, never the old UNIFOR-only endpoint",()=>{
  expect(waiting).toContain("getMyResearchLaunchState");
  expect(waiting).not.toContain("getMyUniforLaunchState");
  expect(waiting).not.toContain("UNIFOR_LAUNCH_DAY");
  expect(waiting).toContain("state?.institution");
 });
 it("is read-only, full viewport and permits signing out",()=>{
  expect(waiting).toContain("h-[100dvh]");
  expect(waiting).toContain("overflow-hidden");
  expect(waiting).toContain("SOMENTE VISUALIZAÇÃO");
  expect(waiting).toContain("supabase.auth.signOut()");
  expect(waiting).not.toContain("createRideRequest(");
  expect(waiting).not.toContain("createRideOffer(");
 });
});
