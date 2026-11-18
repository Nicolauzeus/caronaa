import { z } from "zod";

export const detailsSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu primeiro nome.").max(70).regex(/^\S+$/, "Use apenas o primeiro nome."),
  lastName: z.string().trim().min(2, "Informe seu último sobrenome.").max(70).regex(/^\S+$/, "Use apenas o último sobrenome."),
  whatsapp: z.string().transform(v => v.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, ""))
    .refine(v => /^[1-9][0-9]9[0-9]{8}$/.test(v), "Informe WhatsApp com DDD."),
  region: z.enum(["MACICO_BATURITE", "FORTALEZA"]),
  registrationNumber: z.string().trim().min(2, "Informe sua matrícula/registro.").max(80),
});

export const professionalPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const professionalPhotoMaxBytes = 5 * 1024 * 1024;

export type ProfessionalField = "firstName" | "lastName" | "whatsapp" | "region" | "registrationNumber" | "photo";
export type ProfessionalCorrections = Partial<Record<ProfessionalField, string>>;

type ProfessionalData = {
  firstName: string;
  lastName: string;
  whatsapp: string;
  region: string;
  registrationNumber: string;
  photo: { type: string; size: number } | null;
  photoUrl: string;
  userId: string;
};

export const professionalFieldLabels: Record<ProfessionalField, string> = {
  firstName: "Primeiro nome",
  lastName: "Último sobrenome",
  whatsapp: "WhatsApp com DDD",
  region: "Região",
  registrationNumber: "Matrícula / registro",
  photo: "Foto pessoal",
};

/** Client feedback only. The existing server RPC is authoritative. */
export function professionalFormCorrections(data: ProfessionalData): ProfessionalCorrections {
  const errors: ProfessionalCorrections = {};
  const parsed = detailsSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ProfessionalField;
      if (key in professionalFieldLabels && !errors[key]) errors[key] = issue.message;
    }
  }
  const isStoredPhoto = Boolean(data.photoUrl && data.userId &&
    data.photoUrl.includes("/avatars/" + data.userId + "/"));
  if (data.photo && (!professionalPhotoTypes.includes(data.photo.type as typeof professionalPhotoTypes[number]) ||
      data.photo.size > professionalPhotoMaxBytes || data.photo.size === 0)) {
    errors.photo = "Use uma foto JPG, PNG ou WebP de até 5 MB.";
  } else if (!data.photo && !isStoredPhoto) {
    errors.photo = "Adicione sua foto pessoal para concluir.";
  }
  return errors;
}

/** Translate the existing server-side missing codes into actionable fields. */
export function professionalServerCorrections(error: unknown): ProfessionalCorrections {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "") : "";
  const codes = /dados pendentes:\s*([A-Z_, ]+)/i.exec(message)?.[1]?.toUpperCase().split(",").map(x => x.trim()) ?? [];
  const errors: ProfessionalCorrections = {};
  if (codes.includes("FULL_NAME") || /primeiro nome|ultimo sobrenome/i.test(message)) {
    errors.firstName = "Confirme o primeiro nome e o último sobrenome.";
    errors.lastName = "Confirme o primeiro nome e o último sobrenome.";
  }
  if (codes.includes("PHOTO") || /foto de perfil|envie uma foto/i.test(message))
    errors.photo = "Adicione uma foto pessoal válida, armazenada no CARONAA.";
  if (codes.includes("WHATSAPP") || /WhatsApp invalido/i.test(message))
    errors.whatsapp = "Informe um WhatsApp válido com DDD.";
  if (codes.includes("REGION") || /Regiao invalida/i.test(message))
    errors.region = "Selecione sua região de atuação.";
  if (codes.includes("REGISTRATION") || /matricula\/registro/i.test(message))
    errors.registrationNumber = "Informe sua matrícula ou registro.";
  return errors;
}
