import { z } from "zod";

export const detailsSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu primeiro nome.").max(70).regex(/^\S+$/, "Use apenas o primeiro nome."),
  lastName: z.string().trim().min(2, "Informe seu último sobrenome.").max(70).regex(/^\S+$/, "Use apenas o último sobrenome."),
  whatsapp: z.string().transform(v => v.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, ""))
    .refine(v => /^[1-9][0-9]9[0-9]{8}$/.test(v), "Informe WhatsApp com DDD."),
  region: z.enum(["MACICO_BATURITE", "FORTALEZA"]),
  registrationNumber: z.string().trim().min(2, "Informe sua matrícula/registro.").max(80),
});
