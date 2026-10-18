import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "./departments";
import {
  findActiveModule,
  getDepartmentHome,
  getDepartmentOfPath,
  getModules,
} from "./module-navigation";
describe("Admin department navigation", () => {
  it("has a unique real page for each department", () => {
    const urls = DEPARTMENTS.map((d) => getDepartmentHome(d.id));
    expect(urls).toHaveLength(9);
    expect(new Set(urls).size).toBe(9);
    expect(urls.every((url) => getDepartmentOfPath(url) !== null)).toBe(true);
  });
  it("recognizes the most specific research route", () => {
    expect(getDepartmentOfPath("/admin/formularios/respostas")).toBe("research");
    expect(getDepartmentOfPath("/admin/operacoes")).toBe("operations");
    expect(getDepartmentOfPath("/admin")).toBeNull();
  });
  it("resolves shared routes to the selected section hash", () => {
    expect(findActiveModule("executive", "/admin/executivo", "#decisions")?.id).toBe("decisions");
    expect(findActiveModule("finance", "/admin/financeiro", "#transactions")?.id).toBe(
      "transactions",
    );
    expect(findActiveModule("safety", "/admin/atendimento", "#reports")?.id).toBe("reports");
    expect(findActiveModule("partnerships", "/admin/parcerias", "#pilots")?.id).toBe("pilots");
    expect(getModules("operations").some((x) => x.label === "Caronas")).toBe(true);
  });
  it("keeps the most specific module active in detail pages and aliases", () => {
    expect(findActiveModule("research", "/admin/formularios/respostas/", "rows")?.id).toBe(
      "answers",
    );
    expect(findActiveModule("research", "/admin/formularios/municipal", "editor")?.id).toBe(
      "forms",
    );
    expect(findActiveModule("growth", "/admin/usuarios/user-id", "")?.id).toBe("users");
    expect(findActiveModule("partnerships", "/admin/relacionamento", "")?.id).toBe("relations");
    expect(getDepartmentOfPath("/admin/relacionamento/")).toBe("partnerships");
    expect(findActiveModule("growth", "/admin/unknown", "")).toBeUndefined();
  });
  it("recognizes bookmarked department addresses without matching unrelated prefixes", () => {
    for (const department of DEPARTMENTS) {
      expect(getDepartmentOfPath(`/admin/departamentos/${department.id}/`)).toBe(department.id);
    }
    expect(getDepartmentOfPath("/admin/usuarios-fake")).toBeNull();
    expect(getDepartmentOfPath("/admin/departamentos/unknown")).toBeNull();
  });
});
