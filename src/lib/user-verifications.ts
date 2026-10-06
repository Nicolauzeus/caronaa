import { supabase } from "@/integrations/supabase/client";

export type UserVerificationType = "UNIFOR" | "STS_2026";

export type UserVerificationStatus = "VERIFIED" | "REVOKED";

export type UserVerificationSource = "EMAIL_DOMAIN" | "EVENT_FORM" | "ADMIN";

export type UserVerification = {
  id: string;
  user_id: string;
  type: UserVerificationType;
  status: UserVerificationStatus;
  source: UserVerificationSource;
  institution_name: string | null;
  verified_email: string | null;
  source_reference_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeVerificationEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const normalized = email.trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

export function isUniforEmail(email: string | null | undefined): boolean {
  const normalized = normalizeVerificationEmail(email);

  if (!normalized) return false;

  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1);

  return domain === "unifor.br" || domain === "edu.unifor.br";
}

export async function getMyUserVerifications(): Promise<UserVerification[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Não foi possível identificar o usuário autenticado: ${authError.message}`);
  }

  const user = authData.user;

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_verifications")
    .select(
      `
        id,
        user_id,
        type,
        status,
        source,
        institution_name,
        verified_email,
        source_reference_id,
        verified_at,
        created_at,
        updated_at
      `,
    )
    .eq("user_id", user.id)
    .eq("status", "VERIFIED")
    .order("verified_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(`Não foi possível carregar as verificações do usuário: ${error.message}`);
  }

  return (data ?? []) as UserVerification[];
}

export async function getUserVerifications(userId: string): Promise<UserVerification[]> {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_verifications")
    .select(
      `
        id,
        user_id,
        type,
        status,
        source,
        institution_name,
        verified_email,
        source_reference_id,
        verified_at,
        created_at,
        updated_at
      `,
    )
    .eq("user_id", userId)
    .eq("status", "VERIFIED")
    .order("verified_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(`Não foi possível carregar as verificações do usuário: ${error.message}`);
  }

  return (data ?? []) as UserVerification[];
}

export function hasVerification(
  verifications: UserVerification[],
  type: UserVerificationType,
): boolean {
  return verifications.some(
    (verification) => verification.type === type && verification.status === "VERIFIED",
  );
}

export function getVerificationLabel(type: UserVerificationType): string {
  switch (type) {
    case "UNIFOR":
      return "UNIFOR";

    case "STS_2026":
      return "STS 2026";

    default:
      return type;
  }
}

export function getVerificationDescription(type: UserVerificationType): string {
  switch (type) {
    case "UNIFOR":
      return "Vínculo UNIFOR identificado por e-mail institucional confirmado.";

    case "STS_2026":
      return "Participação registrada pelo formulário oficial do CARONAA no Siará Tech Summit 2026.";

    default:
      return "Verificação do usuário.";
  }
}
