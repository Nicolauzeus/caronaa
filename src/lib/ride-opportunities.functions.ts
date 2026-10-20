import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rideMatchEvaluationSchema } from "./intelligent-match";

const opportunitySchema = z.object({
  requestId: z.string().uuid(),
  offerId: z.string().uuid(),
  role: z.enum(["driver", "passenger"]),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  passengerCount: z.number().int(),
  requestedAt: z.string(),
  fit: rideMatchEvaluationSchema,
});
export type RideOpportunity = z.infer<typeof opportunitySchema>;

// Keep new RPCs at a narrow boundary until connection types are regenerated.
type OpportunityClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
export const getRideOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ offerId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as OpportunityClient;
    const { data: rows, error } = await client.rpc("get_my_ride_opportunities", {
      p_offer_id: data.offerId,
    });
    if (error) throw new Error("Não foi possível carregar as oportunidades. Tente novamente.");
    return z.array(opportunitySchema).parse(rows);
  });

export const chooseRideOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        offerId: z.string().uuid(),
        expectedPickup: z.string().datetime({ offset: true }),
        consent: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as OpportunityClient;
    const { assessOpportunityRoadRoute } = await import("./opportunity-road-assessment");
    await assessOpportunityRoadRoute(client, context.userId, {
      offerId: data.offerId,
      requestId: data.requestId,
    });
    const { data: matchId, error } = await client.rpc("choose_ride_opportunity", {
      p_request_id: data.requestId,
      p_offer_id: data.offerId,
      p_expected_pickup: data.expectedPickup,
    });
    if (error)
      throw new Error("A oportunidade pode ter mudado ou ficado sem vagas. Atualize suas viagens.");
    return { matchId: z.string().uuid().parse(matchId) };
  });
