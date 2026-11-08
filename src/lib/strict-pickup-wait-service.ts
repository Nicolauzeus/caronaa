import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const waitSchema = z.object({
  strict: z.boolean(),
  arrivedAt: z.string().nullable(),
  status: z.string(),
  boarded: z.boolean(),
  canMarkNoShow: z.boolean(),
});
export type StrictPickupWait = z.infer<typeof waitSchema>;

export async function getStrictPickupWait(rideId: string): Promise<StrictPickupWait> {
  const client = supabase as unknown as {
    rpc(name: string, args: Record<string, string>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("get_strict_pickup_wait", { p_ride_id: rideId });
  if (error) throw new Error("Não foi possível verificar a espera. Tente novamente.");
  return waitSchema.parse(data);
}

export async function markStrictPickupNoShow(rideId: string): Promise<void> {
  const client = supabase as unknown as {
    rpc(name: string, args: Record<string, string>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("mark_strict_pickup_no_show", { p_ride_id: rideId });
  if (error || data !== "NO_SHOW")
    throw new Error("Não foi possível registrar a ausência. Atualize a viagem e confira a tolerância.");
}
