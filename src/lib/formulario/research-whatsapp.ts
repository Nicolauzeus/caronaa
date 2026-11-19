import { supabase } from "@/integrations/supabase/client";

export { formatBrazilWhatsapp, validBrazilWhatsapp, normalizeBrazilWhatsapp } from "@/lib/contacts/brazil-whatsapp";
import { normalizeBrazilWhatsapp } from "@/lib/contacts/brazil-whatsapp";

const db = supabase as unknown as {
  rpc(name: string, args: Record<string, unknown>):
    PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

/** Record only after the server has saved the consented academic survey answer. */
export async function captureResearchWhatsapp(input: {
  formId: string; receipt: string; whatsapp: string;
  linkageConsent: boolean; contactConsent: boolean;
}): Promise<void> {
  const normalized = normalizeBrazilWhatsapp(input.whatsapp);
  if (!normalized) throw new Error("Informe um WhatsApp válido com DDD: (DDD) 9XXXX-XXXX.");
  if (!input.linkageConsent)
    throw new Error("Autorize vincular seu WhatsApp a esta participação.");
  const { data, error } = await db.rpc("capture_research_whatsapp", {
    p_form_id: input.formId,
    p_submission_key: input.receipt,
    p_whatsapp: normalized,
    p_linkage_consent: true,
    p_contact_consent: input.contactConsent,
  });
  if (error || !["captured", "already_captured"].includes(String(data)))
    throw new Error("Sua pesquisa foi salva, mas o WhatsApp não foi registrado. Verifique a conexão e tente novamente.");
}
