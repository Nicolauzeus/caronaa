import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AdminUser } from "@/lib/admin.functions";
import { isRideRequestCompatibleWithOffer } from "@/lib/ride-matching";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type OperationData = {
  offers: Row<"ride_offers">[];
  requests: Row<"ride_requests">[];
  matches: Row<"ride_matches">[];
  rides: Row<"rides">[];
  history: { ride_id: string; created_at: string }[];
  users: AdminUser[];
  contacts: { id: string; phone: string | null; phoneConfirmed: boolean; disabled: boolean }[];
  forms: {
    submission_id: string;
    user_id: string | null;
    nome: string;
    email: string | null;
    whatsapp: string;
    tipo_usuario: string;
    created_at: string;
    destino_trajeto: string;
    vehicleType: string | null;
    availableSeats: string | null;
    driverPrice: string | null;
    raw_payload?: unknown;
    consentimento?: boolean;
  }[];
  reviews: {
    user_id: string;
    document_verified: boolean;
    vehicle_verified: boolean;
    evidence_note: string;
    reviewed_at: string;
  }[];
};

// These RPCs are introduced by migration 0025; keep the cast at the generated-type boundary.
const client = supabase as unknown as {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
export async function loadAdminOperations(): Promise<OperationData> {
  const { data, error } = await client.rpc("get_admin_operation_data");
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || !Array.isArray((data as OperationData).offers))
    throw new Error("Resposta administrativa invalida.");
  return data as OperationData;
}
export async function operateAdminRide(
  action: string,
  id: string,
  options: {
    offerId?: string | undefined;
    note?: string;
    document?: boolean;
    vehicle?: boolean;
  } = {},
) {
  const { error } = await client.rpc("admin_operate_ride", {
    p_action: action,
    p_id: id,
    p_offer_id: options.offerId ?? null,
    p_note: options.note ?? null,
    p_document: options.document ?? false,
    p_vehicle: options.vehicle ?? false,
  });
  if (error) throw new Error(error.message);
}

export function getMatchSuggestions(data: OperationData, now = Date.now()) {
  return data.requests
    .filter((r) => r.status === "open" && !data.matches.some((m) => m.request_id === r.request_id))
    .flatMap((request) =>
      data.offers
        .filter(
          (offer) =>
            offer.status === "available" &&
            (!request.target_offer_id || request.target_offer_id === offer.offer_id) &&
            new Date(`${request.ride_date}T${request.departure_time}-03:00`).getTime() >= now &&
            new Date(`${offer.ride_date}T${offer.departure_time}-03:00`).getTime() >= now &&
            isRideRequestCompatibleWithOffer({
              request: {
                origin: request.origin,
                destination: request.destination,
                originCoordinate: { lat: request.origin_lat, lng: request.origin_lng },
                destinationCoordinate: {
                  lat: request.destination_lat,
                  lng: request.destination_lng,
                },
                rideDate: request.ride_date,
                departureTime: request.departure_time,
                passengerCount: request.passenger_count,
                userId: request.user_id,
                timeToleranceMinutes: request.time_tolerance_minutes,
              },
              offer: {
                origin: offer.origin,
                destination: offer.destination,
                originCoordinate: { lat: offer.origin_lat, lng: offer.origin_lng },
                destinationCoordinate: { lat: offer.destination_lat, lng: offer.destination_lng },
                rideDate: offer.ride_date,
                departureTime: offer.departure_time,
                availableSeats: offer.available_seats,
                seatsRemaining: offer.seats_remaining,
                userId: offer.user_id,
              },
            }),
        )
        .map((offer) => ({ request, offer })),
    );
}

export function getOperationPeople(data: OperationData, driver: boolean) {
  const activity = driver ? data.offers : data.requests;
  const forms = data.forms.filter(
    (f) => f.tipo_usuario === "AMBOS" || f.tipo_usuario === (driver ? "MOTORISTA" : "PASSAGEIRO"),
  );
  const ids = new Set([
    ...activity.map((r) => r.user_id),
    ...forms.map((f) => f.user_id).filter(Boolean),
  ]);
  const registered = data.users
    .filter((u) => ids.has(u.id))
    .map((user) => {
      const form = forms.find((f) => f.user_id === user.id);
      const contact = data.contacts.find((c) => c.id === user.id);
      return {
        id: user.id,
        registered: true,
        name: user.fullName || form?.nome || user.email,
        email: user.email,
        avatar: user.avatarUrl,
        phone: contact?.phone || form?.whatsapp || "",
        createdAt: user.createdAt,
        status: contact?.disabled ? "DISABLED" : "ACTIVE",
        phoneConfirmed: contact?.phoneConfirmed ?? false,
        emailConfirmed: user.emailConfirmed,
        form,
        review: data.reviews.find((r) => r.user_id === user.id),
        completed: data.rides.filter(
          (r) =>
            r.status === "COMPLETED" &&
            (driver ? r.driver_user_id : r.passenger_user_id) === user.id,
        ).length,
        destinations:
          [
            ...new Set(activity.filter((r) => r.user_id === user.id).map((r) => r.destination)),
          ].join(", ") ||
          form?.destino_trajeto ||
          "",
      };
    });
  return [
    ...registered,
    ...forms
      .filter((f) => !f.user_id)
      .map((form) => ({
        id: form.submission_id,
        registered: false,
        name: form.nome,
        email: form.email || "",
        avatar: null,
        phone: form.whatsapp,
        createdAt: form.created_at,
        status: "FORM_ONLY",
        phoneConfirmed: false,
        emailConfirmed: false,
        form,
        review: undefined,
        completed: 0,
        destinations: form.destino_trajeto,
      })),
  ];
}
