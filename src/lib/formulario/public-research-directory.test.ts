import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAvailableResearchForms } from "@/lib/formulario/public-research-directory";

const api = vi.hoisted(() => ({
  getForms: vi.fn(),
  getVersions: vi.fn(),
  filterStatus: vi.fn(),
  filterEnabled: vi.fn(),
  filterTrashed: vi.fn(),
  filterPublished: vi.fn(),
  versionIds: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => {
  const forms = {
    select: () => forms,
    eq: (key: string, value: unknown) => { 
      if (key === "status") api.filterStatus(value);
      if (key === "is_enabled") api.filterEnabled(value);
      return forms;
    },
    is: (key: string, value: unknown) => { api.filterTrashed(key, value); return forms; },
    order: () => api.getForms(),
  };
  const versions = {
    select: () => versions,
    in: (field: string, ids: string[]) => { api.versionIds(field, ids); return versions; },
    not: (field: string, operator: string, value: null) => {
      api.filterPublished(field, operator, value);
      return api.getVersions();
    },
  };
  return { supabase: { from: (table: string) => table === "research_forms" ? forms : versions } };
});

const active = [
  { id: "1", code: "UNIFOR", title: "Mobilidade UNIFOR", nature: "EDUCACAO", municipality: "Fortaleza" },
  { id: "2", code: "EVENTO", title: "Carona na saída", nature: "EVENTO", municipality: null },
];

describe("Directory of public research forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getForms.mockResolvedValue({data:active,error:null});
    api.getVersions.mockResolvedValue({data:[{form_id:"1"},{form_id:"2"}],error:null});
  });

  it("lists only active, not trashed surveys with a published version", async () => {
    expect(await loadAvailableResearchForms()).toEqual(active);
    expect(api.filterStatus).toHaveBeenCalledWith("PUBLICADO");
    expect(api.filterEnabled).toHaveBeenCalledWith(true);
    expect(api.filterTrashed).toHaveBeenCalledWith("trashed_at",null);
    expect(api.versionIds).toHaveBeenCalledWith("form_id",["1","2"]);
    expect(api.filterPublished).toHaveBeenCalledWith("published_at","is",null);
  });

  it("excludes a survey without a published version", async () => {
    api.getVersions.mockResolvedValue({data:[{form_id:"1"}],error:null});
    expect(await loadAvailableResearchForms()).toEqual([active[0]]);
  });

  it("does not attempt version lookup when no forms are visible under RLS", async () => {
    api.getForms.mockResolvedValue({data:[],error:null});
    expect(await loadAvailableResearchForms()).toEqual([]);
    expect(api.getVersions).not.toHaveBeenCalled();
  });

  it("excludes malformed entries and repeated identifiers", async () => {
    api.getForms.mockResolvedValue({data:[
      active[0],active[0],
      {...active[1],title:"  "},
    ],error:null});
    expect(await loadAvailableResearchForms()).toEqual([active[0]]);
  });

  it("reports Supabase failures instead of showing an empty directory", async () => {
    api.getForms.mockResolvedValue({data:null,error:{message:"network"}});
    await expect(loadAvailableResearchForms()).rejects.toThrow(/consultar/);
    api.getForms.mockResolvedValue({data:active,error:null});
    api.getVersions.mockResolvedValue({data:null,error:{message:"RLS"}});
    await expect(loadAvailableResearchForms()).rejects.toThrow(/publicadas/);
  });
});
