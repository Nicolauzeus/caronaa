import { z } from "zod";

export function isValidBrazilianPhoneNumber(val: string): boolean {
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) return false;

  // Valid Brazilian DDDs (11-99)
  const ddd = parseInt(digits.slice(0, 2), 10);
  const validDdds = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
    44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
    79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  ];
  if (!validDdds.includes(ddd)) return false;

  // Reject all identical digits (e.g. 11111111111, 00000000000)
  if (/^(\d)\1+$/.test(digits)) return false;

  // If 11 digits (mobile), 9 must follow DDD (i.e. digit at index 2 is 9)
  if (digits.length === 11 && digits[2] !== "9") return false;

  return true;
}

export function formatBrazilianPhoneNumber(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export const pitchInterestSchema = z.enum(["INVESTIDOR", "PARCEIRO", "AMBOS"], {
  required_error: "Selecione como gostaria de acompanhar a CARONAA.",
});

export const investorUpdatePreferenceSchema = z.enum(
  ["DURANTE_VALIDACAO", "AVISO_TERMINO", "PRINCIPAIS_RESULTADOS", "CONVERSAR_DIRETO"],
  {
    required_error: "Selecione como prefere receber as atualizações de investidor.",
  },
);

export const institutionTypeSchema = z.enum(
  ["UNIVERSIDADE", "EMPRESA", "INSTITUICAO", "COMUNIDADE", "OUTRO"],
  {
    required_error: "Selecione o tipo de instituição.",
  },
);

export const partnershipTypeSchema = z.enum(
  ["TESTAR_INSTITUICAO", "APRESENTAR_SOLUCAO", "PILOTO", "OUTRO"],
  {
    required_error: "Selecione como gostaria de colaborar.",
  },
);

export const pitchFormSchema = z
  .object({
    interest: pitchInterestSchema,
    name: z
      .string({ required_error: "Informe seu nome completo." })
      .trim()
      .min(3, "Informe seu nome completo com pelo menos 3 letras.")
      .max(150, "O nome informado é muito longo."),
    whatsapp: z
      .string({ required_error: "Informe seu WhatsApp para contato." })
      .trim()
      .refine(
        (val) => isValidBrazilianPhoneNumber(val),
        "Informe um número de WhatsApp válido com DDD (ex: (85) 99999-9999).",
      ),
    phone: z.string().trim().max(30, "Número muito longo.").optional().or(z.literal("")),
    same_phone_whatsapp: z.boolean().default(true),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido (ex: seu.nome@empresa.com.br).")
      .optional()
      .or(z.literal("")),
    investor_update_preference: investorUpdatePreferenceSchema.optional(),
    institution_name: z.string().trim().max(200).optional().or(z.literal("")),
    institution_type: institutionTypeSchema.optional(),
    institution_address: z.string().trim().max(300).optional().or(z.literal("")),
    partnership_type: partnershipTypeSchema.optional(),
    partnership_type_custom: z.string().trim().max(300).optional().or(z.literal("")),
    message: z
      .string({
        required_error: "Por favor, compartilhe sua dúvida, sugestão ou observação.",
      })
      .trim()
      .min(3, "Por favor, escreva sua mensagem ou sugestão (mínimo 3 caracteres)."),
    consent_contact: z.boolean().refine((val) => val === true, {
      message: "É necessário concordar com o contato para prosseguirmos.",
    }),
    consent_newsletter: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // If phone is not same as whatsapp and not provided or invalid
    if (!data.same_phone_whatsapp) {
      if (!data.phone || !isValidBrazilianPhoneNumber(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phone"],
          message: "Informe um telefone válido com DDD (ex: (85) 3333-4444 ou celular).",
        });
      }
    }

    // If INVESTOR or BOTH
    if (data.interest === "INVESTIDOR" || data.interest === "AMBOS") {
      if (!data.investor_update_preference) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["investor_update_preference"],
          message: "Selecione como prefere receber atualizações de investidor.",
        });
      }
    }

    // If PARTNER or BOTH
    if (data.interest === "PARCEIRO" || data.interest === "AMBOS") {
      if (!data.institution_name || data.institution_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["institution_name"],
          message: "Informe o nome da instituição, empresa ou universidade.",
        });
      }
      if (!data.institution_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["institution_type"],
          message: "Selecione o tipo de instituição.",
        });
      }
      if (!data.partnership_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnership_type"],
          message: "Selecione como gostaria de colaborar.",
        });
      }
      if (
        data.partnership_type === "OUTRO" &&
        (!data.partnership_type_custom || data.partnership_type_custom.trim().length < 2)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnership_type_custom"],
          message: "Descreva brevemente o formato de parceria que você tem em mente.",
        });
      }
    }
  });

export type PitchFormValues = z.infer<typeof pitchFormSchema>;
