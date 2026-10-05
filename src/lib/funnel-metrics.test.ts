import { describe, expect, it } from "vitest";
import { buildFunnelMetrics } from "./funnel-metrics";

describe("acquisition funnel SQL-equivalent aggregation", () => {
  it("deduplicates users and anonymous sessions per stage and preserves conversion formulas", () => {
    const events = [
      { event_id: "e1", event_name: "landing_view", user_id: "u1", anonymous_session_id: null },
      { event_id: "e2", event_name: "landing_view", user_id: "u1", anonymous_session_id: null },
      { event_id: "e3", event_name: "landing_view", user_id: null, anonymous_session_id: "s1" },
      { event_id: "e4", event_name: "form_started", user_id: "u1", anonymous_session_id: null },
      { event_id: "e5", event_name: "form_started", user_id: null, anonymous_session_id: "s1" },
      { event_id: "e6", event_name: "form_completed", user_id: "u1", anonymous_session_id: null },
      { event_id: "e7", event_name: "form_completed", user_id: null, anonymous_session_id: "s1" },
      { event_id: "e8", event_name: "lead_created", user_id: "u1", anonymous_session_id: null },
    ] as const;
    expect(buildFunnelMetrics([...events])).toEqual({
      reached: 2,
      started: 2,
      completed: 2,
      leads: 1,
      rates: { reachedToStarted: 100, startedToCompleted: 100, completedToLead: 50 },
    });
  });
});
