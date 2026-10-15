import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ calculate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.calculate }));
vi.mock("@/lib/offer-pricing.functions", () => ({ quoteOfferRoute: {} }));
import { OfferFarePreview } from "@/components/caronaa/OfferFarePreview";
afterEach(cleanup);
beforeEach(() => {
  mocks.calculate.mockReset();
});
describe("automatic offer fare", () => {
  it("shows the server price without clicking a calculation button", async () => {
    mocks.calculate.mockResolvedValue({ quoteId: "quote", distanceKm: 11, pricePerPassenger: 6 });
    const onQuote = vi.fn();
    render(<OfferFarePreview origin="A" destination="B" seats={3} onQuote={onQuote} />);
    await waitFor(() => expect(screen.getByText(/R\$\s*6,00/)).toBeVisible(), { timeout: 2500 });
    expect(screen.getByText(/até R\$\s*18,00/)).toBeVisible();
    expect(onQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({ quoteId: "quote", origin: "A", destination: "B" }),
    );
  });
  it("invalidates the old price as soon as the route changes", async () => {
    mocks.calculate.mockResolvedValue({ quoteId: "quote", distanceKm: 11, pricePerPassenger: 6 });
    const onQuote = vi.fn();
    const { rerender } = render(
      <OfferFarePreview origin="A" destination="B" seats={2} onQuote={onQuote} />,
    );
    await waitFor(
      () => expect(onQuote).toHaveBeenCalledWith(expect.objectContaining({ quoteId: "quote" })),
      { timeout: 2500 },
    );
    rerender(<OfferFarePreview origin="A" destination="C" seats={2} onQuote={onQuote} />);
    expect(onQuote).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText(/R\$\s*6,00/)).not.toBeInTheDocument();
  });
  it("offers retry rather than an invented fare on failure", async () => {
    mocks.calculate.mockRejectedValue(new Error("Não foi possível calcular o preço."));
    render(<OfferFarePreview origin="A" destination="B" seats={2} onQuote={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible(), { timeout: 2500 });
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });
});
