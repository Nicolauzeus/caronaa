import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
describe("F09 Pessoas — audited account-backed metrics",()=>{
 const sql=readFileSync("drizzle/migrations/0243_admin_operations_people_truth.sql","utf8");
 const ui=readFileSync("src/components/admin/OperationsPeopleDashboard.tsx","utf8");
 const route=readFileSync("src/routes/admin/operacoes.tsx","utf8");
 const legacy=readFileSync("src/components/admin/OperationPage.tsx","utf8");
 it("counts authenticated accounts with current roles instead of old forms and offers",()=>{
   expect(sql).toContain("FROM auth.users u");
   expect(sql).toContain("JOIN public.profiles p ON p.id=u.id");
   expect(sql).toContain("p.active_role IN ('MOTORISTA','PASSAGEIRO')");
   expect(sql).toContain("registered_drivers");
   expect(sql).toContain("registered_passengers");
   expect(sql).not.toContain("form_submissions");
   expect(sql).toContain("coalesce(qp.quick_requested,0)");
   expect(sql).toContain("coalesce(qd.quick_completed,0)");
   expect(sql).toContain("coalesce(sp.shared_completed,0)");
 });
 it("does not misrepresent document review, profile registration, or last login",()=>{
   expect(sql).toContain("professional_driver_authorizations a");
   expect(sql).toContain("a.approved");
   expect(sql).toContain("last_access_at");
   expect(sql).toContain("professional_presence pr");
   expect(sql).toContain("professional_driver_locations loc");
   expect(sql).toContain("auth_activity_30");
   expect(ui).toContain("Acessaram como passageiro");
   const roleSql=readFileSync("drizzle/migrations/0244_people_access_role_accurate.sql","utf8");
   expect(roleSql).toContain("GROUP BY user_id,role_at_access");
   expect(roleSql).toContain("d30.role_at_access=p.active_role");
   expect(ui).toContain("Ainda não medido");
   expect(ui).toContain("Cadastro não significa presença online ou atividade recente");
   expect(legacy).toContain("Recorte histórico F02:");
   expect(legacy).not.toContain('"Passageiros ativos"');
 });
 it("restricts private account/email data to admin, without GPS or phone in list",()=>{
   expect(sql).toContain("SECURITY DEFINER SET search_path=''");
   expect(sql).toContain("public.has_role(auth.uid(),'admin'");
   expect(sql).toContain("REVOKE ALL ON FUNCTION public.admin_operations_people_truth()");
   expect(sql).toContain("FROM PUBLIC,anon,authenticated");
   expect(sql).not.toContain("loc.lat AS");
   expect(sql).not.toContain("u.phone");
   expect(ui).not.toContain("phone");
 });
 it("opens the real motorist/passenger photo and preserves initials fallback",()=>{
   const photo=readFileSync("src/components/admin/ZoomablePersonPhoto.tsx","utf8");
   expect(ui).toContain('<ZoomablePersonPhoto name={person.display_name} src={person.avatar_url} size="md"/>');
   expect(legacy).toContain('<ZoomablePersonPhoto name={name} src={avatar} size="sm" />');
   expect(photo).toContain('aria-label={"Ampliar foto de " + name}');
   expect(photo).toContain('title={"Ampliar foto de " + name}');
   expect(photo).toContain('onClick={() => { setPreviewFailed(false); setOpen(true); }}');
   expect(photo).toContain('<Dialog open={open} onOpenChange={setOpen}>');
   expect(photo).toContain('alt={"Foto ampliada de " + name}');
   expect(photo).toContain('if (!isPhotoAvailable) return avatar');
   expect(photo).toContain('AvatarFallback');
   expect(photo).not.toContain("window.open");
 });
 it("shows full People dashboard with no internal list scrolling on mobile",()=>{
   expect(route).toContain("<OperationsPeopleDashboard kind={peopleTab}/>");
   expect(ui).toContain('rpc("admin_operations_people_truth")');
   expect(ui).toContain('lg:hidden');
   expect(ui).toContain('hidden min-w-0 overflow-hidden rounded-xl border lg:block');
   expect(ui).toContain("Último acesso medido");
   expect(ui).toContain("Solicitaram viagens");
   expect(ui).not.toContain("overflow-x-auto");
   expect(ui).not.toContain("max-h-[260px]");
   expect(ui).toContain("visible.slice(activePage*10,activePage*10+10)");
 });
});
