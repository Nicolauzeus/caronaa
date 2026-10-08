import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRecentHomeDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [requests, offers] = await Promise.all([
      context.supabase
        .from("ride_requests")
        .select("destination,destination_lat,destination_lng,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(3),
      context.supabase
        .from("ride_offers")
        .select("destination,destination_lat,destination_lng,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    if (requests.error || offers.error) return [];
    const unique = new Map<string, NonNullable<typeof requests.data>[number]>();
    for (const row of [...(requests.data ?? []), ...(offers.data ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )) {
      if (!unique.has(row.destination)) unique.set(row.destination, row);
    }
    return [...unique.values()].slice(0, 3);
  });

export const getActiveHomeJourneys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [offers, requests, sources, rides] = await Promise.all([
      context.supabase
        .from("ride_offers")
        .select(
          "offer_id, origin, destination, ride_date, departure_time, status, origin_lat, origin_lng, destination_lat, destination_lng",
        )
        .eq("user_id", context.userId)
        .in("status", ["available", "full"])
        .gte("ride_date", today)
        .order("ride_date")
        .limit(10),
      context.supabase
        .from("ride_requests")
        .select(
          "request_id, origin, destination, ride_date, departure_time, status, origin_lat, origin_lng, destination_lat, destination_lng",
        )
        .eq("user_id", context.userId)
        .in("status", ["open", "matched"])
        .gte("ride_date", today)
        .order("ride_date")
        .limit(10),
      // Read-only ownership policy on the source linkage table.
      (context.supabase as import("@supabase/supabase-js").SupabaseClient)
        .from("form_ride_publications")
        .select("request_id,offer_id")
        .eq("user_id", context.userId),
      context.supabase
        .from("rides")
        .select(
          "ride_id,offer_id,request_id,status,ride_requests(origin,destination,ride_date,departure_time,origin_lat,origin_lng,destination_lat,destination_lng)",
        )
        .or(`passenger_user_id.eq.${context.userId},driver_user_id.eq.${context.userId}`)
        .in("status", ["CONFIRMED", "IN_PROGRESS"])
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
    if (offers.error || requests.error || rides.error)
      throw new Error(offers.error?.message || requests.error?.message || rides.error?.message);
    const sourceIds = new Set((sources.data ?? []).flatMap((s) => [s.request_id, s.offer_id]));
    const activeRideIds = new Set((rides.data ?? []).flatMap((r) => [r.request_id, r.offer_id]));
    return [
      ...(rides.data ?? []).flatMap((r) =>
        r.ride_requests
          ? [
              {
                ...r.ride_requests,
                id: r.ride_id,
                status: r.status,
                kind: "ride" as const,
                sts: sourceIds.has(r.request_id) || sourceIds.has(r.offer_id),
              },
            ]
          : [],
      ),
      ...(offers.data ?? []).map((r) => ({
        ...r,
        id: r.offer_id,
        kind: "offer" as const,
        sts: sourceIds.has(r.offer_id),
      })),
      ...(requests.data ?? []).map((r) => ({
        ...r,
        id: r.request_id,
        kind: "request" as const,
        sts: sourceIds.has(r.request_id),
      })),
    ]
      .filter(
        (r) =>
          (r.kind === "ride" || !activeRideIds.has(r.id)) &&
          (r.status === "IN_PROGRESS" ||
            new Date(`${r.ride_date}T${r.departure_time.slice(0, 8)}-03:00`).getTime() >
              Date.now()),
      )
      .sort(
        (a, b) =>
          Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS") ||
          `${a.ride_date} ${a.departure_time}`.localeCompare(`${b.ride_date} ${b.departure_time}`),
      );
  });
