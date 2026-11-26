import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DriverPwaPromotionCard } from "@/components/caronaa/DriverPwaPromotionCard";

function mockStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches, media: q, addEventListener() {}, removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(cleanup);

describe("DriverPwaPromotionCard", () => {
  it("shows install invitation in the browser", () => {
    mockStandalone(false);
    render(<DriverPwaPromotionCard />);
    expect(screen.getByText("Instale o app para não perder chamados")).toBeTruthy();
  });
  it("is hidden for drivers already using the installed app", () => {
    mockStandalone(true);
    render(<DriverPwaPromotionCard />);
    expect(screen.queryByText("Instale o app para não perder chamados")).toBeNull();
  });
});
