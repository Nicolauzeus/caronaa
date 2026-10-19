import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("UNIFOR prelaunch backend contract",()=>{
 const sql=readFileSync(resolve(process.cwd(),"drizzle/migrations/0101_unifor_prelaunch_pilot.sql"),"utf8");
 it("uses an immutable form UUID and Fortaleza timezone, never mutable campaign title",()=>{
   expect(sql).toContain("8eaec446-057b-430a-9ccf-3b3652cb9618");
   expect(sql).toContain("2026-11-04 00:00:00-03");
 });
 it("permits authenticated users to read previews but not mutate them",()=>{
   expect(sql).toContain("GRANT SELECT ON public.unifor_prelaunch_intents TO authenticated");
   expect(sql).toContain("FOR SELECT TO authenticated USING (user_id=auth.uid())");
   expect(sql).toContain("REVOKE ALL ON TABLE public.unifor_prelaunch_intents");
   expect(sql).not.toContain("GRANT INSERT ON public.unifor_prelaunch_intents");
 });
 it("guards ride writes in PostgreSQL, not only by hiding interface buttons",()=>{
   for(const name of ["ride_requests","ride_offers","ride_routines","ride_matches","rides"])
     expect(sql).toContain("'"+name+"'");
   expect(sql).toContain("BEFORE INSERT OR UPDATE OR DELETE");
   expect(sql).toContain("public.is_unifor_prelaunch_locked(auth.uid())");
 });
 it("does not convert a research response into a live ride or booking",()=>{
   expect(sql).toContain("VISUALIZACAO");
   expect(sql).not.toContain("INSERT INTO public.ride_requests");
   expect(sql).not.toContain("INSERT INTO public.ride_offers");
 });
});
