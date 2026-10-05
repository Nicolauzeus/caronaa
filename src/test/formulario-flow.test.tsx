import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FormIntro } from "@/components/formulario/FormIntro";
import { ProfileRouteStep } from "@/components/formulario/SimplifiedSteps";

describe("Formulario Flow Components", () => {
  it("renders FormIntro and triggers onStart", () => {
    let started = false;
    render(<FormIntro onStart={() => { started = true; }} />);

    expect(screen.getByText(/Garanta sua CARONAA no/i)).toBeInTheDocument();
    expect(screen.getByText(/Centro de Eventos do Ceará/i)).toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: /Começar minha CARONAA/i });
    fireEvent.click(startButton);
    expect(started).toBe(true);
  });

  it("renders ProfileRouteStep with all options and validates before next", () => {
    let nextCalled = false;
    let selectedIntent = "";

    const { rerender } = render(
      <ProfileRouteStep
        intent={undefined}
        occupation={undefined}
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood=""
        departureWindow={undefined}
        weeklyFrequency={undefined}
        onIntentChange={(val) => { selectedIntent = val; }}
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onWeeklyFrequencyChange={() => {}}
        onNext={() => { nextCalled = true; }}
        onBack={() => {}}
      />
    );

    const nextBtn = screen.getByRole("button", { name: /Avançar trajeto/i });
    expect(nextBtn).toBeDisabled();

    // Re-render with full valid data
    rerender(
      <ProfileRouteStep
        intent="PASSAGEIRO"
        occupation="ESTUDANTE"
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood="Aldeota"
        departureWindow="21_22"
        weeklyFrequency="1_2"
        onIntentChange={() => {}}
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onWeeklyFrequencyChange={() => {}}
        onNext={() => { nextCalled = true; }}
        onBack={() => {}}
      />
    );

    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    expect(nextCalled).toBe(true);
  });
});
