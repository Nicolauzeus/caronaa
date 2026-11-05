/**
 * Read-only Asaas credential verification. Never return credentials or provider account data
 * to the browser, even to an administrator. No payment is created by this function.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AsaasClient } from "@/lib/payments/asaas";

export type AsaasConnectionResult = {
  environment: "sandbox" | "production" | "not-configured";
  apiKeyConfigured: boolean;
  webhookTokenConfigured: boolean;
  chargesEnabled: boolean;
  accountStatus: "APPROVED" | "NOT_APPROVED" | "UNAVAILABLE" | "NOT_CHECKED";
  message: string;
};

export const checkAsaasConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AsaasConnectionResult> => {
    // The server-side database checks the role against auth.uid(); client hints are not trusted.
    const { data: allowed, error: accessError } = await context.supabase.rpc(
      "has_admin_department_access",
      { p_department: "finance", p_write: false },
    );
    if (accessError || allowed !== true) {
      throw new Error("Somente administradores financeiros podem verificar a conexão Asaas.");
    }

    const env = process.env["ASAAS_ENV"];
    const environment = env === "sandbox" || env === "production" ? env : "not-configured";
    const apiKey = process.env["ASAAS_API_KEY"];
    const webhookToken = process.env["ASAAS_WEBHOOK_AUTH_TOKEN"];

    const base: AsaasConnectionResult = {
      environment,
      apiKeyConfigured: Boolean(apiKey?.trim()),
      webhookTokenConfigured: Boolean(webhookToken && webhookToken.length >= 32),
      chargesEnabled: process.env["ASAAS_ENABLE_CHARGES"] === "true",
      accountStatus: "NOT_CHECKED",
      message: "",
    };
    if (environment === "not-configured") {
      return { ...base, message: "Configure ASAAS_ENV=production e salve a chave no backend." };
    }
    if (!apiKey?.trim()) {
      return { ...base, message: "A API Key não está cadastrada no ambiente de servidor." };
    }
    try {
      const status = await new AsaasClient(apiKey, environment).getAccountStatus();
      return {
        ...base,
        accountStatus: status.general === "APPROVED" ? "APPROVED" : "NOT_APPROVED",
        message: status.general === "APPROVED"
          ? "Credencial aceita pelo Asaas. Conta cadastrada como aprovada."
          : "Credencial aceita, mas a situação cadastral ainda exige verificação no Asaas.",
      };
    } catch (error) {
      // The adapter intentionally removes upstream response bodies, which can contain personal data.
      const message = error instanceof Error ? error.message : "";
      const authFailure = /HTTP (401|403)/.test(message);
      return {
        ...base, accountStatus: "UNAVAILABLE",
        message: authFailure
          ? "A credencial foi recusada ou não tem permissão para esta consulta. Confira o ambiente e a API Key."
          : "Não foi possível consultar o Asaas. Confira a disponibilidade e tente novamente.",
      };
    }
  });
