import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractiveBottomSheet } from "./InteractiveBottomSheet";
import { ServiceTypeDock } from "./ServiceTypeDock";

afterEach(cleanup);

describe("CARONAA shell stage 2", () => {
  it("renders the service dock with accessible independent UI choices", () => {
    const onChange = vi.fn();
    render(<ServiceTypeDock value="FLASH" onChange={onChange}/>);
    expect(screen.getByRole("button", {name:/agora/i}).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", {name:/agendar/i}));
    expect(onChange).toHaveBeenCalledWith("AGENDADA");
  });

  it("changes between the three panel states with accessible arrow controls", () => {
    const onChange = vi.fn();
    const {rerender} = render(<InteractiveBottomSheet value="peek" onChange={onChange}>Destino</InteractiveBottomSheet>);
    const handle=screen.getByRole("button",{name:/alça do painel/i});
    fireEvent.keyDown(handle, {key:"ArrowUp"});
    expect(onChange).toHaveBeenCalledWith("half");
    rerender(<InteractiveBottomSheet value="half" onChange={onChange}>Destino</InteractiveBottomSheet>);
    fireEvent.keyDown(handle, {key:"ArrowUp"});
    expect(onChange).toHaveBeenLastCalledWith("full");
    rerender(<InteractiveBottomSheet value="full" onChange={onChange}>Destino</InteractiveBottomSheet>);
    fireEvent.keyDown(handle, {key:"ArrowDown"});
    expect(onChange).toHaveBeenLastCalledWith("half");
  });
});
