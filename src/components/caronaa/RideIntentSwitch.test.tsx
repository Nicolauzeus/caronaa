import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RideIntentSwitch } from "./RideIntentSwitch";

describe("request vs offer quick role switch", () => {
  it("always exposes both role actions without submitting anything", () => {
    const switchRole = vi.fn();
    render(<RideIntentSwitch value="REQUEST" onChange={switchRole} />);
    expect(screen.getByRole("button", { name: "Pedir carona" })).toHaveAttribute("aria-pressed", "true");
    const offer = screen.getByRole("button", { name: "Oferecer carona" });
    expect(offer).toHaveAttribute("type", "button");
    expect(offer).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(offer);
    expect(switchRole).toHaveBeenCalledWith("OFFER");
    fireEvent.click(screen.getByRole("button", { name: "Pedir carona" }));
    expect(switchRole).toHaveBeenCalledTimes(1);
  });
  it("allows returning to request mode, and disables switching during publication", () => {
    const onChange = vi.fn();
    const {rerender}=render(<RideIntentSwitch value="OFFER" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir carona" }));
    expect(onChange).toHaveBeenCalledWith("REQUEST");
    rerender(<RideIntentSwitch value="OFFER" onChange={onChange} disabled />);
    expect(screen.getByRole("button", { name: "Pedir carona" })).toBeDisabled();
  });
});
