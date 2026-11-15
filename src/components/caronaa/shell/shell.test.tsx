import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractiveBottomSheet } from "./InteractiveBottomSheet";
import { ServiceTypeDock } from "./ServiceTypeDock";

afterEach(cleanup);

describe("CARONAA shell stage 2", () => {
  it("renders the service dock with accessible independent UI choices", () => {
    const onChange = vi.fn();
    render(<ServiceTypeDock value="FLASH" onChange={onChange}/>);
    expect(screen.getByRole("button", {name:/flash/i}).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", {name:/agendada/i}));
    expect(onChange).toHaveBeenCalledWith("AGENDADA");
  });

  it("uses the three fixed viewport snap heights", () => {
    const onChange = vi.fn();
    const {rerender} = render(<InteractiveBottomSheet value="peek" onChange={onChange}>Destino</InteractiveBottomSheet>);
    const sheet = screen.getByRole("region", {name:"Planejar viagem"});
    expect(sheet.style.minHeight).toBe("15%");
    expect(sheet.getAttribute("style")).toContain("15dvh");
    const handle=screen.getByRole("button",{name:/alça do painel/i});
    expect(handle.className).toContain("min-h-[44px]");
    fireEvent.keyDown(handle, {key:"ArrowUp"});
    expect(onChange).toHaveBeenCalledWith("half");
    rerender(<InteractiveBottomSheet value="half" onChange={onChange}>Destino</InteractiveBottomSheet>);
    expect(sheet.style.minHeight).toBe("50%");
    expect(sheet.getAttribute("style")).toContain("50dvh");
    rerender(<InteractiveBottomSheet value="full" onChange={onChange}>Destino</InteractiveBottomSheet>);
    expect(sheet.style.minHeight).toBe("85%");
    expect(sheet.getAttribute("style")).toContain("85dvh");
  });
});
