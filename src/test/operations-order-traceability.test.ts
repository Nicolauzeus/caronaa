import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0247_admin_operations_order_timeline.sql", "utf8");

describe("admin order traceability migration contract", () => {
  it("restricts the RPC to administrators and keeps source records untouched", () => {
    expect(sql).toContain("public.has_role(auth.uid(),'admin'::public.app_role)");
    expect(sql).toContain("SECURITY DEFINER SET search_path=''");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE FROM|INSERT INTO|TRUNCATE)\s+public\./i);
  });
  it("anchors shared timelines in the request, even without any ride attempt", () => {
    expect(sql).toContain("FROM public.ride_requests r LEFT JOIN public.profiles");
    expect(sql).toContain("WHERE r.request_id=p_request_id");
    expect(sql).toContain("attempt_count");
    expect(sql).toContain("ride_status_history");
  });
  it("distinguishes observed views, skips and cancellation evidence from missing telemetry", () => {
    expect(sql).toContain("quick_ride_driver_views");
    expect(sql).toContain("flash_order_driver_skips");
    expect(sql).toContain("quick_ride_driver_cancellations");
    expect(sql).toContain("'drivers_notified',NULL");
    expect(sql).toContain("deadline_not_observed_transition");
    expect(sql).toContain("record_created_not_delivery");
    expect(sql).toContain("notification_read_not_order_view");
  });
});
