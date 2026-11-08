import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PassengerRideOptions } from "./PassengerRideOptions";

describe("selection between shared/moto/quick rides", () => {
  it("keeps all three modes inside a responsive, bounded grid on narrow phones", () => {
    render(<PassengerRideOptions value="CAR" estimate={6} onChange={vi.fn()} />);
    const grid = screen.getByTestId("passenger-ride-mode-grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid).toHaveClass("sm:grid-cols-3");
    expect(screen.getByRole("radio", { name: /Carona Compartilhada/ })).toBeChecked();
    const quick = screen.getByRole("radio", { name: /Corrida Rápida/ });
    expect(quick.closest("label")).toHaveClass("col-span-2");
    expect(quick.closest("label")).toHaveClass("sm:col-span-1");
    expect(screen.getByRole("radio", { name: /Carona Moto/ })).toBeInTheDocument();
  });

  it("switches modes without navigating or resetting the form", () => {
    const onChange = vi.fn();
    render(<PassengerRideOptions value="CAR" estimate={6} onChange={onChange}/>);
    fireEvent.click(screen.getByRole("radio", { name: /Corrida Rápida/ }));
    expect(onChange).toHaveBeenCalledWith("EXCLUSIVE");
    fireEvent.click(screen.getByRole("radio", { name: /Carona Moto/ }));
    expect(onChange).toHaveBeenCalledWith("MOTO");
  });

  it("keeps the home sheet at a stable viewport height with internal scrolling", () => {
    const home = readFileSync("src/routes/_authenticated/home.tsx", "utf8");
    const quickPanel = readFileSync("src/components/caronaa/QuickRideHomePanel.tsx", "utf8");
    expect(home).toContain("h-[min(84dvh,calc(100%_-_5rem))]");
    expect(home).toContain("overflow-x-hidden overflow-y-auto");
    expect(quickPanel).toContain("min-w-0 w-full max-w-full");
    expect(quickPanel).toContain("flex min-w-0 flex-wrap gap-2");
  });
});
