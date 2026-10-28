import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  captureResearchWhatsapp, formatBrazilWhatsapp, normalizeBrazilWhatsapp, validBrazilWhatsapp,
} from "./research-whatsapp";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));

describe("WhatsApp brasileiro no formulário acadêmico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica máscara nacional e normaliza +55 sem perder DDD", () => {
    expect(formatBrazilWhatsapp("85")).toBe("(85");
    expect(formatBrazilWhatsapp("8599999")).toBe("(85) 99999");
    expect(formatBrazilWhatsapp("85999990000")).toBe("(85) 99999-0000");
    expect(formatBrazilWhatsapp("+55 85 99999-0000")).toBe("(85) 99999-0000");
    expect(normalizeBrazilWhatsapp("(85) 99999-0000")).toBe("+5585999990000");
  });

  it("exige DDD brasileiro válido e celular com nono dígito", () => {
    expect(validBrazilWhatsapp("(85) 99999-0000")).toBe(true);
    expect(validBrazilWhatsapp("+55 11 91234-5678")).toBe(true);
    expect(validBrazilWhatsapp("(85) 88888-0000")).toBe(false);
    expect(validBrazilWhatsapp("(00) 99999-0000")).toBe(false);
    expect(validBrazilWhatsapp("(20) 99999-0000")).toBe(false);
    expect(validBrazilWhatsapp("8599999000")).toBe(false);
    expect(validBrazilWhatsapp("(85) 99999-00000")).toBe(false);
    expect(normalizeBrazilWhatsapp("000")).toBeNull();
  });

  it("captura apenas com vínculo consentido e não autoriza contato por padrão", async () => {
    mock.rpc.mockResolvedValue({ data: "captured", error: null });
    await captureResearchWhatsapp({
      formId: "form", receipt: "receipt", whatsapp: "(85) 99999-0000",
      linkageConsent: true, contactConsent: false,
    });
    expect(mock.rpc).toHaveBeenCalledWith("capture_research_whatsapp", {
      p_form_id: "form", p_submission_key: "receipt", p_whatsapp: "+5585999990000",
      p_linkage_consent: true, p_contact_consent: false,
    });
  });

  it("bloqueia formato inválido ou falta de autorização antes da chamada", async () => {
    await expect(captureResearchWhatsapp({
      formId: "f", receipt: "r", whatsapp: "000", linkageConsent: true, contactConsent: false,
    })).rejects.toThrow(/WhatsApp válido/);
    await expect(captureResearchWhatsapp({
      formId: "f", receipt: "r", whatsapp: "(85) 99999-0000", linkageConsent: false, contactConsent: false,
    })).rejects.toThrow(/Autorize/);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("idempotência de envio e erro quando o CRM não grava", async () => {
    mock.rpc.mockResolvedValueOnce({ data: "already_captured", error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    const input = {
      formId: "f", receipt: "r", whatsapp: "(85) 99999-0000",
      linkageConsent: true, contactConsent: true,
    };
    await expect(captureResearchWhatsapp(input)).resolves.toBeUndefined();
    await expect(captureResearchWhatsapp(input)).rejects.toThrow(/não foi registrado/);
  });

  it("usa RPC protegido e mantém versões históricas intactas", () => {
    const sql = readFileSync("drizzle/migrations/0122_academic_whatsapp_crm.sql", "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.research_whatsapp_contacts");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.research_whatsapp_contacts");
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
    expect(sql).toContain("get_admin_research_crm_rows");
    expect(sql).toContain("whatsapp_contact_consent");
    expect(sql).toContain("ACADEMIC_EXPRESS_F01_V2");
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+public\.research_answers/i);
  });
});
