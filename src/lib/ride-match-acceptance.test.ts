import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMatchProposalState } from "./ride-match-acceptance";

const migration = readFileSync(
  "drizzle/migrations/0041_bilateral_ride_match_acceptance.sql",
  "utf8",
);

describe("bilateral match acceptance", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  it("keeps a persisted match as a proposal until both sides accept", () => {
    expect(getMatchProposalState({ status: "MATCHED", role: "passenger", now })).toBe(
      "proposal-found",
    );
    expect(
      getMatchProposalState({
        status: "MATCHED",
        role: "passenger",
        passengerAcceptedAt: "2026-10-08T11:59:00.000Z",
        now,
      }),
    ).toBe("awaiting-other-participant");
    expect(
      getMatchProposalState({
        status: "MATCHED",
        role: "passenger",
        driverAcceptedAt: "2026-10-08T11:59:00.000Z",
        now,
      }),
    ).toBe("awaiting-your-response");
    expect(getMatchProposalState({ status: "CONFIRMED", role: "driver", now })).toBe(
      "accepted-by-both",
    );
  });

  it("does not allow a response after proposal expiry", () => {
    expect(
      getMatchProposalState({
        status: "MATCHED",
        role: "driver",
        responseExpiresAt: "2026-10-08T11:00:00.000Z",
        now,
      }),
    ).toBe("expired");
  });

  it("requires participant-bound server acceptance and expires/releases proposals", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.respond_to_ride_match");
    expect(migration).toContain("caller NOT IN (r.passenger_user_id, r.driver_user_id)");
    expect(migration).toContain("Use respond_to_ride_match so both participants must accept");
    expect(migration).toContain("CREATE FUNCTION public.expire_ride_match_proposals()");
    expect(migration).toContain("CREATE TRIGGER ride_release_cancelled_reservation");
    expect(migration).toContain("CREATE TRIGGER ride_match_retry_after_cancel");
  });

  it("persists one proposal notification per participant and blocks arbitrary writes", () => {
    expect(migration).toContain("UNIQUE (ride_id, user_id, event_name)");
    expect(migration).toContain("CREATE TRIGGER ride_match_proposed_notifications");
    expect(migration).toContain(
      "REVOKE ALL ON public.ride_notifications FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("CREATE FUNCTION public.mark_ride_notification_read");
  });

  it("keeps discovery and creation within both parties' time tolerances and retains ranked eligibility", () => {
    expect(migration).toContain("least(tolerance_mins, coalesce(time_tolerance_minutes, 15))");
    expect(migration).toContain(
      "least(coalesce(p_time_tolerance_minutes, 15), coalesce(o.time_tolerance_minutes, 15))",
    );
    expect(migration).toContain("public.travel_route_score(");
    expect(migration).toContain("public.distance_km(oolat, oolng, qolat, qolng)");
    expect(migration).toContain("'AND NOT EXISTS (SELECT 1 FROM public.ride_matches prior");
  });
});
