import { describe, expect, it } from "vitest";
import { buildMainFunnel } from "./main-funnel-metrics";
describe("main funnel", () => {
  it("calculates both conversion references and identifies the largest drop", () => {
    const funnel = buildMainFunnel(100, [50, 20, 10, 8, 4, 1]);
    expect(funnel.stages[2]).toMatchObject({ fromPrevious: 40, fromStart: 20 });
    expect(funnel.largestDrop?.label).toBe("Nova carona");
  });
});
