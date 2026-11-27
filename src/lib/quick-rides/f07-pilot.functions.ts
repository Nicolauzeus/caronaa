/** Retired endpoints kept fail-closed for older clients. Public F07 uses
 * normal server-issued professional access; no environment flag revives these.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function f07TestEnvironmentConfigured(): boolean {
  return false;
}

export const getF07PilotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    enabled: false,
  }));

export const activateF07PilotDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    vehicleType: z.enum(["CAR", "MOTO"]),
  }).parse(v))
  .handler(async () => {
    throw new Error("Ativação temporária encerrada. Confirme seus dados no cadastro profissional.");
  });
