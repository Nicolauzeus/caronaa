import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p:string) => readFileSync(resolve(process.cwd(),p),"utf8");
const sql=read("drizzle/migrations/0108_research_launch_cohorts_profile_access.sql");
const route=read("src/routes/_authenticated/route.tsx");
const profile=read("src/routes/_authenticated/perfil.tsx");
const drawer=read("src/components/caronaa/MobileAccountDrawer.tsx");
const waiting=read("src/routes/_authenticated/aguardando.tsx");
const form=read("src/components/research/PublicResearchForm.tsx");

describe("Institutional cohort access regression",()=>{
 it("preserves accounts created before a form's first publication even if they answered later",()=>{
   expect(sql).toContain("u.created_at >= COALESCE(");
   expect(sql).toContain("MIN(v.published_at)");
   expect(sql).toContain("AND public.research_launch_participant(f.id,p_user)");
   expect(sql).toContain("research_launch_wait_eligible(f.id,p_user)");
   expect(sql).toContain("research_launch_wait_eligible(f.id,u)");
   expect(sql).toContain("public.is_research_launch_locked");
   expect(sql).toContain("public.get_my_research_launch_state");
   expect(sql).not.toMatch(/INSERT INTO public.research_participation_badges/);
   expect(sql).not.toMatch(/UPDATE auth.users/);
 });
 it("does not block ordinary authenticated mobility on an optional institutional campaign",()=>{
   expect(route).toContain("supabase.auth.getUser()");
   expect(route).toContain('to: "/auth"');
   expect(route).toContain("claimPendingParticipations()");
   expect(route).toContain("const onboarding = await readOnboarding()");
   expect(route).toContain('to: "/onboarding"');
   expect(route).not.toContain("getMyResearchLaunchState()");
   expect(route).not.toContain('to: "/aguardando"');
   expect(route).toContain("return { user: data.user, launchLocked: false }");
   expect(route).toContain('rpc("get_my_professional_access")');
   expect(route).toContain("approvedProfessional=access?.authorized === true");
   expect(route).toContain('throw redirect({to:"/disponibilidade-profissional",replace:true})');
   expect(drawer).toContain("prelaunchMode &&");
 });
 it("allows profile photos and account personalization during the wait",()=>{
   expect(waiting).toContain('to="/perfil"');
   expect(profile).toContain('from: "/_authenticated"');
   expect(profile).toContain('<AppShell prelaunchMode={launchLocked}>');
   expect(profile).not.toContain("<ProfileTravelPreferences />");
   expect(profile).not.toContain('to="/aguardando"');
   expect(profile).toContain("!launchLocked &&");
 });
 it("does not send every existing user to the waiting page when they complete a form",()=>{
   expect(form).toContain('<a href={user ? "/home"');
   expect(form).not.toContain('form.configuration?.settings.launchDate ? "/aguardando" : "/home"');
   expect(form).toContain('form.configuration?.settings.launchDate ? "/aguardando" : "/perfil"');
 });
});
