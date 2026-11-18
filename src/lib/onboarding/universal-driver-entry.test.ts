import { describe, expect, it } from "vitest";
import {
  afterUniversalOnboarding,
  isProfessionalApplicationRedirect,
  PROFESSIONAL_APPLICATION_PATH,
} from "./universal-driver-entry";

describe("cadastro único do CARONAA para mototaxistas", () => {
  it("allows only the existing professional completion route as a continuation", () => {
    expect(isProfessionalApplicationRedirect(PROFESSIONAL_APPLICATION_PATH)).toBe(true);
    expect(isProfessionalApplicationRedirect("//example.com")).toBe(false);
    expect(isProfessionalApplicationRedirect("/admin")).toBe(false);
    expect(isProfessionalApplicationRedirect(undefined)).toBe(false);
  });

  it("continues to professional data only after universal onboarding", () => {
    expect(afterUniversalOnboarding("/home", PROFESSIONAL_APPLICATION_PATH)).toBe(PROFESSIONAL_APPLICATION_PATH);
    expect(afterUniversalOnboarding("/onboarding", PROFESSIONAL_APPLICATION_PATH)).toBe("/onboarding");
    expect(afterUniversalOnboarding("/home", undefined)).toBe("/home");
  });

  it("never bypasses a pre-launch/campaign waiting gate", () => {
    expect(afterUniversalOnboarding("/aguardando", PROFESSIONAL_APPLICATION_PATH)).toBe("/aguardando");
  });
});
