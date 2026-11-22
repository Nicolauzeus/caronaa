import { DEPARTMENTS, type DepartmentId } from "./departments";

export type AdminModule = { id: string; label: string; route: string; department: DepartmentId; hidden?: boolean };
export const adminModules: AdminModule[] = DEPARTMENTS.flatMap((department) =>
  department.categories
    .filter((category) => category.phase === "existing" && category.route)
    .map((category) => ({
      id: category.id,
      label: category.label,
      route: category.route!,
      department: department.id,
      hidden: category.hidden === true,
    })),
);
/** Canonical workspaces avoid sending Growth and Partnerships to the same old Relations page. */
const HOMES: Record<DepartmentId, string> = {
  executive: "/admin/executivo",
  technology: "/admin/tecnologia",
  operations: "/admin/operacoes",
  growth: "/admin/crescimento",
  research: "/admin/inteligencia-pesquisa",
  partnerships: "/admin/parcerias",
  safety: "/admin/atendimento",
  finance: "/admin/financeiro",
  compliance: "/admin/compliance",
};
export function getDepartmentHome(id: DepartmentId): string {
  return HOMES[id];
}
export function getDepartmentOfPath(pathname: string): DepartmentId | null {
  const path = pathname.replace(/\/$/, "") || "/";
  const legacyDepartment = path.match(/^\/admin\/departamentos\/([^/]+)$/)?.[1];
  if (legacyDepartment && DEPARTMENTS.some((department) => department.id === legacyDepartment))
    return legacyDepartment as DepartmentId;
  if (path === "/admin/relacionamento") return "partnerships";
  const matches = adminModules.filter(
    (item) => path === item.route || path.startsWith(item.route + "/"),
  );
  if (!matches.length) return null;
  matches.sort((a, b) => b.route.length - a.route.length);
  return matches[0].department;
}
export function getModules(id: DepartmentId) {
  return adminModules.filter((item) => item.department === id && !item.hidden);
}
export function normalizeModuleHash(hash: string): string {
  return hash.replace(/^#/, "");
}
export function findActiveModule(id: DepartmentId, pathname: string, hash: string) {
  const modules = getModules(id);
  const path = pathname.replace(/\/$/, "");
  if (id === "operations") {
    const legacy:Record<string,string>={
      "/admin/caronas":"journeys","/admin/solicitacoes":"journeys",
      "/admin/matching":"journeys","/admin/motoristas":"people",
      "/admin/passageiros":"people",
    };
    if(legacy[path])return modules.find(m=>m.id===legacy[path])??modules[0];
  }
  const key = normalizeModuleHash(hash);
  const canonical = path === "/admin/relacionamento" ? "/admin/relacionamentos" : path;
  const matches = modules
    .filter((m) => canonical === m.route || canonical.startsWith(m.route + "/"))
    .sort((a, b) => b.route.length - a.route.length);
  return matches.find((m) => m.id === key) ?? matches[0];
}
