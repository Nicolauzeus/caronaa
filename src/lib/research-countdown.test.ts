import { describe, expect, it } from "vitest";
import { getResearchCountdown } from "./research-countdown";

describe("live circular prelaunch countdown", () => {
  const launch = "2026-11-04T03:00:00Z"; // 04/11 at midnight in Fortaleza
  const at = Date.parse(launch);

  it("counts days, hours, minutes and seconds independently", () => {
    const offset = ((3 * 86_400) + (4 * 3_600) + (5 * 60) + 6) * 1000;
    expect(getResearchCountdown(launch, at - offset)).toEqual({
      days: 3, hours: 4, minutes: 5, seconds: 6,
      totalSeconds: 3 * 86_400 + 4 * 3_600 + 5 * 60 + 6,
    });
  });

  it("ticks from 60 seconds to 59 seconds without changing campaign date", () => {
    expect(getResearchCountdown(launch, at - 60_000)?.totalSeconds).toBe(60);
    expect(getResearchCountdown(launch, at - 59_000)?.totalSeconds).toBe(59);
  });

  it("does not open early within the final second", () => {
    expect(getResearchCountdown(launch, at - 1)?.totalSeconds).toBe(1);
  });

  it("never displays negative time once launch time passes", () => {
    expect(getResearchCountdown(launch, at)).toMatchObject({
      days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0,
    });
    expect(getResearchCountdown(launch, at + 30_000)?.totalSeconds).toBe(0);
  });

  it("uses ISO instants, including the Fortaleza timezone offset, without adding hours", () => {
    expect(getResearchCountdown(launch, Date.parse("2026-11-03T23:00:00-03:00"))?.hours).toBe(1);
  });

  it("does not render a made-up countdown for an invalid campaign date", () => {
    expect(getResearchCountdown(undefined, Date.now())).toBeNull();
    expect(getResearchCountdown("invalid", Date.now())).toBeNull();
    expect(getResearchCountdown(launch, Number.NaN)).toBeNull();
  });
});
