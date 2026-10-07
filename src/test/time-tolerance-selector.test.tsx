import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TimeToleranceSelector } from "@/components/caronaa/TimeToleranceSelector";

describe("TimeToleranceSelector Component", () => {
  it("renders with default +-15 min active badge and all 4 options", () => {
    const handleChange = vi.fn();
    render(<TimeToleranceSelector value={15} onChange={handleChange} />);

    expect(screen.getByTestId("active-tolerance-badge")).toHaveTextContent("Tolerância ativa: ±15 min");
    expect(screen.getByRole("radio", { name: /±5 min/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /±15 min \(padrão\)/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /±30 min/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /±60 min/i })).toBeInTheDocument();
  });

  it("calculates and displays accepted time window range for baseTime 18:20 with +-15 min", () => {
    const handleChange = vi.fn();
    render(<TimeToleranceSelector value={15} onChange={handleChange} baseTime="18:20" />);

    const preview = screen.getByTestId("time-window-preview");
    expect(preview).toHaveTextContent("Aceita saídas de 18:05 até 18:35");
  });

  it("updates range display for +-30 min on baseTime 18:20", () => {
    const handleChange = vi.fn();
    render(<TimeToleranceSelector value={30} onChange={handleChange} baseTime="18:20" />);

    const preview = screen.getByTestId("time-window-preview");
    expect(preview).toHaveTextContent("Aceita saídas de 17:50 até 18:50");
  });

  it("calls onChange when user clicks another tolerance option", () => {
    const handleChange = vi.fn();
    render(<TimeToleranceSelector value={15} onChange={handleChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /±5 min/i }));
    expect(handleChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole("radio", { name: /±30 min/i }));
    expect(handleChange).toHaveBeenCalledWith(30);

    fireEvent.click(screen.getByRole("radio", { name: /±60 min/i }));
    expect(handleChange).toHaveBeenCalledWith(60);
  });
});

