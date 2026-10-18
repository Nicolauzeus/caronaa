import { describe, it, expect } from "vitest";
import { DEPARTMENTS, DEPARTMENT_IDS, getDepartment, departmentPath } from "./departments";
describe("CARONAA department information architecture", () => {
  it("has nine uniquely identified departments", () => {
    expect(DEPARTMENTS).toHaveLength(9);
    expect(new Set(DEPARTMENT_IDS).size).toBe(9);
  });
  it("every category has a unique id within its department and meaningful description", () => {
    for (const d of DEPARTMENTS) {
      expect(d.categories.length).toBeGreaterThan(0);
      expect(new Set(d.categories.map((x) => x.id)).size).toBe(d.categories.length);
      for (const c of d.categories) {
        expect(c.description.length).toBeGreaterThan(12);
        if (c.phase === "existing") expect(c.route?.startsWith("/admin/")).toBe(true);
        else expect(c.route).toBeUndefined();
      }
    }
  });
  it("returns correct department path and rejects unknown departments", () => {
    for (const id of DEPARTMENT_IDS) {
      expect(getDepartment(id)?.id).toBe(id);
      expect(departmentPath(id)).toBe("/admin/departamentos/" + id);
    }
    expect(getDepartment("unknown")).toBeUndefined();
  });
  it("exposes only implemented financial reporting and keeps reconciliation planned", () => {
    expect(
      getDepartment("finance")
        ?.categories.filter((c) => c.phase === "existing")
        .map((c) => c.id),
    ).toEqual(["overview", "transactions"]);
    expect(getDepartment("finance")?.categories.find((c) => c.id === "payouts")?.phase).toBe(
      "planned",
    );
  });
});
