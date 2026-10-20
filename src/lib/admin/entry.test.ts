import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enterAdminAppPreview, getAdminAppPreview, getMyAdminEntry, leaveAdminAppPreview,
  preferredAdminEntry,
} from "./entry";
import { parseAdminScope } from "./access";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.rpc },
}));

describe("Role-aware CARONAA landing and administrator preview mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("routes a verified global admin straight to the administrative dashboard", async () => {
    api.rpc.mockResolvedValue({ data: { is_global_admin: true, departments: [] }, error: null });
    await expect(getMyAdminEntry()).resolves.toBe("/admin");
    expect(api.rpc).toHaveBeenCalledWith("get_my_admin_scope");
  });

  it("routes a delegated administrator to an assigned workspace, not the global overview", async () => {
    api.rpc.mockResolvedValue({ data: {
      is_global_admin: false,
      departments: [{ id: "finance", can_write: false }, { id: "technology", can_write: true }],
    }, error: null });
    await expect(getMyAdminEntry()).resolves.toBe("/admin/tecnologia");
  });

  it("keeps regular passengers, drivers and moderators on the regular app", async () => {
    api.rpc.mockResolvedValue({ data: { is_global_admin: false, departments: [] }, error: null });
    await expect(getMyAdminEntry()).resolves.toBeNull();
    expect(preferredAdminEntry(parseAdminScope({ is_global_admin: "true", departments: [] }))).toBeNull();
    expect(preferredAdminEntry(parseAdminScope({ is_global_admin: false, departments: [{ id: "unknown", can_write: true }] }))).toBeNull();
  });

  it("fails closed if the database cannot verify role assignments", async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    await expect(getMyAdminEntry()).rejects.toThrow(/permissões/);
  });

  it("lets the same verified account temporarily preview the regular app and return", () => {
    expect(getAdminAppPreview("admin-1")).toBeNull();
    enterAdminAppPreview("admin-1", "/admin");
    expect(getAdminAppPreview("admin-1")).toEqual({ userId: "admin-1", returnTo: "/admin" });
    expect(getAdminAppPreview("another-account")).toBeNull();
    leaveAdminAppPreview();
    expect(getAdminAppPreview("admin-1")).toBeNull();
  });

  it("never considers arbitrary session storage or a spoofed role as permission", () => {
    sessionStorage.setItem("caronaa.admin.app-preview.v1",
      JSON.stringify({ userId: "admin-1", returnTo: "/admin/secret" }));
    expect(getAdminAppPreview("admin-1")).toBeNull();
    sessionStorage.setItem("caronaa.admin.app-preview.v1", "not json");
    expect(getAdminAppPreview("admin-1")).toBeNull();
  });

  it("preserves departmental return location for temporary app previews", () => {
    enterAdminAppPreview("admin-2", "/admin/financeiro");
    expect(getAdminAppPreview("admin-2")?.returnTo).toBe("/admin/financeiro");
  });
});
