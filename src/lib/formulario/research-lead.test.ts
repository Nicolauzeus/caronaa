import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureResearchLead, getAdminResearchLeadMetrics, getAdminResearchLeads,
  normalizeResearchEmail, researchLeadCaptureEnabled, validResearchEmail,
} from "./research-lead";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: api.rpc } }));

describe("Protected research contact capture", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes without loosening the email identity", () => {
    expect(normalizeResearchEmail("  UsuArio@EXAMPLE.COM ")).toBe("usuario@example.com");
    expect(validResearchEmail(" Usuario@Example.Com ")).toBe(true);
    expect(validResearchEmail("outro")).toBe(false);
    expect(validResearchEmail("a".repeat(181)+"@test.com")).toBe(false);
  });

  it("only enables capture when a form-specific database policy is installed", async () => {
    api.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(researchLeadCaptureEnabled("form-id")).resolves.toBe(true);
    expect(api.rpc).toHaveBeenCalledWith("research_contact_capture_enabled", { p_form_id: "form-id" });
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: "Not found" } });
    await expect(researchLeadCaptureEnabled("form-id")).resolves.toBe(false);
  });

  it("registers a private lead without inferring consent to marketing", async () => {
    api.rpc.mockResolvedValue({ data: "captured", error: null });
    await captureResearchLead({
      formId: "f", receipt: "private", email: " Abc@Example.Com ",
      linkageConsent: true, marketingConsent: false,
    });
    expect(api.rpc).toHaveBeenCalledWith("capture_research_lead", {
      p_form_id: "f", p_submission_key: "private", p_email: "abc@example.com",
      p_linkage_consent: true, p_marketing_consent: false,
    });
  });

  it("rejects invalid contact and missing linkage consent before RPC", async () => {
    await expect(captureResearchLead({
      formId: "f", receipt: "r", email: "not-an-email",
      linkageConsent: true, marketingConsent: false,
    })).rejects.toThrow(/e-mail/);
    await expect(captureResearchLead({
      formId: "f", receipt: "r", email: "a@test.com",
      linkageConsent: false, marketingConsent: false,
    })).rejects.toThrow(/Confirme/);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("uses aggregate and paginated RPCs, never a truncated client total", async () => {
    api.rpc.mockResolvedValueOnce({
      data: { contacts: 875, withoutAccount: 600, pendingConfirmation: 75, confirmedAccounts: 200, marketingOptIn: 48 }, error: null,
    });
    const metrics = await getAdminResearchLeadMetrics();
    expect(metrics.contacts).toBe(875);
    api.rpc.mockResolvedValueOnce({ data: [
      { email: "a@test.com", total_count: 600, registration_status: "SEM_CADASTRO" },
    ], error: null });
    const page = await getAdminResearchLeads({ limit: 20, offset: 20, status: "SEM_CADASTRO" });
    expect(page.total).toBe(600);
    expect(page.rows).toHaveLength(1);
    expect(api.rpc).toHaveBeenCalledWith("get_admin_research_leads", {
      p_limit: 20, p_offset: 20, p_status: "SEM_CADASTRO",
      p_form_id: null, p_marketing_only: false,
    });
  });
});
