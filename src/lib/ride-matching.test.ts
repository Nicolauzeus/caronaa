import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_GEOGRAPHIC_TOLERANCE_KM,
  areRideLocationsCompatible,
  calculateRideMatchScore,
  getRideMatchReasons,
  isRideRequestCompatibleWithOffer,
  type RideCompatibilityInput,
} from "./ride-matching";

const matchingMigration = readFileSync(
  "drizzle/migrations/0015_create_persisted_ride_matching.sql",
  "utf8",
);

const compatibleRide: RideCompatibilityInput = {
  request: {
    origin: " Aldeota ",
    destination: "Meireles",
    rideDate: "2026-10-04",
    departureTime: "08:30",
    passengerCount: 2,
    userId: "passenger-1",
  },
  offer: {
    origin: "aldeota",
    destination: " MEIRELES ",
    rideDate: "2026-10-04",
    departureTime: "08:30",
    availableSeats: 3,
    seatsRemaining: 2,
    userId: "driver-1",
  },
};

describe("ride compatibility", () => {
  it("ordena melhor uma rota e horário mais próximos sem transformar score em regra de aceite", () => {
    const close = calculateRideMatchScore(compatibleRide);
    const later = calculateRideMatchScore({
      ...compatibleRide,
      offer: { ...compatibleRide.offer, departureTime: "08:44" },
    });
    expect(close).toBeGreaterThan(later);
    expect(close).toBeLessThanOrEqual(100);
  });

  it("respeita o menor limite de horário entre a busca e a tolerância da oferta", () => {
    expect(
      isRideRequestCompatibleWithOffer(
        {
          ...compatibleRide,
          request: { ...compatibleRide.request, departureTime: "08:40" },
          offer: { ...compatibleRide.offer, timeToleranceMinutes: 5 },
        },
        { timeToleranceMinutes: 60 },
      ),
    ).toBe(false);
  });

  it("expõe razões legíveis e avisa quando o score depende de endereços sem coordenadas", () => {
    expect(getRideMatchReasons(compatibleRide)).toEqual([
      "Coordenadas ausentes; compatibilidade baseada nos endereços informados",
      "Horários compatíveis",
    ]);
    expect(getRideMatchReasons(compatibleRide, 3)).toContain(
      "Preferências de conversa ou música semelhantes",
    );
  });
  it("allows a persisted request when there are enough seats and the users differ", () => {
    expect(isRideRequestCompatibleWithOffer(compatibleRide)).toBe(true);
  });

  it("rejects insufficient or invalid remaining capacity", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, seatsRemaining: 1 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, seatsRemaining: 4 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, passengerCount: 1.5 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, passengerCount: 7 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, availableSeats: 7 },
      }),
    ).toBe(false);
  });

  it("rejects matching a user's own request to their offer", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, userId: "passenger-1" },
      }),
    ).toBe(false);
  });

  it("rejects an empty or identical route", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, origin: "  " },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, destination: "ALDEOTA" },
      }),
    ).toBe(false);
  });

  it("requires identical departure date as a separate requirement", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, rideDate: "2026-10-05" },
      }),
    ).toBe(false);
  });

  describe("temporal matching tolerance (configurable window)", () => {
    // Pedido base: 18:20
    const rideAt1820: RideCompatibilityInput = {
      ...compatibleRide,
      request: {
        ...compatibleRide.request,
        departureTime: "18:20",
      },
      offer: {
        ...compatibleRide.offer,
        departureTime: "18:20",
      },
    };

    it("aceita exatamente o mesmo horário", () => {
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:20" },
        }),
      ).toBe(true);
    });

    it("aceita ofertas dentro de ±15 min (padrão)", () => {
      // 18:20 com 18:15 (diff 5 min) e 18:30 (diff 10 min)
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:15" },
        }),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:30" },
        }),
      ).toBe(true);
    });

    it("aceita exatamente no limite de ±15 min (18:05 e 18:35)", () => {
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:05" },
        }),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:35" },
        }),
      ).toBe(true);
    });

    it("rejeita fora do limite de ±15 min (18:04 e 18:36)", () => {
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:04" },
        }),
      ).toBe(false);
      expect(
        isRideRequestCompatibleWithOffer({
          ...rideAt1820,
          offer: { ...rideAt1820.offer, departureTime: "18:36" },
        }),
      ).toBe(false);
    });

    it("respeita mudança de tolerância para ±5 min", () => {
      // No limite: 18:25 (diff 5) aceito; 18:26 (diff 6) rejeitado
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:25" },
          },
          { timeToleranceMinutes: 5 },
        ),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:26" },
          },
          { timeToleranceMinutes: 5 },
        ),
      ).toBe(false);
      // No limite inferior: 18:15 (diff 5) aceito; 18:14 (diff 6) rejeitado
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:15" },
          },
          { timeToleranceMinutes: 5 },
        ),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:14" },
          },
          { timeToleranceMinutes: 5 },
        ),
      ).toBe(false);
    });

    it("respeita mudança de tolerância para ±30 min", () => {
      // No limite: 18:50 (diff 30) aceito; 18:51 (diff 31) rejeitado
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:50" },
          },
          { timeToleranceMinutes: 30 },
        ),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "18:51" },
          },
          { timeToleranceMinutes: 30 },
        ),
      ).toBe(false);
    });

    it("respeita mudança de tolerância para ±60 min", () => {
      // No limite: 19:20 e 17:20 (diff 60) aceitos; 19:21 (diff 61) rejeitado
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "19:20" },
          },
          { timeToleranceMinutes: 60 },
        ),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "17:20" },
          },
          { timeToleranceMinutes: 60 },
        ),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(
          {
            ...rideAt1820,
            offer: { ...rideAt1820.offer, departureTime: "19:21" },
          },
          { timeToleranceMinutes: 60 },
        ),
      ).toBe(false);
    });
  });

  describe("geographic matching tolerance", () => {
    const aldeota = { lat: -3.7383, lng: -38.5026 };
    const nearbyAldeota = { lat: -3.739, lng: -38.501 };
    const meireles = { lat: -3.7275, lng: -38.4975 };
    const nearbyMeireles = { lat: -3.728, lng: -38.496 };
    const unifor = { lat: -3.7697, lng: -38.4777 };
    const edsonQueiroz = { lat: -3.7745, lng: -38.481 };
    const messejana = { lat: -3.8329, lng: -38.4965 };
    const caucaia = { lat: -3.7361, lng: -38.6531 };

    const geoRide = (
      requestOrigin: { lat: number; lng: number } | undefined,
      requestDestination: { lat: number; lng: number } | undefined,
      offerOrigin: { lat: number; lng: number } | undefined,
      offerDestination: { lat: number; lng: number } | undefined,
      labels = {
        requestOrigin: "Aldeota",
        requestDestination: "Meireles",
        offerOrigin: "Aldeota",
        offerDestination: "Meireles",
      },
    ): RideCompatibilityInput => ({
      request: {
        ...compatibleRide.request,
        origin: labels.requestOrigin,
        destination: labels.requestDestination,
        originCoordinate: requestOrigin,
        destinationCoordinate: requestDestination,
      },
      offer: {
        ...compatibleRide.offer,
        origin: labels.offerOrigin,
        destination: labels.offerDestination,
        originCoordinate: offerOrigin,
        destinationCoordinate: offerDestination,
      },
    });

    it("accepts the same origin and destination coordinates", () => {
      expect(isRideRequestCompatibleWithOffer(geoRide(aldeota, meireles, aldeota, meireles))).toBe(
        true,
      );
    });

    it("accepts a nearby origin with a different name inside the configured radius", () => {
      expect(
        isRideRequestCompatibleWithOffer(
          geoRide(nearbyAldeota, meireles, aldeota, meireles, {
            requestOrigin: "Rua perto da Aldeota",
            requestDestination: "Meireles",
            offerOrigin: "Aldeota",
            offerDestination: "Meireles",
          }),
        ),
      ).toBe(true);
    });

    it("accepts a nearby destination with a different name inside the configured radius", () => {
      expect(
        isRideRequestCompatibleWithOffer(
          geoRide(aldeota, nearbyMeireles, aldeota, meireles, {
            requestOrigin: "Aldeota",
            requestDestination: "Beira Mar",
            offerOrigin: "Aldeota",
            offerDestination: "Meireles",
          }),
        ),
      ).toBe(true);
    });

    it("accepts both endpoints nearby even when names differ", () => {
      expect(
        isRideRequestCompatibleWithOffer(
          geoRide(nearbyAldeota, edsonQueiroz, aldeota, unifor, {
            requestOrigin: "Joaquim Tavora",
            requestDestination: "Edson Queiroz",
            offerOrigin: "Aldeota",
            offerDestination: "UNIFOR",
          }),
        ),
      ).toBe(true);
    });

    it("rejects endpoints outside the configured radius", () => {
      expect(
        isRideRequestCompatibleWithOffer(geoRide(aldeota, meireles, aldeota, meireles), {
          originToleranceKm: 0.05,
        }),
      ).toBe(true);
      expect(
        isRideRequestCompatibleWithOffer(geoRide(nearbyAldeota, meireles, aldeota, meireles), {
          originToleranceKm: 0.05,
          routeToleranceKm: 0.05,
        }),
      ).toBe(false);
    });

    it("rejects a clearly incompatible route", () => {
      expect(
        isRideRequestCompatibleWithOffer(
          geoRide(messejana, caucaia, aldeota, edsonQueiroz, {
            requestOrigin: "Messejana",
            requestDestination: "Caucaia",
            offerOrigin: "Aldeota",
            offerDestination: "Edson Queiroz",
          }),
        ),
      ).toBe(false);
    });

    it("rejects travel in the opposite direction along the driver route", () => {
      expect(areRideLocationsCompatible(geoRide(meireles, aldeota, aldeota, meireles))).toBe(false);
    });

    it("rejects silent text fallback when only part of the coordinates are present", () => {
      expect(areRideLocationsCompatible(geoRide(aldeota, undefined, aldeota, meireles))).toBe(
        false,
      );
    });

    it("falls back explicitly to exact route text only when coordinates are absent", () => {
      expect(areRideLocationsCompatible(geoRide(undefined, undefined, undefined, undefined))).toBe(
        true,
      );
      expect(
        areRideLocationsCompatible(
          geoRide(undefined, undefined, undefined, undefined, {
            requestOrigin: "Aldeota",
            requestDestination: "Meireles",
            offerOrigin: "Aldeota",
            offerDestination: "UNIFOR",
          }),
        ),
      ).toBe(false);
    });

    it("uses a 2 km default geographic tolerance", () => {
      expect(DEFAULT_GEOGRAPHIC_TOLERANCE_KM).toBe(2);
    });
  });

  it("makes the persisted match insert the only idempotent source for MATCH_CREATED", () => {
    expect(matchingMigration).toMatch(
      /CREATE UNIQUE INDEX product_events_match_created_once_idx[\s\S]+?WHERE event_name = 'MATCH_CREATED'/,
    );
    expect(matchingMigration).toMatch(
      /CREATE TRIGGER ride_match_track_product_event\s+AFTER INSERT ON public\.ride_matches/,
    );
    expect(matchingMigration).toMatch(/event_name <> 'MATCH_CREATED'/);
    expect(matchingMigration).toMatch(
      /INSERT INTO public\.ride_matches[\s\S]+?ON CONFLICT \(request_id\) DO NOTHING/,
    );
  });

  it("garante suporte a tolerância temporal configurável na migração 0023", () => {
    const migration0023 = readFileSync(
      "drizzle/migrations/0023_flexible_time_tolerance_matching.sql",
      "utf8",
    );
    expect(migration0023).toContain("time_tolerance_minutes integer NOT NULL DEFAULT 15");
    expect(migration0023).toContain(
      "abs(extract(epoch from (departure_time - request_row.departure_time)) / 60) <= tolerance_mins",
    );
  });

  it("garante suporte a matching geográfico na migração 0024", () => {
    const migration0024 = readFileSync(
      "drizzle/migrations/0024_geographic_ride_matching.sql",
      "utf8",
    );
    expect(migration0024).toContain("ADD COLUMN IF NOT EXISTS origin_lat double precision");
    expect(migration0024).toContain(
      "CREATE OR REPLACE FUNCTION public.distance_point_to_segment_km",
    );
    expect(migration0024).toContain("CREATE OR REPLACE FUNCTION public.are_ride_routes_compatible");
    expect(migration0024).toContain("tolerance_km double precision DEFAULT 2");
  });
});
