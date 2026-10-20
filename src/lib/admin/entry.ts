import { parseAdminScope, type AdminScope } from "@/lib/admin/access";
import { getDepartmentHome } from "@/lib/admin/module-navigation";
import { DEPARTMENTS } from "@/lib/admin/departments";
import { supabase } from "@/integrations/supabase/client";

/** Navigation hints only. All administrative data and routes stay guarded server-side. */
export type AdminEntryRoute =
  | "/admin"
  | "/admin/executivo"
  | "/admin/tecnologia"
  | "/admin/operacoes"
  | "/admin/crescimento"
  | "/admin/inteligencia-pesquisa"
  | "/admin/parcerias"
  | "/admin/atendimento"
  | "/admin/financeiro"
  | "/admin/compliance";

const MODE_KEY = "caronaa.admin.app-preview.v1";
type AppPreview = { userId: string; returnTo: AdminEntryRoute };

export function preferredAdminEntry(scope: AdminScope): AdminEntryRoute | null {
  if (scope.isGlobalAdmin) return "/admin";
  for (const department of DEPARTMENTS) {
    if (scope.departments.some(grant => grant.id === department.id)) {
      return getDepartmentHome(department.id) as AdminEntryRoute;
    }
  }
  return null;
}

/**
 * Preserve an intentional deep link while choosing the verified role's home
 * for ordinary sign-in. /admin belongs only to authorized administrators;
 * a departmental grant never implies access to the global overview.
 */
export function authenticatedLanding(
  requested: string,
  adminHome: AdminEntryRoute | null,
): string {
  if (requested === "/home" || requested === "/home/" || requested === "/auth") {
    return adminHome ?? "/home";
  }
  if (requested === "/admin" || requested === "/admin/") {
    return adminHome ?? "/home";
  }
  if (requested.startsWith("/admin/") && !adminHome) {
    return "/home";
  }
  return requested;
}

/** Uses the authenticated user's server-calculated scope, never profile metadata. */
export async function getMyAdminEntry(): Promise<AdminEntryRoute | null> {
  const { data, error } = await supabase.rpc("get_my_admin_scope" as never);
  if (error) throw new Error("Não foi possível verificar as permissões da sua conta.");
  return preferredAdminEntry(parseAdminScope(data));
}

/** A short-lived, per-tab UI preference — NOT a permission or role grant. */
export function enterAdminAppPreview(userId: string, returnTo: AdminEntryRoute): void {
  if (!userId || !returnTo.startsWith("/admin")) return;
  try {
    sessionStorage.setItem(MODE_KEY, JSON.stringify({ userId, returnTo } satisfies AppPreview));
  } catch {
    // Blocked browser storage: fallback is the normal role-aware dashboard.
  }
}
export function getAdminAppPreview(userId: string | undefined): AppPreview | null {
  if (!userId) return null;
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(MODE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return null;
    const value = stored as Record<string, unknown>;
    const allowed = [
      "/admin", ...DEPARTMENTS.map(department => getDepartmentHome(department.id)),
    ];
    if (value.userId !== userId || typeof value.returnTo !== "string" ||
        !allowed.includes(value.returnTo)) return null;
    return { userId, returnTo: value.returnTo as AdminEntryRoute };
  } catch {
    return null;
  }
}
export function leaveAdminAppPreview(): void {
  try { sessionStorage.removeItem(MODE_KEY); } catch { /* storage unavailable */ }
}
