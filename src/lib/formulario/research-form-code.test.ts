import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkResearchFormCode,
  describeResearchCodeConflict,
  friendlyResearchCreationError,
  normalizeResearchFormCode,
  suggestResearchFormCode,
  validResearchFormCode,
} from "./research-form-code";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));

describe("Research form code uniqueness and UX", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes and validates an existing manually entered code", () => {
    expect(normalizeResearchFormCode("  unifor-2026  ")).toBe("UNIFOR-2026");
    expect(validResearchFormCode("  Unifor_2026 ")).toBe(true);
    expect(validResearchFormCode(" ")).toBe(false);
    expect(validResearchFormCode("a")).toBe(false);
    expect(validResearchFormCode("a".repeat(81))).toBe(false);
  });

  it("suggests a unique choice without replacing the administrator's input", () => {
    const existing = ["UNIFOR-2026", "UNIFOR-2026-2", "UNIFOR-2026-3"];
    expect(suggestResearchFormCode("UNIFOR-2026", existing, 2026)).toBe("UNIFOR-2026-4");
    expect(suggestResearchFormCode("Mobilidade Ceará", [], 2026)).toBe("MOBILIDADE-CEARA-2026");
    expect(suggestResearchFormCode(" ", [], 2026)).toBe("PESQUISA-2026");
  });

  it("checks archived/trashed codes by an admin-scoped server RPC", async () => {
    mock.rpc.mockResolvedValueOnce({
      data: { available: false, status: "ARQUIVADO", inTrash: true },
      error: null,
    });
    await expect(checkResearchFormCode(" teste-25 ")).resolves.toMatchObject({
      available: false, status: "ARQUIVADO", inTrash: true,
    });
    expect(mock.rpc).toHaveBeenCalledWith("get_research_form_code_availability", {
      p_code: "TESTE-25",
    });
  });

  it("provides specific conflict feedback rather than asking for migrations", () => {
    expect(friendlyResearchCreationError({
      code: "23505", message: 'duplicate key value violates unique constraint "research_forms_code_key"',
    })).toMatch(/código.*outra pesquisa/);
    expect(describeResearchCodeConflict("ARQUIVADO", true)).toMatch(/lixeira/);
    expect(describeResearchCodeConflict("ENCERRADO", false)).toMatch(/pesquisa histórica/);
    expect(friendlyResearchCreationError(new Error("Conexão indisponível"))).toBe("Conexão indisponível");
  });
});
