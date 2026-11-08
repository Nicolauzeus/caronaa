import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0138_strict_meeting_wait_policy.sql", "utf8");

describe("0138 strict pickup security migration contract", () => {
  it("timestamps arrival only in database and rejects manual timestamp edits", () => {
    expect(sql).toContain("clock_timestamp()");
    expect(sql).toContain("Arrival timestamp is server-managed");
    expect(sql).toContain("auth.uid() IS DISTINCT FROM NEW.driver_user_id");
  });
  it("guards the historical status RPC from early or unauthorized no-shows", () => {
    expect(sql).toContain("BEFORE UPDATE OF status ON public.rides");
    expect(sql).toContain("OLD.boarded_at IS NOT NULL");
    expect(sql).toContain("OLD.strict_pickup_arrived_at > clock_timestamp() - interval '8 minutes'");
  });
  it("checks driver and ride state under row lock for idempotent no-show", () => {
    expect(sql).toContain("WHERE ride_id = p_ride_id FOR UPDATE");
    expect(sql).toContain("IF r.status = 'NO_SHOW' THEN RETURN 'NO_SHOW'");
    expect(sql).toContain("RETURN public.transition_ride_status(p_ride_id, 'NO_SHOW')");
  });
  it("exposes the wait only to authenticated participants", () => {
    expect(sql).toContain("auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_strict_pickup_wait(uuid) FROM PUBLIC, anon");
  });
});
