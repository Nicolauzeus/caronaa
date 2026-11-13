/**
 * F07 test-only declarative professional approval. Two independent gates:
 * (1) private SERVER environment, (2) staging DB pilot control.
 * This must never be activated for public production visitors.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function f07TestEnvironmentConfigured(): boolean {
  return process.env["CARONAA_DEPLOY_ENV"] === "homologacao" &&
    process.env["CARONAA_F07_TEST_MODE"] === "enabled";
}

async function activePilotControl() {
  if (!f07TestEnvironmentConfigured()) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("caronaa_f07_pilot_control")
    .select("enabled,expires_at").eq("id", true).maybeSingle();
  return !error && data?.enabled === true &&
    Date.parse(String(data?.expires_at ?? "")) > Date.now();
}

export const getF07PilotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    enabled: await activePilotControl(),
  }));

export const activateF07PilotDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    vehicleType: z.enum(["CAR", "MOTO"]),
  }).parse(v))
  .handler(async ({ context, data }) => {
    if (!(await activePilotControl())) {
      throw new Error("A aprovação declaratória está restrita ao ambiente de homologação.");
    }
    // Never trust a browser-provided identity; the server-signed userId is the
    // only user identity sent to this service-role-only SQL function.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: expiresAt, error } = await (supabaseAdmin as any).rpc(
      "caronaa_f07_pilot_activate_driver", {
        p_user_id: context.userId,
        p_vehicle_type: data.vehicleType,
      },
    );
    if (error || typeof expiresAt !== "string") {
      throw new Error("Piloto indisponível: confirme o e-mail, verifique seus repasses e a migration 0143.");
    }
    return { approved: true as const, vehicleType: data.vehicleType, expiresAt };
  });
