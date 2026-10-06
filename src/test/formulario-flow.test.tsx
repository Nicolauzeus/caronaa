import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FormIntro } from "@/components/formulario/FormIntro";
import {
  ProfileRouteStep,
  RoleStep,
  RouteDetailsStep,
  EventPresenceStep,
} from "@/components/formulario/SimplifiedSteps";
import {
  getNextStep,
  getPreviousStep,
  getStepIndex,
  getProgressPercentage,
  getStepCount,
} from "@/lib/formulario/flow";

describe("Formulario Flow Components", () => {
  it("renders FormIntro and triggers onStart", () => {
    let started = false;
    render(
      <FormIntro
        onStart={() => {
          started = true;
        }}
      />,
    );

    expect(screen.getByText(/Garanta sua CARONAA no/i)).toBeInTheDocument();
    expect(screen.getByText(/Centro de Eventos do Ceará/i)).toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: /Começar minha CARONAA/i });
    fireEvent.click(startButton);
    expect(started).toBe(true);
  });

  it("renders RoleStep (Step 1) and manages role selection without requiring other fields", () => {
    let nextCalled = false;
    let selectedIntent = "";

    const { rerender } = render(
      <RoleStep
        intent={undefined}
        onIntentChange={(val) => {
          selectedIntent = val;
        }}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
        stepNumber={1}
        totalSteps={6}
      />,
    );

    expect(screen.getByText(/Como você poderia usar a CARONAA\?/i)).toBeInTheDocument();
    const radioOptions = screen.getAllByRole("radio");
    expect(radioOptions).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /^🚗/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^🙋/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^🔄/i })).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).toBeDisabled();

    rerender(
      <RoleStep
        intent="PASSAGEIRO"
        onIntentChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
        stepNumber={1}
        totalSteps={6}
      />,
    );

    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    expect(nextCalled).toBe(true);
  });

  it("renders RouteDetailsStep (Step 2), validates route and verifies weekly frequency is NOT rendered", () => {
    let nextCalled = false;

    const { rerender } = render(
      <RouteDetailsStep
        intent="PASSAGEIRO"
        occupation={undefined}
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood=""
        departureWindow={undefined}
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
        stepNumber={2}
        totalSteps={6}
      />,
    );

    // Confirma que a pergunta de frequência semanal NÃO está mais presente
    expect(
      screen.queryByText(/Frequência com que costuma fazer esse percurso/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/2 a 3 vezes por semana/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apenas nos dias do STS/i)).not.toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /Avançar trajeto/i });
    expect(nextBtn).toBeDisabled();

    // Rerender with valid occupation, locations, departureWindow
    rerender(
      <RouteDetailsStep
        intent="PASSAGEIRO"
        occupation="ESTUDANTE"
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood="Aldeota"
        departureWindow="21_22"
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
        stepNumber={2}
        totalSteps={6}
      />,
    );

    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    expect(nextCalled).toBe(true);
  });

  it("renders EventPresenceStep (Step 3) and toggles conference presence days", () => {
    let nextCalled = false;
    let selectedDays: string[] = [];

    render(
      <EventPresenceStep
        eventPresenceDays={["07_OUTUBRO"]}
        onEventPresenceDaysChange={(days) => {
          selectedDays = days;
        }}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
        stepNumber={3}
        totalSteps={6}
      />,
    );

    expect(screen.getByText(/Quando você estará por aqui\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Dia 07 \(Quarta-feira\)/i)).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    expect(nextCalled).toBe(true);
  });

  it("tests modular multi-step navigation flow across the 6 steps", () => {
    const driverData = { source: "test", intent: "MOTORISTA" as const };
    const passengerData = { source: "test", intent: "PASSAGEIRO" as const };
    const dualData = { source: "test", intent: "AMBOS" as const };

    // Step 1: ROLE_SELECTION
    expect(getNextStep("INTRO", driverData)).toBe("ROLE_SELECTION");
    expect(getStepIndex("ROLE_SELECTION", driverData)).toBe(1);
    expect(getProgressPercentage("ROLE_SELECTION", driverData)).toBe(17);

    // Step 2: ROUTE_DETAILS
    expect(getNextStep("ROLE_SELECTION", driverData)).toBe("ROUTE_DETAILS");
    expect(getPreviousStep("ROUTE_DETAILS", driverData)).toBe("ROLE_SELECTION");
    expect(getStepIndex("ROUTE_DETAILS", driverData)).toBe(2);
    expect(getProgressPercentage("ROUTE_DETAILS", driverData)).toBe(33);

    // Step 3: EVENT_PRESENCE
    expect(getNextStep("ROUTE_DETAILS", driverData)).toBe("EVENT_PRESENCE");
    expect(getPreviousStep("EVENT_PRESENCE", driverData)).toBe("ROUTE_DETAILS");
    expect(getStepIndex("EVENT_PRESENCE", driverData)).toBe(3);
    expect(getProgressPercentage("EVENT_PRESENCE", driverData)).toBe(50);

    // Step 4: PROPOSAL_TRANSITION
    expect(getNextStep("EVENT_PRESENCE", driverData)).toBe("PROPOSAL_TRANSITION");
    expect(getPreviousStep("PROPOSAL_TRANSITION", driverData)).toBe("EVENT_PRESENCE");
    expect(getStepIndex("PROPOSAL_TRANSITION", driverData)).toBe(4);
    expect(getProgressPercentage("PROPOSAL_TRANSITION", driverData)).toBe(67);

    // Step 5: Profile specific
    expect(getNextStep("PROPOSAL_TRANSITION", driverData)).toBe("DRIVER_FLOW");
    expect(getNextStep("PROPOSAL_TRANSITION", passengerData)).toBe("PASSENGER_FLOW");
    expect(getNextStep("PROPOSAL_TRANSITION", dualData)).toBe("BOTH_FLOW");

    expect(getStepIndex("DRIVER_FLOW", driverData)).toBe(5);
    expect(getStepIndex("PASSENGER_FLOW", passengerData)).toBe(5);
    expect(getStepIndex("BOTH_FLOW", dualData)).toBe(5);

    // Step 6: CONTACT
    expect(getNextStep("DRIVER_FLOW", driverData)).toBe("CONTACT");
    expect(getNextStep("PASSENGER_FLOW", passengerData)).toBe("CONTACT");
    expect(getNextStep("BOTH_FLOW", dualData)).toBe("CONTACT");
    expect(getStepIndex("CONTACT", driverData)).toBe(6);
    expect(getProgressPercentage("CONTACT", driverData)).toBe(100);

    // Finish to SUCCESS
    expect(getNextStep("CONTACT", driverData)).toBe("SUCCESS");
  });

  it("renders ProfileRouteStep for backward-compatibility without requiring weekly frequency", () => {
    let nextCalled = false;

    const { rerender } = render(
      <ProfileRouteStep
        intent={undefined}
        occupation={undefined}
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood=""
        departureWindow={undefined}
        onIntentChange={() => {}}
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    const nextBtn = screen.getByRole("button", { name: /Avançar trajeto/i });
    expect(nextBtn).toBeDisabled();

    // Re-render with full valid data (sem weeklyFrequency)
    rerender(
      <ProfileRouteStep
        intent="PASSAGEIRO"
        occupation="ESTUDANTE"
        originNeighborhood="Centro de Eventos do Ceará"
        destinationNeighborhood="Aldeota"
        departureWindow="21_22"
        onIntentChange={() => {}}
        onOccupationChange={() => {}}
        onOriginNeighborhoodChange={() => {}}
        onDestinationNeighborhoodChange={() => {}}
        onDepartureWindowChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    expect(nextCalled).toBe(true);
  });
});
