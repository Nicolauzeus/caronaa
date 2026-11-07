import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import { PassengerRideOptions } from "@/components/caronaa/PassengerRideOptions";

describe("Women-only control eligibility", () => {
  it.each(["MASCULINO", null] as const)("renders no DOM for %s in either role", (gender) => {
    const { container } = render(
      <>
        <WomenOnlyToggle gender={gender} checked={true} onChange={vi.fn()} kind="request" />
        <WomenOnlyToggle gender={gender} checked={true} onChange={vi.fn()} kind="offer" />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
  it.each(["request", "offer"] as const)(
    "exposes an optional accessible switch for a woman in %s",
    (kind) => {
      const onChange = vi.fn();
      const { rerender, container } = render(
        <WomenOnlyToggle gender="FEMININO" checked={false} onChange={onChange} kind={kind} />,
      );
      const control = screen.getByRole("switch", {
        name: kind === "request" ? /Carona entre mulheres/ : /Aceitar apenas passageiras mulheres/,
      });
      expect(control).not.toBeChecked();
      fireEvent.click(control);
      expect(onChange).toHaveBeenCalledWith(true);
      rerender(<WomenOnlyToggle gender={null} checked={true} onChange={onChange} kind={kind} />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
describe("Passenger travel options", () => {
  it("keeps the pilot distinct and never invents an estimate", () => {
    const change = vi.fn();
    const { rerender } = render(
      <PassengerRideOptions value="CAR" onChange={change} estimate={null} />,
    );
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Carona Moto/ }));
    expect(change).toHaveBeenCalledWith("MOTO");
    rerender(<PassengerRideOptions value="MOTO" onChange={change} estimate={12} />);
    expect(screen.getAllByText(/R\$\s*12,00/)).toHaveLength(2);
    expect(
      screen.getByRole("radio", { name: /Corrida Direta/ }).closest("label"),
    ).not.toHaveTextContent(/R\$/);
  });
});
