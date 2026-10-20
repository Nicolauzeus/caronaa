import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
const client = supabase as unknown as {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const alertSchema = z.object({
  alert_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  read_at: z.string().nullable(),
  pickup_at: z.string(),
  difference_minutes: z.number().nullable(),
});
export async function syncOpportunityAlerts() {
  const { data, error } = await client.rpc("sync_my_ride_opportunity_alerts");
  if (error) throw new Error("Não foi possível atualizar os avisos de oportunidades.");
  return z.array(alertSchema).parse(data);
}
export async function markOpportunityAlertsRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await client.rpc("mark_ride_opportunity_alerts_read", { p_ids: ids });
  if (error) throw new Error("Não foi possível marcar os avisos como lidos.");
}
export async function setOpportunityAlerts(enabled?: boolean) {
  const { data, error } = await client.rpc("set_ride_opportunity_alerts", { p_enabled: enabled });
  if (error || typeof data !== "boolean")
    throw new Error("Não foi possível carregar ou salvar os avisos de oportunidades.");
  window.dispatchEvent(new Event("caronaa:opportunity-settings-updated"));
  return data;
}
