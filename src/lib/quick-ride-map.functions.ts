import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDrivingRoute } from "./road-routing";
import { sessionRequest } from "./session-request-cache";
const point = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
const mapSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  origin: point,
  destination: point,
  driver: point.extend({
    seenAt: z.string(),
    sampledAt: z.string().optional(),
    accuracyM: z.number().positive().optional(),
  }).nullable(),
});
const input = z.object({ rideId: z.string().uuid() });
async function readContext(client: any, rideId: string) {
  const { data, error } = await client.rpc("quick_ride_map_context", {
    p_id: rideId,
  });
  if (error)
    throw new Error(
      "Mapa da corrida indisponível. Verifique a migração 0136 e a autorização da viagem.",
    );
  const parsed = mapSchema.parse(data);
  if (!["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(parsed.status))
    parsed.driver = null;
  return parsed;
}
export const getQuickRideMapContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ context, data }) =>
    readContext(context.supabase, data.rideId),
  );
export const getQuickRideApproach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ context, data }) => {
    const ride = await readContext(context.supabase, data.rideId);
    if (!["ACCEPTED","ARRIVED"].includes(ride.status) || !ride.driver) return null;
    const driver = ride.driver;
    // One route per participant/ride/minute, not per GPS pulse or map movement.
    return sessionRequest(
      "quick-eta:" + context.userId + ":" + ride.id,
      async () => {
        try {
          const { googleActionFetch } = await import("./google-request.server");
          return await getDrivingRoute([driver, ride.origin], googleActionFetch(context.userId, "quote", "getQuickRideApproach"));
        } catch {
          return null;
        }
      },
      60_000,
    );
  });
