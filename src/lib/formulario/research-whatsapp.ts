import { supabase } from "@/integrations/supabase/client";

const BRAZIL_DDDS = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "),
);

function brazilMobileDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/** Apply the mobile mask without storing the phone in versioned survey answers. */
export function formatBrazilWhatsapp(value: string): string {
  const digits = brazilMobileDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return "(" + digits;
  if (digits.length <= 7) return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
  return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
}

export function validBrazilWhatsapp(value: string): boolean {
  const digits = brazilMobileDigits(value);
  return /^\d{11}$/.test(digits) && BRAZIL_DDDS.has(digits.slice(0, 2)) && digits[2] === "9";
}

export function normalizeBrazilWhatsapp(value: string): string | null {
  return validBrazilWhatsapp(value) ? "+55" + brazilMobileDigits(value) : null;
}

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
