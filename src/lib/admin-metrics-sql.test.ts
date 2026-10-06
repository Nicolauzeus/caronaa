import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0017_secure_and_aggregate_admin_metrics.sql"),
  "utf8",
);
const telemetryMigration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0008_create_funnel_events.sql"),
  "utf8",
);
const root = process.cwd();

describe("admin metric SQL security and aggregation", () => {
  it("blocks all browser writes to business events while preserving admin reads and telemetry inserts", () => {
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON public.product_events FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain('CREATE POLICY "Admins read product events"');
    expect(migration).toContain("USING (public.has_role(auth.uid(), 'admin'))");
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users register their own non-operational product events"',
    );
    expect(migration).toContain('CREATE POLICY "Clients register telemetry funnel events"');
    expect(migration).toContain(
      "event_name IN ('landing_view', 'form_started', 'form_step_completed')",
    );
    expect(migration).toContain(
      "AND (fe.event_name NOT IN ('form_completed', 'lead_created') OR fe.trusted_source)",
    );
    expect(migration).toContain("CREATE TRIGGER form_submission_track_funnel_outcomes");
    expect(migration).toContain("v_raw_payload := p_submission - ARRAY[");
    expect(migration).toContain("raw_payload");
    expect(migration).toContain("source = p_source");
    expect(telemetryMigration).toContain(
      "GRANT INSERT ON public.funnel_events TO anon, authenticated",
    );
    expect(telemetryMigration).toContain('CREATE POLICY "Anyone can register funnel events"');
  });

  it("defines admin-gated database aggregates and all supported filters", () => {
    for (const rpc of [
      "get_acquisition_funnel_metrics",
      "get_main_funnel_metrics",
      "get_operational_metrics",
    ]) {
      expect(migration).toContain(`FUNCTION public.${rpc}`);
    }
    expect(migration.match(/Admin access required/g)?.length).toBe(4);
    expect(migration).toContain("count(DISTINCT CASE WHEN fe.event_name = 'landing_view'");
    expect(migration).toContain(
      "count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name = 'RIDE_COMPLETED'",
    );
    expect(migration).toContain("count(DISTINCT m.request_id)");
    expect(migration).toContain("count(DISTINCT m.offer_id)");
    for (const filter of [
      "p_period_start",
      "p_period_end",
      "p_source",
      "p_campaign",
      "p_profile",
      "p_origin",
      "p_destination",
      "p_time_window",
    ]) {
      expect(migration).toContain(filter);
    }
  });

  it("keeps metric consumers on aggregate RPCs rather than downloading product events", () => {
    const funnel = readFileSync(resolve(root, "src/lib/funnel-metrics.ts"), "utf8");
    const main = readFileSync(resolve(root, "src/lib/main-funnel-metrics.ts"), "utf8");
    const operational = readFileSync(resolve(root, "src/lib/operational-metrics.ts"), "utf8");
    expect(funnel).toContain('rpc("get_acquisition_funnel_metrics"');
    expect(main).toContain('rpc("get_main_funnel_metrics"');
    expect(operational).toContain('rpc("get_operational_metrics"');
    expect(main).not.toContain('.from("product_events")');
    expect(operational).not.toContain('.from("product_events")');
  });

  it("builds a bounded acquisition cohort and follows only its members", () => {
    expect(migration).toContain("p_cohort_event text DEFAULT 'landing_view'");
    expect(migration).toContain("p_cohort_event NOT IN ('landing_view', 'user_registered')");
    expect(migration).toContain("WITH cohort AS (");
    expect(migration).toContain(
      "FROM cohort LEFT JOIN public.product_events pe ON pe.user_id = cohort.user_id",
    );
  });
});
