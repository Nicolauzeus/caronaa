import { describe, expect, it } from "vitest";
import { getMatchSuggestions, getOperationPeople, type OperationData } from "./admin-operations";

const empty = (): OperationData => ({
  offers: [],
  requests: [],
  matches: [],
  rides: [],
  history: [],
  users: [],
  contacts: [],
  forms: [],
  reviews: [],
});
function compatibleData(): OperationData & {
  requests: [OperationData["requests"][number]];
  offers: [OperationData["offers"][number]];
} {
  return {
    ...empty(),
    requests: [
      {
        request_id: "request",
        idempotency_key: null,
        notes: null,
        pickup_lat: null,
        pickup_lng: null,
        pickup_point: null,
        travel_preferences: null,
        price: null,
        user_id: "passenger",
        origin: "Aldeota",
        destination: "Unifor",
        origin_lat: -3.735,
        origin_lng: -38.5,
        destination_lat: -3.77,
        destination_lng: -38.48,
        ride_date: "2030-01-01",
        departure_time: "08:00:00",
        passenger_count: 2,
        status: "open",
        target_offer_id: null,
        time_tolerance_minutes: 15,
        created_at: "2026-01-01",
        routine_id: null,
        routine_date: null,
        routine_override: false,
        routine_suppressed: false,
      },
    ],
    offers: [
      {
        offer_id: "offer",
        idempotency_key: null,
        meeting_lat: null,
        meeting_lng: null,
        meeting_point: null,
        notes: null,
        vehicle_description: null,
        travel_preferences: null,
        passenger_gender_preference: "ANY",
        total_price: 30,
        user_id: "driver",
        origin: "Meireles",
        destination: "Edson Queiroz",
        origin_lat: -3.736,
        origin_lng: -38.501,
        destination_lat: -3.771,
        destination_lng: -38.481,
        ride_date: "2030-01-01",
        departure_time: "08:10:00",
        available_seats: 3,
        seats_remaining: 3,
        status: "available",
        time_tolerance_minutes: 15,
        created_at: "2026-01-01",
        routine_id: null,
        routine_date: null,
        routine_override: false,
        routine_suppressed: false,
      },
    ],
  };
}
describe("administrative match suggestions", () => {
  it("shows an empty state for an empty database", () => {
    expect(getMatchSuggestions(empty())).toEqual([]);
    expect(getOperationPeople(empty(), true)).toEqual([]);
  });
  it("uses geographical compatibility with different names", () => {
    expect(getMatchSuggestions(compatibleData(), 0)).toHaveLength(1);
  });
  it.each(["capacity", "time", "past", "self", "cancelled", "target", "existing"])(
    "excludes %s conflicts",
    (conflict) => {
      const data = compatibleData();
      if (conflict === "capacity") data.offers[0].seats_remaining = 1;
      if (conflict === "time") data.offers[0].departure_time = "09:00:00";
      if (conflict === "past") data.offers[0].ride_date = "2000-01-01";
      if (conflict === "self") data.offers[0].user_id = "passenger";
      if (conflict === "cancelled") data.offers[0].status = "cancelled";
      if (conflict === "target") data.requests[0].target_offer_id = "other";
      if (conflict === "existing")
        data.matches.push({
          match_id: "existing",
          request_id: "request",
          offer_id: "offer",
          passenger_user_id: "passenger",
          driver_user_id: "driver",
          status: "cancelled",
          ride_id: null,
          created_at: "2026-01-01",
        });
      expect(getMatchSuggestions(data)).toEqual([]);
    },
  );
  it("does not create suggestions for incompatible coordinates despite identical text", () => {
    const data = compatibleData();
    data.offers[0].origin = data.requests[0].origin;
    data.offers[0].destination = data.requests[0].destination;
    data.offers[0].origin_lat = -4;
    data.offers[0].destination_lat = -4.1;
    expect(getMatchSuggestions(data, 0)).toEqual([]);
  });
});
describe("administrative people", () => {
  it("includes both-profile form leads without treating them as registered accounts", () => {
    const data = empty();
    data.forms.push({
      submission_id: "lead",
      user_id: null,
      nome: "Maria",
      email: "maria@example.com",
      whatsapp: "85999999999",
      tipo_usuario: "AMBOS",
      created_at: "2026-01-01",
      destino_trajeto: "Unifor",
      vehicleType: "CARRO_PROPRIO",
      availableSeats: "3",
      driverPrice: "10",
    });
    expect(getOperationPeople(data, true)[0]).toMatchObject({
      registered: false,
      status: "FORM_ONLY",
      completed: 0,
      name: "Maria",
    });
    expect(getOperationPeople(data, false)).toHaveLength(1);
  });
  it("counts only completed rides and keeps verification tied to reviewed documents", () => {
    const data = compatibleData();
    data.users.push({
      id: "driver",
      fullName: "Joao",
      email: "joao@example.com",
      emailConfirmed: true,
      avatarUrl: null,
      city: null,
      createdAt: "2026-01-01",
      lastSignInAt: null,
      roles: ["user"],
      verifications: [],
    });
    const ride = {
      ride_id: "ride",
      total_price: 30,
      passenger_contribution: 15,
      driver_accepted_at: "2026-01-01T00:00:00Z",
      passenger_accepted_at: "2026-01-01T00:00:00Z",
      response_expires_at: "2026-01-02T00:00:00Z",
      boarded_at: null,
      transit_stage: "CONFIRMED",
      match_id: "match",
      request_id: "request",
      offer_id: "offer",
      passenger_user_id: "passenger",
      driver_user_id: "driver",
      status: "CONFIRMED",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      completed_at: null,
    };
    data.rides.push(ride);
    expect(getOperationPeople(data, true)[0]?.completed).toBe(0);
    ride.status = "COMPLETED";
    expect(getOperationPeople(data, true)[0]?.completed).toBe(1);
    expect(getOperationPeople(data, true)[0]?.review).toBeUndefined();
  });
});
