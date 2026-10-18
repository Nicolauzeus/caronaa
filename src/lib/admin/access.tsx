import { createContext, useContext, type ReactNode } from "react";
import type { DepartmentId } from "./departments";

export type DepartmentGrant = { id: DepartmentId; canWrite: boolean };
export type AdminScope = { isGlobalAdmin: boolean; departments: DepartmentGrant[] };
export const EMPTY_ADMIN_SCOPE: AdminScope = { isGlobalAdmin: false, departments: [] };
const IDs = new Set<DepartmentId>(["technology","growth","partnerships","safety","finance","compliance"]);
export function parseAdminScope(value: unknown): AdminScope {
  if (!value || typeof value !== "object") return EMPTY_ADMIN_SCOPE;
  const item = value as Record<string, unknown>;
  const raw = Array.isArray(item.departments) ? item.departments : [];
  const departments: DepartmentGrant[] = raw.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const v = entry as Record<string, unknown>;
    if (typeof v.id !== "string" || !IDs.has(v.id as DepartmentId)) return [];
    return [{ id: v.id as DepartmentId, canWrite: v.can_write === true }];
  });
  return { isGlobalAdmin: item.is_global_admin === true, departments };
}
export function hasDepartmentAccess(scope: AdminScope, department: DepartmentId, write = false): boolean {
  if (scope.isGlobalAdmin) return true;
  return scope.departments.some((grant) => grant.id === department && (!write || grant.canWrite));
}
const Context = createContext<AdminScope>(EMPTY_ADMIN_SCOPE);
export function AdminAccessProvider({ value, children }: {value: AdminScope;children: ReactNode}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminAccess() { return useContext(Context); }
