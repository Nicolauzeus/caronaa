import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ProposalTransitionStep } from "@/components/formulario/ProposalTransitionStep";
import { DriverFlow } from "@/components/formulario/DriverFlow";
import { validateFormStep } from "@/lib/formulario/schema";
import { getNextStep, getStepCount, getProgressPercentage } from "@/lib/formulario/flow";

describe("ProposalTransitionStep and DriverFlow", () => {
  it("renders ProposalTransitionStep with proper driver briefing text and required question", () => {
    let selectedSense = "";
    let nextCalled = false;

    const { rerender } = render(
      <ProposalTransitionStep
        intent="MOTORISTA"
        proposalSense={undefined}
        onProposalSenseChange={(val) => {
          selectedSense = val;
        }}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    // Briefing text rules
    expect(screen.getAllByText(/Receba pelo compartilhamento do trajeto/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/compensação pelo lugar compartilhado/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Estamos testando essa ideia agora/i).length).toBeGreaterThan(0);

    // No misleading promises
    expect(screen.getByText(/Sem prometer renda garantida/i)).toBeInTheDocument();

    // Structured question
    expect(
      screen.getByText(/Quanto essa proposta faz sentido para você\?/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Pouco/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Médio/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Alto/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Altíssimo/i })).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).toBeDisabled();

    // Select Altíssimo
    rerender(
      <ProposalTransitionStep
        intent="MOTORISTA"
        proposalSense="ALTISSIMO"
        onProposalSenseChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    expect(nextCalled).toBe(true);
  });

  it("renders DriverFlow with all 6 items in exact order and validates correctly", () => {
    let vehicleVal = "";
    let seatsVal = 2;
    let priceVal = 10;
    let validationVal = "";

    const { rerender } = render(
      <DriverFlow
        vehicleType={undefined}
        availableSeats={undefined}
        driverPrice={10}
        driverRealValidation={undefined}
        onVehicleTypeChange={(val) => {
          vehicleVal = val;
        }}
        onAvailableSeatsChange={(val) => {
          seatsVal = val;
        }}
        onDriverFutureOfferChange={() => {}}
        onDriverComfortFactorsChange={() => {}}
        onDriverGenderPreferenceChange={() => {}}
        onDriverPriceChange={(val) => {
          priceVal = val;
        }}
        onDriverBarriersChange={() => {}}
        onDriverBarriersCustomChange={() => {}}
        onDriverRealValidationChange={(val) => {
          validationVal = val;
        }}
        onNext={() => {}}
        onBack={() => {}}
      />,
    );

    // Item 1: Veículos
    expect(screen.getByText(/1\. Qual veículo você usará no evento\?/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Carro próprio/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Carro da família/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Moto/i })).toBeInTheDocument();

    // Item 2: Vagas (0 a 10)
    expect(screen.getByText(/2\. Vagas disponíveis para oferecer/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "0" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "10" })).toBeInTheDocument();

    // Item 3: Conforto
    expect(screen.getByText(/3\. Fatores de conforto para você oferecer carona/i)).toBeInTheDocument();

    // Item 4: Compensação
    expect(screen.getByText(/4\. Compensação justa por passageiro/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 3,50 é nossa referência mínima/i)).toBeInTheDocument();
    expect(screen.getByText(/15% em validação/i)).toBeInTheDocument();
    expect(screen.queryByText(/25%/i)).not.toBeInTheDocument();

    // Item 5: Barreiras
    expect(screen.getByText(/5\. O que mais te faria hesitar em oferecer uma carona\?/i)).toBeInTheDocument();

    // Item 6: Validação real
    expect(screen.getByText(/6\. Se houver alguém compatível com o seu trajeto hoje, você ofereceria carona\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Com certeza, posso oferecer\./i)).toBeInTheDocument();
    expect(screen.getByText(/Talvez\./i)).toBeInTheDocument();
    expect(screen.getByText(/Sim, mas apenas durante o Siará Tech Summit\./i)).toBeInTheDocument();

    // Continue is disabled initially because vehicle and validation are missing
    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).toBeDisabled();
  });

  it("shows helmet alert when Moto is selected", () => {
    render(
      <DriverFlow
        vehicleType="MOTO"
        availableSeats={1}
        driverPrice={10}
        driverRealValidation="COM_CERTEZA"
        onVehicleTypeChange={() => {}}
        onAvailableSeatsChange={() => {}}
        onDriverFutureOfferChange={() => {}}
        onDriverComfortFactorsChange={() => {}}
        onDriverGenderPreferenceChange={() => {}}
        onDriverPriceChange={() => {}}
        onDriverBarriersChange={() => {}}
        onDriverBarriersCustomChange={() => {}}
        onDriverRealValidationChange={() => {}}
        onNext={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/Alerta de segurança e conformidade legal/i)).toBeInTheDocument();
    expect(screen.getByText(/Código de Trânsito Brasileiro \(CTB\)/i)).toBeInTheDocument();
  });

  it("handles 0 available seats warmly without blocking progression", () => {
    let nextTriggered = false;

    render(
      <DriverFlow
        vehicleType="CARRO_PROPRIO"
        availableSeats={0}
        driverFutureOffer="SIM"
        driverPrice={10}
        driverRealValidation="COM_CERTEZA"
        onVehicleTypeChange={() => {}}
        onAvailableSeatsChange={() => {}}
        onDriverFutureOfferChange={() => {}}
        onDriverComfortFactorsChange={() => {}}
        onDriverGenderPreferenceChange={() => {}}
        onDriverPriceChange={() => {}}
        onDriverBarriersChange={() => {}}
        onDriverBarriersCustomChange={() => {}}
        onDriverRealValidationChange={() => {}}
        onNext={() => {
          nextTriggered = true;
        }}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/Tudo bem! Mesmo sem lugares livres hoje/i)).toBeInTheDocument();
    expect(screen.getByText(/Você poderia oferecer uma carona em outro momento\?/i)).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    expect(nextTriggered).toBe(true);
  });

  it("validates DRIVER_FLOW step fields correctly", () => {
    // Missing vehicle
    const res1 = validateFormStep("DRIVER_FLOW", {
      availableSeats: 2,
      driverPrice: 10,
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res1.success).toBe(false);

    // Below min price R$ 3.50
    const res2 = validateFormStep("DRIVER_FLOW", {
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 2,
      driverPrice: 2.0,
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res2.success).toBe(false);

    // Custom barrier without text
    const res3 = validateFormStep("DRIVER_FLOW", {
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 2,
      driverPrice: 10.0,
      driverBarriers: ["OUTRA"],
      driverBarriersCustom: "",
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res3.success).toBe(false);

    // Valid data
    const res4 = validateFormStep("DRIVER_FLOW", {
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 2,
      driverPrice: 10.0,
      driverBarriers: ["OUTRA"],
      driverBarriersCustom: "Preocupação com horários",
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res4.success).toBe(true);
  });
});
