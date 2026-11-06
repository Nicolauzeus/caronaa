import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  TripModeSelector,
  type TripMode,
} from "@/components/caronaa/TripModeSelector";
import { RoutePolicySelector } from "@/components/caronaa/RoutePolicySelector";
function Modes() {
  const [mode, setMode] = useState<TripMode>("CARPOOL");
  return (
    <>
      <TripModeSelector value={mode} onChange={setMode} />
      <output>{mode}</output>
    </>
  );
}
function Policy() {
  const [allow, setAllow] = useState(false);
  return (
    <>
      <RoutePolicySelector allowDetours={allow} onChange={setAllow} />
      <output>{String(allow)}</output>
    </>
  );
}
describe("Trip modes and detour consent", () => {
  it("switches between shared carpool and the existing direct regional pilot", () => {
    render(<Modes />);
    expect(
      screen.getByRole("radio", { name: /Carona Compartilhada/ }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Viajar Agora/ }));
    expect(screen.getByText("EXCLUSIVE")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Viajar Agora/ })).toBeChecked();
    fireEvent.click(
      screen.getByRole("radio", { name: /Carona Compartilhada/ }),
    );
    expect(screen.getByText("CARPOOL")).toBeInTheDocument();
  });
  it("explains walking on the strict route and requires an explicit flexible choice", () => {
    render(<Policy />);
    expect(screen.getByRole("radio", { name: /Rota Estrita/ })).toBeChecked();
    expect(screen.getByText(/passageiro pode caminhar/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("radio", { name: /Aceitar pequenos desvios/ }),
    );
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
