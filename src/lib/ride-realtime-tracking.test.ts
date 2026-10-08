import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateDistanceKm,
  estimateEtaMinutes,
  ridePositionSchema,
  rideSafetySchema,
  TRANSIT_STAGE_LABELS,
} from "./ride-safety";
import { createRideAlert } from "./notification-events";

const migration = readFileSync(
  "drizzle/migrations/0042_realtime_ride_tracking_and_stages.sql",
  "utf8",
);

describe("real-time ride tracking database contract (migration 0042)", () => {
  it("defines transit_stage with strict stage values on public.rides", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS transit_stage text NOT NULL DEFAULT 'CONFIRMED'");
    expect(migration).toContain("CHECK (transit_stage IN ('CONFIRMED', 'DRIVER_EN_ROUTE', 'AWAITING_BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))");
  });

  it("permits location updates during both CONFIRMED and IN_PROGRESS stages", () => {
    expect(migration).toContain("IF r.status NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN");
    expect(migration).toContain("Location sharing requires a confirmed or in progress ride");
  });

  it("enforces driver-only transit stage updates with passenger notification", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_ride_transit_stage");
    expect(migration).toContain("IF caller <> r.driver_user_id THEN");
    expect(migration).toContain("Only the driver can update transit stage");
    expect(migration).toContain("DRIVER_EN_ROUTE");
    expect(migration).toContain("DRIVER_ARRIVED");
  });

  it("provides immediate location revocation for user privacy", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.revoke_ride_location");
    expect(migration).toContain("DELETE FROM public.ride_locations");
    expect(migration).toContain("WHERE ride_id = p_ride_id AND user_id = auth.uid()");
  });

  it("enriches get_ride_safety with transitStage, routeDetails, and locations for participants", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_ride_safety");
    expect(migration).toContain("'transitStage', coalesce(r.transit_stage, r.status)");
    expect(migration).toContain("'routeDetails', jsonb_build_object(");
    expect(migration).toContain("auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id)");
  });

  it("cleans up locations immediately on ride completion or cancellation", () => {
    expect(migration).toContain("DELETE FROM public.ride_locations WHERE ride_id = p_ride_id");
  });
});

describe("distance, ETA calculation and position validation", () => {
  it("calculates accurate geographic distance between coordinates", () => {
    // Praça Portugal (-3.7358, -38.4988) até Shopping Iguatemi (-3.7554, -38.4889) ~ 2.4 km
    const dist = calculateDistanceKm(-3.7358, -38.4988, -3.7554, -38.4889);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(3.0);
  });

  it("estimates ETA in minutes based on urban average traffic speed", () => {
    const etaShort = estimateEtaMinutes(0.05);
    expect(etaShort).toBe(1);

    // 14 km a 28 km/h = 30 minutos
    const etaMedium = estimateEtaMinutes(14, 28);
    expect(etaMedium).toBe(30);
  });

  it("validates real position schemas and rejects out-of-range coordinates", () => {
    const valid = {
      latitude: -3.735,
      longitude: -38.5,
      accuracyM: 15,
      capturedAt: new Date().toISOString(),
    };
    expect(ridePositionSchema.parse(valid)).toEqual(valid);

    expect(ridePositionSchema.safeParse({ ...valid, latitude: -95 }).success).toBe(false);
    expect(ridePositionSchema.safeParse({ ...valid, longitude: 185 }).success).toBe(false);
    expect(ridePositionSchema.safeParse({ ...valid, accuracyM: -5 }).success).toBe(false);
  });

  it("validates rideSafetySchema with enriched transitStage and routeDetails", () => {
    const sample = {
      status: "CONFIRMED",
      transitStage: "DRIVER_EN_ROUTE" as const,
      driverUserId: "c9c2794c-813c-4ec7-9ff2-98e3b2e564d1",
      passengerUserId: "b1b2794c-813c-4ec7-9ff2-98e3b2e564d2",
      boardedAt: null,
      pin: "12345678",
      locations: [
        {
          userId: "c9c2794c-813c-4ec7-9ff2-98e3b2e564d1",
          latitude: -3.73,
          longitude: -38.5,
          accuracyM: 10,
          capturedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      routeDetails: {
        origin: "Aldeota",
        destination: "Benfica",
        originLat: -3.73,
        originLng: -38.5,
        destinationLat: -3.74,
        destinationLng: -38.53,
      },
      completionConfirmed: false,
      myRating: null,
      receivedRating: null,
      otherUserRating: { average: 4.8, count: 5 },
      myUserRating: { average: 5.0, count: 12 },
    };

    const parsed = rideSafetySchema.parse(sample);
    expect(parsed.transitStage).toBe("DRIVER_EN_ROUTE");
    expect(parsed.routeDetails?.origin).toBe("Aldeota");
    expect(parsed.locations).toHaveLength(1);
    expect(TRANSIT_STAGE_LABELS[parsed.transitStage!]).toBe("Motorista a caminho");
  });
});

describe("notifications for ride lifecycle and stage transitions", () => {
  const participants = {
    ride_id: "ride-123",
    driver_user_id: "driver-1",
    passenger_user_id: "passenger-1",
  };

  it("notifies passenger when driver starts heading to meeting point", () => {
    const alert = createRideAlert(
      "rides",
      "UPDATE",
      { ...participants, status: "CONFIRMED", transit_stage: "DRIVER_EN_ROUTE" },
      { status: "CONFIRMED", transit_stage: "CONFIRMED" },
      "passenger-1",
    );
    expect(alert).not.toBeNull();
    expect(alert?.title).toBe("Motorista a caminho");
    expect(alert?.description).toContain("ponto de encontro");
    expect(alert?.sound).toBe("confirmed");
  });

  it("notifies passenger when driver arrives at meeting point", () => {
    const alert = createRideAlert(
      "rides",
      "UPDATE",
      { ...participants, status: "CONFIRMED", transit_stage: "AWAITING_BOARDING" },
      { status: "CONFIRMED", transit_stage: "DRIVER_EN_ROUTE" },
      "passenger-1",
    );
    expect(alert).not.toBeNull();
    expect(alert?.title).toBe("Motorista no ponto de encontro");
    expect(alert?.description).toContain("embarque");
  });

  it("handles ride_notifications table events directly", () => {
    const bothAcceptedAlert = createRideAlert(
      "ride_notifications",
      "INSERT",
      {
        notification_id: "n-1",
        ride_id: "ride-123",
        user_id: "passenger-1",
        event_name: "BOTH_ACCEPTED",
      },
      {},
      "passenger-1",
    );
    expect(bothAcceptedAlert).not.toBeNull();
    expect(bothAcceptedAlert?.title).toBe("Carona confirmada por ambos");

    const driverArrivedAlert = createRideAlert(
      "ride_notifications",
      "INSERT",
      {
        notification_id: "n-2",
        ride_id: "ride-123",
        user_id: "passenger-1",
        event_name: "DRIVER_ARRIVED",
      },
      {},
      "passenger-1",
    );
    expect(driverArrivedAlert).not.toBeNull();
    expect(driverArrivedAlert?.title).toBe("Motorista no ponto de encontro");
  });

  it("does not alert non-participants about stage updates", () => {
    const alert = createRideAlert(
      "rides",
      "UPDATE",
      { ...participants, status: "CONFIRMED", transit_stage: "DRIVER_EN_ROUTE" },
      { status: "CONFIRMED", transit_stage: "CONFIRMED" },
      "outsider-999",
    );
    expect(alert).toBeNull();
  });
});

