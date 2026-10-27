import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildF01Draft } from "./f01-creation";
import { createResearchForm } from "./research-catalog";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  inserts: [] as Array<{ table: string; value: Record<string, unknown> }>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc, from: state.from },
}));

const formId = "11111111-1111-4111-8111-111111111111";
const input = () => buildF01Draft({
  modelKey: "F01_UNIVERSIDADE",
  name: "Instituição Campus",
  code: "TESTE-CAMPUS",
  title: "Pesquisa de mobilidade",
  region: "OUTRA",
  customRegion: "Interior de Pernambuco",
  customMunicipality: "Caruaru",
  institutionalEmailDomains: ["campus.exemplo.br"],
  startsOn: "2026-10-26",
  endsOn: "2026-12-04",
  launchOn: "2026-12-05",
});

describe("F01 research draft resiliency (server admin RLS still applies)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inserts.length = 0;
    state.rpc.mockImplementation(async (name: string) => {
      if (name === "create_scheduled_research_form")
        return { data: null, error: { code: "PGRST202", message: "Could not find function create_scheduled_research_form" } };
      if (name === "save_research_configuration") return { data: 1, error: null };
      if (name === "delete_empty_research_draft") return { data: true, error: null };
      return { data: null, error: { code: "42883", message: "Unknown function" } };
    });
    state.from.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({ data: [], error: null }),
      }),
      insert: (value: Record<string, unknown>) => {
        state.inserts.push({ table, value });
        return table === "research_forms"
          ? { select: () => ({ single: async () => ({ data: { id: formId }, error: null }) }) }
          : Promise.resolve({ error: null });
      },
    }));
  });

  it("uses a dynamic, authorization-preserving fallback with version and configuration", async () => {
    expect(await createResearchForm(input())).toBe(formId);
    expect(state.inserts.map(row => row.table)).toEqual(["research_forms", "research_form_versions"]);
    expect(state.inserts[0].value).toEqual(expect.objectContaining({
      code: "TESTE-CAMPUS",
      municipality: "Caruaru",
      survey_starts_on: "2026-10-26",
      survey_ends_on: "2026-12-04",
      caronaa_presence_on: "2026-12-05",
      status: "RASCUNHO",
      is_enabled: false,
    }));
    expect(state.inserts[1].value).toEqual(expect.objectContaining({
      form_id: formId,
      version_number: 1,
      schema_json: expect.objectContaining({ experience: "ACADEMIC_EXPRESS_F01_V2" }),
    }));
    expect(state.inserts[1].value).not.toHaveProperty("settings_json");
    expect(state.rpc).toHaveBeenCalledWith("save_research_configuration", expect.objectContaining({
      p_form_id: formId,
      p_expected_revision: 0,
      p_settings: expect.objectContaining({ institutionalEmailDomains: ["campus.exemplo.br"] }),
    }));
  });

  it("does not bypass an access-control error with direct writes", async () => {
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "admin only" } });
    await expect(createResearchForm(input())).rejects.toThrow("admin only");
    expect(state.inserts).toHaveLength(0);
  });

  it("fails closed when scheduled columns are not available", async () => {
    state.from.mockImplementationOnce(() => ({
      select: () => ({ limit: async () => ({ error: { code: "42703" } }) }),
    }));
    await expect(createResearchForm(input())).rejects.toThrow("migration 0110");
    expect(state.inserts).toHaveLength(0);
  });

  it("rolls back an uncommitted draft on version-insert error", async () => {
    state.from.mockImplementation((table: string) => ({
      select: () => ({ limit: async () => ({ error: null }) }),
      insert: (value: Record<string, unknown>) => {
        state.inserts.push({ table, value });
        return table === "research_forms"
          ? { select: () => ({ single: async () => ({ data: { id: formId }, error: null }) }) }
          : Promise.resolve({ error: { code: "22023", message: "invalid schema" } });
      },
    }));
    await expect(createResearchForm(input())).rejects.toThrow("invalid schema");
    expect(state.rpc).toHaveBeenCalledWith("delete_empty_research_draft", { p_form_id: formId });
  });
});
