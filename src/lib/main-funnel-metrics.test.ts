import { describe, expect, it } from "vitest";
import { buildMainFunnel } from "./main-funnel-metrics";

describe("cohort main funnel", () => {
  it("counts only the acquired cohort and documents stage denominators", () => {
    const cohort = [
      { userId: "u1", events: ["USER_REGISTERED", "RIDE_REQUEST_CREATED", "MATCH_CREATED"] },
      { userId: "u2", events: ["USER_REGISTERED", "RIDE_OFFER_CREATED"] },
      { userId: "u3", events: [] },
    ];
    const funnel = buildMainFunnel(cohort);
    expect(funnel.stages.map((stage) => stage.count)).toEqual([3, 2, 2, 1, 0, null, 0]);
    expect(funnel.cohortSize).toBe(3);
    expect(funnel.stages[2]).toMatchObject({ fromPrevious: 100, fromStart: 66.67 });
    expect(funnel.stages[3]).toMatchObject({ fromPrevious: 50, fromStart: 33.33 });
  });

  it("can label the registered-user acquisition cohort separately", () => {
    expect(buildMainFunnel([{ userId: "u1", events: ["USER_REGISTERED"] }], "user_registered").cohortEvent)
      .toBe("user_registered");
  });
});
