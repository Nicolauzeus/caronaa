import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const login = file("src/routes/auth.tsx");
const home = file("src/routes/_authenticated/home.tsx");
const launchGuard = file("src/routes/_authenticated/route.tsx");
const admin = file("src/components/admin/AdminShell.tsx");
const app = file("src/components/caronaa/AppShell.tsx");
const authProvider = file("src/lib/auth-context.tsx");

describe("Administrative first-entry navigation contract", () => {
  it("keeps the existing login and checks admin scope before showing the ordinary home", () => {
    expect(login).toContain('"/home"');
    expect(home).toContain("beforeLoad: async () =>");
    expect(home).toContain("getMyAdminEntry()");
    expect(home).toContain("getAdminAppPreview(data.user.id)");
    expect(home).toContain("throw redirect({ to: destination");
  });
  it("preserves institutional prelaunch restrictions and server-side administrative authorization", () => {
    expect(launchGuard).toContain("getMyResearchLaunchState()");
    expect(launchGuard).toContain('to: "/aguardando"');
    expect(file("src/components/admin/AdminGuard.tsx")).toContain("getAdminAccess");
    expect(file("src/components/admin/AdminGuard.tsx")).toContain("get_my_admin_scope");
  });
  it("provides explicit entry and exit from app preview in desktop and mobile", () => {
    expect(admin.match(/Visualizar aplicativo/g)?.length).toBeGreaterThanOrEqual(2);
    expect(admin).toContain("enterAdminAppPreview(user.id");
    expect(admin).toContain("Sair da conta");
    expect(app).toContain("getAdminAppPreview(user?.id)");
    expect(app).toContain("Painel administrativo");
    expect(app).toContain("leaveAdminAppPreview");
    expect(app).toContain("as ações realizadas no aplicativo continuam sendo reais");
  });
  it("clears the temporary preview selection on login and logout", () => {
    expect(authProvider).toContain('event === "SIGNED_IN" || event === "SIGNED_OUT"');
    expect(authProvider).toContain("leaveAdminAppPreview()");
  });
});
