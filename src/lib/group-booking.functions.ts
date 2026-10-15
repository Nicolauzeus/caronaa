import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDrivingDistanceKm } from "./road-routing";
import { quoteGroupBooking } from "./group-booking";

const point = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
const request = z.object({
  pickup: point,
  passengers: z.array(z.object({
    destination: z.string().trim().min(1).max(160),
    dropoff: point,
  })).min(1).max(6),
});

/** Preview only: cannot reserve seats or create a payment. All road distances
 * and prices are computed on the server, not supplied by the browser.
 */
export const previewGroupBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => request.parse(input))
  .handler(async ({ data }) => {
    const distances = await Promise.all(data.passengers.map(async (passenger) => ({
      destination: passenger.destination,
      roadDistanceKm: await getDrivingDistanceKm(data.pickup, passenger.dropoff),
    })));
    return quoteGroupBooking(distances);
  });
