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
 it("keeps every linked campaign visible with its own timer and form identity",()=>{
  expect(waiting).toContain("launches.map((launch)");
  expect(waiting).toContain("launch.formCode");
  expect(waiting).toContain("launch.title");
  expect(waiting).toContain("<CircularLaunchCountdown launchAt={launch.launchAt} now={now} />");
  expect(waiting).toContain("!result.locked && result.launches.length === 0");
 });
 it("is read-only, full viewport and permits signing out",()=>{
  expect(waiting).toContain("h-[100dvh]");
  expect(waiting).not.toContain("overflow-hidden");
  expect(waiting).toContain('to="/perfil"');
  expect(waiting).toContain("Personalizar meu perfil");
  expect(waiting).toContain("SOMENTE VISUALIZAÇÃO");
  expect(waiting).toContain("supabase.auth.signOut()");
  expect(waiting).not.toContain("createRideRequest(");
  expect(waiting).not.toContain("createRideOffer(");
 });
});
