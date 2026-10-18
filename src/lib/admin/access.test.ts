import { describe, expect, it } from "vitest";
import { EMPTY_ADMIN_SCOPE, hasDepartmentAccess, parseAdminScope } from "@/lib/admin/access";

describe("Departmental authorization metadata", () => {
  it("rejects missing and malformed grants", () => {
    expect(parseAdminScope(null)).toEqual(EMPTY_ADMIN_SCOPE);
    expect(parseAdminScope({ departments: [{ id: "finance", can_write: "true" }, { id: "admin", can_write: true }] }))
      .toEqual({ isGlobalAdmin: false, departments: [{ id: "finance", canWrite: false }] });
  });
  it("does not escalate read-only grants", () => {
    const scope = parseAdminScope({ departments: [{ id: "technology", can_write: false }] });
    expect(hasDepartmentAccess(scope, "technology")).toBe(true);
    expect(hasDepartmentAccess(scope, "technology", true)).toBe(false);
    expect(hasDepartmentAccess(scope, "finance")).toBe(false);
  });
  it("grants all department actions to verified global admins", () => {
    expect(hasDepartmentAccess({ isGlobalAdmin: true, departments: [] }, "research", true)).toBe(true);
  });
});
