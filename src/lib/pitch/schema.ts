import { z } from "zod";

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
      .min(2, "O nome deve ter no mínimo 2 caracteres.")
      .max(150, "O nome é muito longo."),
    whatsapp: z
      .string({ required_error: "Informe seu WhatsApp para contato." })
      .trim()
      .min(8, "Informe um número de WhatsApp válido.")
      .max(30, "Número muito longo."),
    phone: z.string().trim().max(30, "Número muito longo.").optional().or(z.literal("")),
    same_phone_whatsapp: z.boolean().default(true),
    email: z.string().trim().email("Informe um e-mail válido.").optional().or(z.literal("")),
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
      .min(2, "Por favor, escreva uma breve mensagem ou sugestão."),
    consent_contact: z.boolean().refine((val) => val === true, {
      message: "É necessário concordar com o contato para prosseguirmos.",
    }),
    consent_newsletter: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // If phone is not same as whatsapp and not provided
    if (!data.same_phone_whatsapp && (!data.phone || data.phone.trim().length < 8)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Informe o telefone para ligação ou marque a opção de mesmo número.",
      });
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
