import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRole = "admin" | "moderator" | "user";

export type AdminUserVerification = {
  id: string;
  type: "UNIFOR" | "STS_2026";
  status: "VERIFIED" | "REVOKED";
  source: "EMAIL_DOMAIN" | "EVENT_FORM" | "ADMIN";
  institutionName: string | null;
  verifiedEmail: string | null;
  sourceReferenceId: string | null;
  verifiedAt: string;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  emailConfirmed: boolean;
  avatarUrl: string | null;
  city: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  roles: AdminUserRole[];
  verifications: AdminUserVerification[];
};

function normalizeAdminUsers(value: unknown): AdminUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => {
      const roles = Array.isArray(item.roles)
        ? item.roles.filter(
            (role): role is AdminUserRole =>
              role === "admin" ||
              role === "moderator" ||
              role === "user",
          )
        : [];

      const verifications = Array.isArray(item.verifications)
        ? item.verifications
            .filter(
              (
                verification,
              ): verification is Record<string, unknown> =>
                typeof verification === "object" &&
                verification !== null,
            )
            .filter(
              (verification) =>
                verification.status === "VERIFIED" &&
                (verification.type === "UNIFOR" ||
                  verification.type === "STS_2026"),
            )
            .map(
              (verification): AdminUserVerification => ({
                id: String(verification.id ?? ""),
                type: verification.type as
                  | "UNIFOR"
                  | "STS_2026",
                status: "VERIFIED",
                source:
                  verification.source === "EMAIL_DOMAIN" ||
                  verification.source === "EVENT_FORM" ||
                  verification.source === "ADMIN"
                    ? verification.source
                    : "ADMIN",
                institutionName:
                  typeof verification.institutionName === "string"
                    ? verification.institutionName
                    : null,
                verifiedEmail:
                  typeof verification.verifiedEmail === "string"
                    ? verification.verifiedEmail
                    : null,
                sourceReferenceId:
                  typeof verification.sourceReferenceId === "string"
                    ? verification.sourceReferenceId
                    : null,
                verifiedAt:
                  typeof verification.verifiedAt === "string"
                    ? verification.verifiedAt
                    : "",
              }),
            )
        : [];

      return {
        id: String(item.id ?? ""),
        fullName:
          typeof item.fullName === "string"
            ? item.fullName
            : "",
        email:
          typeof item.email === "string"
            ? item.email
            : "",
        emailConfirmed: item.emailConfirmed === true,
        avatarUrl:
          typeof item.avatarUrl === "string"
            ? item.avatarUrl
            : null,
        city:
          typeof item.city === "string"
            ? item.city
            : null,
        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : "",
        lastSignInAt:
          typeof item.lastSignInAt === "string"
            ? item.lastSignInAt
            : null,
        roles,
        verifications,
      };
    })
    .filter((user) => user.id.length > 0);
}

async function assertAdmin(
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => PromiseLike<{
      data: unknown;
      error: {
        message?: string;
      } | null;
    }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    throw new Error(
      error.message || "Não foi possível validar o acesso administrativo.",
    );
  }

  if (data !== true) {
    throw new Error("Admin access required");
  }
}

export const getAdminAccess = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as any;

    const { data, error } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (error) {
      throw error;
    }

    return {
      isAdmin: data === true,
    };
  });

export const getAdminUsers = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as any;

    await assertAdmin(client, context.userId);

    const { data, error } = await client.rpc(
      "get_admin_users",
      {
        p_user_id: null,
      },
    );

    if (error) {
      throw new Error(
        error.message ||
          "Não foi possível carregar os usuários.",
      );
    }

    return normalizeAdminUsers(data);
  });