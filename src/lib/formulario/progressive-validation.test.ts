import { describe, expect, it } from "vitest";
import { getNextStep, getProgressPercentage, getStepCount } from "./flow";
import { validateFormStep } from "./schema";

describe("progressive questionnaire validation", () => {
  it("keeps the research at five steps and places contact after 100%", () => {
    const data = { source: "test", intent: "PASSAGEIRO" as const };
    expect(getStepCount(data)).toBe(5);
    expect(getProgressPercentage("INTEREST", data)).toBe(100);
    expect(getNextStep("INTEREST", data)).toBe("CONTACT");
    expect(getProgressPercentage("CONTACT", data)).toBe(100);
    expect(getNextStep("CONTACT", data)).toBe("SUCCESS");
  });

  it("validates profile/route, cost, problems, main pain and interest by screen", () => {
    expect(validateFormStep("PROFILE_ROUTE", {}).success).toBe(false);
    expect(validateFormStep("CURRENT_PRICE", {}).success).toBe(false);
    expect(validateFormStep("PROBLEMS", { painPoints: [] }).success).toBe(false);
    expect(
      validateFormStep("MAIN_PROBLEM", {
        painPoints: ["DOR_01"],
        mainPainPoint: "DOR_02",
        mainPainIntensity: 6,
      }).success,
    ).toBe(false);
    expect(
      validateFormStep("INTEREST", { intent: "AMBOS", passengerInterest: "TALVEZ" }).success,
    ).toBe(false);
  });

  it("requires contact only on the conversion screen and keeps email optional", () => {
    expect(
      validateFormStep("INTEREST", { intent: "PASSAGEIRO", passengerInterest: "TALVEZ" }).success,
    ).toBe(true);
    expect(validateFormStep("CONTACT", { name: "Ana", whatsapp: "85999999999" }).success).toBe(
      true,
    );
    expect(validateFormStep("CONTACT", { name: "Ana", whatsapp: "123" }).success).toBe(false);
  });
});
