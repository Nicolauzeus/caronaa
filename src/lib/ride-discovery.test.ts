import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRideRequestCompatibleWithOffer } from "./ride-matching";
import { normalizeRideVerification } from "./ride-verifications";

const sql = readFileSync("drizzle/migrations/0019_secure_ride_offer_discovery.sql", "utf8");
const lifecycle = readFileSync(
  "drizzle/migrations/0016_ride_lifecycle_and_payment_model.sql",
  "utf8",
);
const functions = readFileSync("src/lib/rides.functions.ts", "utf8");
const originalMatching = readFileSync(
  "drizzle/migrations/0015_create_persisted_ride_matching.sql",
  "utf8",
);

function functionBody(source: string, name: string) {
  const body = source.match(
    new RegExp(
      `CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`,
    ),
  )?.[1];
  if (!body) throw new Error(`Missing SQL function ${name}`);
  return body;
}

// Evaluate the restricted temporal predicate extracted from SQL. This checks
// its zone/operator with deterministic times, but does not execute PostgreSQL.
function temporalPredicate(body: string, date: string, time: string, now: Date) {
  const match = body.match(
    /\((?:\w+\.)?ride_date \+ (?:\w+\.)?departure_time\) AT TIME ZONE '([^']+)' (>=|<) pg_catalog\.clock_timestamp\(\)/,
  );
  if (!match) throw new Error("Missing temporal guard");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: match[1],
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const wallNow = `${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"]}:${parts["minute"]}:${parts["second"]}`;
  const departure = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  return match[2] === ">=" ? departure >= wallNow : departure < wallNow;
}

describe("secure discovery migration contracts (not database integration)", () => {
  it("authenticates discovery and requests and restricts RPC privileges", () => {
    expect(sql).toContain("IF auth.uid() IS NULL");
    expect(sql).toContain("caller uuid := auth.uid()");
    expect(sql.match(/FROM PUBLIC, anon;/g)).toHaveLength(2);
    expect(sql.match(/TO authenticated;/g)).toHaveLength(2);
    expect(sql).toContain("SET search_path = ''");
  });
  it("excludes own, full and insufficient offers and filters before limiting", () => {
    expect(sql).toContain("o.user_id <> auth.uid()");
    expect(sql).toContain("o.status = 'available'");
    expect(sql).toContain("o.seats_remaining > 0 AND o.seats_remaining >= p_passenger_count");
    expect(sql.indexOf("strpos(lower(o.origin)")).toBeLessThan(sql.indexOf("LIMIT p_limit"));
  });
  it("exposes no private verification fields", () => {
    expect(sql).not.toMatch(/verified_email|source_reference_id/);
    expect(functions).not.toContain("source, institution_name, verified_email");
  });
  it("serializes allocation, deduplicates before checking availability and targets the chosen offer", () => {
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("FOR UPDATE"));
    expect(sql.indexOf("RETURN existing_request")).toBeLessThan(
      sql.indexOf("offer_row.status <> 'available'"),
    );
    expect(sql).toContain("public.try_match_ride_request(NEW.request_id, NEW.target_offer_id)");
    expect(sql).toContain("request_id = created_request AND offer_id = p_offer_id");
    expect(sql).toContain("offer_row.user_id = caller");
  });
  it("home and search share authenticated RPC discovery; request uses one RPC", () => {
    const discovery = functions.slice(
      functions.indexOf("async function discoverOffers"),
      functions.indexOf("export const getCurrentProfile"),
    );
    expect(discovery).not.toContain("getAdminClient");
    expect(discovery).toContain('discoveryClient.rpc("discover_ride_opportunities"');
    expect(discovery.match(/discoverOffers\(context.supabase/g)).toHaveLength(2);
    const requestStart = functions.indexOf("export const requestRideOffer");
    const profileStart = functions.indexOf("const rideParticipantProfileInput", requestStart);
    const request = functions.slice(
      requestStart,
      profileStart > requestStart ? profileStart : undefined,
    );
    // Modern priced segment requests require an authenticated quote and do not downgrade to legacy RPCs.
    expect(request).toContain('"request_intelligent_ride_segment"');
    expect(request).toContain("p_quote_id: data.quoteId");
    expect(request).not.toContain('client.rpc("request_available_ride_offer"');
    expect(request).not.toContain(".from(");
  });
  it("retains participant authorization and invalid status rejection", () => {
    expect(lifecycle).toContain(
      "caller NOT IN (ride_row.passenger_user_id, ride_row.driver_user_id)",
    );
    expect(lifecycle).toContain("IF NOT valid_transition THEN RAISE EXCEPTION");
  });
});

describe("temporal SQL rules with a fixed Fortaleza clock", () => {
  const now = new Date("2026-10-06T17:00:00Z"); // 14:00 in Fortaleza
  const discovery = functionBody(sql, "search_available_ride_offers");
  const direct = functionBody(sql, "request_available_ride_offer");
  const matching = functionBody(sql, "try_match_ride_request");
  const requestGuard = matching.slice(0, matching.indexOf("SELECT * INTO offer_row"));
  const offerGuard = matching.slice(matching.indexOf("SELECT * INTO offer_row"));

  it.each([
    ["past day", "2026-10-05", "15:00", false],
    ["future day", "2026-10-07", "13:00", true],
    ["past hour today", "2026-10-06", "13:00", false],
    ["future hour today", "2026-10-06", "15:00", true],
    ["exact departure", "2026-10-06", "14:00", true],
  ])("discovery and generic matching handle %s", (_label, date, time, eligible) => {
    expect(temporalPredicate(discovery, date, time, now)).toBe(eligible);
    expect(temporalPredicate(offerGuard, date, time, now)).toBe(eligible);
    expect(temporalPredicate(requestGuard, date, time, now)).toBe(eligible);
    expect(temporalPredicate(direct, date, time, now)).toBe(!eligible);
  });

  it("rejects direct expired requests before even returning an idempotent result", () => {
    expect(direct.indexOf("RAISE EXCEPTION 'Offer expired'")).toBeGreaterThan(
      direct.indexOf("FOR UPDATE"),
    );
    expect(direct.indexOf("RAISE EXCEPTION 'Offer expired'")).toBeLessThan(
      direct.indexOf("RETURN existing_request"),
    );
  });

  it("protects old requests reached through the new-offer trigger", () => {
    expect(requestGuard).toMatch(/status = 'open'\s+AND \(ride_date \+ departure_time\)/);
    expect(functionBody(originalMatching, "match_new_ride_offer")).toMatch(
      /public\.try_match_ride_request\(request_row.request_id, NEW.offer_id\)/,
    );
  });

  it("preserves the complete original allocator except its two temporal predicates", () => {
    const withoutTemporalGuards = matching
      .replace(/\r\n/g, "\n")
      .replace(
        /\n {4}AND \(ride_date \+ departure_time\) AT TIME ZONE 'America\/Fortaleza' >= pg_catalog\.clock_timestamp\(\)/g,
        "",
      );
    expect(withoutTemporalGuards).toBe(
      functionBody(originalMatching, "try_match_ride_request").replace(/\r\n/g, "\n"),
    );
    expect(matching.match(/pg_catalog\.clock_timestamp\(\)/g)).toHaveLength(2);
  });

  it.each([null, "chosen"])("preserves candidate selection for preferred offer %s", (preferred) => {
    const predicate = matching.match(
      /AND \((p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)\)/,
    )?.[1];
    expect(predicate).toBe("p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id");
    const candidates = ["other", "chosen"].filter(
      (offerId) => preferred === null || offerId === preferred,
    );
    expect(candidates).toEqual(preferred === null ? ["other", "chosen"] : ["chosen"]);
  });

  it("uses only type/status in SQL badges and strips internal IDs in the UI mapper", () => {
    const fields = discovery.match(/jsonb_build_object\(([\s\S]*?)\)\)/)?.[1];
    expect(fields?.match(/'([^']+)'/g)).toEqual(["'type'", "'status'"]);
    expect(
      normalizeRideVerification({
        id: "private",
        user_id: "private",
        verified_email: "private",
        type: "UNIFOR",
        status: "VERIFIED",
      }),
    ).toEqual({ type: "UNIFOR", status: "VERIFIED" });
    expect(normalizeRideVerification({ type: "STS_2026", status: "VERIFIED" })).toEqual({
      type: "STS_2026",
      status: "VERIFIED",
    });
    expect(normalizeRideVerification({ type: "UNIFOR", status: "REVOKED" })).toBeNull();
  });
});

describe("discovery capacity compatibility", () => {
  const request = {
    userId: "B",
    origin: "Aldeota",
    destination: "Centro",
    rideDate: "2026-10-07",
    departureTime: "08:00",
    passengerCount: 2,
  };
  const offer = { ...request, userId: "A", availableSeats: 2, seatsRemaining: 2 };
  it("allows B to match A with sufficient seats", () => {
    expect(isRideRequestCompatibleWithOffer({ request, offer })).toBe(true);
  });
  it("rejects own offers, insufficient seats and zero seats", () => {
    expect(isRideRequestCompatibleWithOffer({ request, offer: { ...offer, userId: "B" } })).toBe(
      false,
    );
    for (const seatsRemaining of [0, 1]) {
      expect(
        isRideRequestCompatibleWithOffer({ request, offer: { ...offer, seatsRemaining } }),
      ).toBe(false);
    }
  });
});
