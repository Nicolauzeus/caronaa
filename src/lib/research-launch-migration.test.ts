import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const source=readFileSync(resolve(process.cwd(),"drizzle/migrations/0102_research_launch_waiting_gate.sql"),"utf8");
describe("Generic research launch migration security",()=>{
 it("binds pilot access to immutable form participation rather than arbitrary typed institution",()=>{
   expect(source).toContain("research_launch_participant");
   expect(source).toContain("research_participation_badges");
   expect(source).toContain("form_submission_account_links");
   expect(source).toContain("link.confirmed_at IS NOT NULL");
   expect(source).not.toContain("ILIKE '%UNIFOR%'");
 });
 it("gates all published active surveys with a future configured date",()=>{
   expect(source).toContain("research_configurations");
   expect(source).toContain("settings->>'launchDate'");
   expect(source).toContain("pg_timezone_names");
   expect(source).toContain("release.released_at IS NULL");
 });
 it("prevents direct ride mutations and keeps ordinary participants out of the release RPC",()=>{
   expect(source).toContain("public.is_research_launch_locked(auth.uid())");
   expect(source).toContain("REVOKE ALL ON FUNCTION public.set_research_launch_release");
   expect(source).toContain("role='admin'");
   for (const table of ["ride_requests","ride_offers","ride_routines","ride_matches","rides"])
    expect(source).toContain("'"+table+"'");
   expect(source).toContain("trg_unifor_prelaunch_guard");
 });
 it("logs manual release and resetting and keeps the intent read-only",()=>{
   expect(source).toContain("research_launch_release_audit");
   expect(source).toContain("RELOCK");
   expect(source).not.toContain("INSERT INTO public.ride_requests");
   expect(source).not.toContain("INSERT INTO public.ride_offers");
 });
});
