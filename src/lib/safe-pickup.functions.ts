import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getGoogleServerKey } from "./location/google-server-key";
import { getWalkingRoute, type RoadPoint } from "./road-routing";
import {
  chooseStrictPickup,
  metersBetween,
  projectOntoRoute,
  validCoordinate,
  type NearbyReference,
} from "./safe-pickup";
import { sessionRequest } from "./session-request-cache";
const input = z.object({ rideId: z.string().uuid() });

async function contextForRide(client: any, userId: string, rideId: string) {
  const { data: ride, error } = await client
    .from("rides")
    .select(
      "ride_id,offer_id,request_id,passenger_user_id,driver_user_id,status",
    )
    .eq("ride_id", rideId)
    .maybeSingle();
  if (
    error ||
    !ride ||
    ![ride.passenger_user_id, ride.driver_user_id].includes(userId)
  )
    throw new Error("Viagem indisponível para esta conta.");
  if (!["MATCHED", "CONFIRMED"].includes(ride.status)) return null;
  const [offerResult, requestResult] = await Promise.all([
    client
      .from("ride_offers")
      .select("allow_detours,route_path")
      .eq("offer_id", ride.offer_id)
      .maybeSingle(),
    client
      .from("ride_requests")
      .select("origin_lat,origin_lng")
      .eq("request_id", ride.request_id)
      .maybeSingle(),
  ]);
  if (offerResult.error || requestResult.error)
    throw new Error(
      "Preferência de trajeto indisponível. Verifique a migração 0136.",
    );
  const offer = offerResult.data,
    request = requestResult.data;
  if (!offer || offer.allow_detours !== false || !request) return null;
  if (request.origin_lat == null || request.origin_lng == null) return null;
  const passenger = {
    lat: Number(request.origin_lat),
    lng: Number(request.origin_lng),
  };
  const route = offer.route_path as RoadPoint[];
  if (!validCoordinate(passenger) || !Array.isArray(route)) return null;
  projectOntoRoute(passenger, route); // Validate stored geometry before any paid request.
  return { passenger, route };
}

export const getStrictPickupContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ context, data }) =>
    contextForRide(context.supabase, context.userId, data.rideId),
  );

export async function nearbyPickupReferences(
  point: RoadPoint,
  request: typeof fetch = fetch,
): Promise<NearbyReference[]> {
  const key = getGoogleServerKey();
  if (!key) return [];
  try {
    const response = await request(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location",
        },
        body: JSON.stringify({
          includedTypes: [
            "gas_station",
            "transit_station",
            "convenience_store",
            "shopping_mall",
            "parking",
          ],
          maxResultCount: 5,
          rankPreference: "DISTANCE",
          languageCode: "pt-BR",
          locationRestriction: {
            circle: {
              center: { latitude: point.lat, longitude: point.lng },
              radius: 400,
            },
          },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return [];
    const result = await response.json();
    if (!Array.isArray(result.places)) return [];
    return result.places.flatMap((place: any) => {
      const p = {
        lat: place.location?.latitude,
        lng: place.location?.longitude,
      };
      return typeof place.id === "string" &&
        typeof place.displayName?.text === "string" &&
        validCoordinate(p)
        ? [{ id: place.id, title: place.displayName.text, point: p }]
        : [];
    });
  } catch {
    return [];
  }
}

export const suggestStrictPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    input
      .extend({
        projection: z.object({
          lat: z.number().finite(),
          lng: z.number().finite(),
        }),
      })
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    // Authorize on every call, including cache hits. Never trust a submitted road line.
    const fixed = await contextForRide(
      context.supabase,
      context.userId,
      data.rideId,
    );
    if (!fixed) return null;
    const projection = projectOntoRoute(fixed.passenger, fixed.route).point;
    if (metersBetween(projection, data.projection) > 20)
      throw new Error("O trajeto mudou. Recalcule o ponto de encontro.");
    return sessionRequest(
      "strict-server:" +
        context.userId +
        ":" +
        data.rideId +
        ":" +
        JSON.stringify(projection),
      async () => {
        const references = await nearbyPickupReferences(projection);
        const pickup = chooseStrictPickup(projection, fixed.route, references);
        let walk = null;
        if (metersBetween(fixed.passenger, pickup.point) > 10) {
          try {
            walk = await getWalkingRoute([fixed.passenger, pickup.point]);
          } catch {
            /* No invented walking path on provider errors. */
          }
        }
        return { passenger: fixed.passenger, route: fixed.route, pickup, walk };
      },
    );
  });
