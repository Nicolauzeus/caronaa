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
    expect(screen.getAllByText(/Receba pelo compartilhamento do trajeto/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/ajuda de custo justa por passageiro/i)).toBeInTheDocument();

    // Structured question
    expect(screen.getByText(/Quanto essa proposta faz sentido para você\?/i)).toBeInTheDocument();
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

  it("renders DriverFlow sub-steps and validates progression correctly", () => {
    let nextCalled = false;

    const { rerender } = render(
      <DriverFlow
        vehicleType={undefined}
        availableSeats={undefined}
        driverPrice={10}
        driverRealValidation={undefined}
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
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    // Sub-etapa 1: Veículos e Vagas
    expect(screen.getAllByText(/Qual veículo você usará no evento\?/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: /Carro próprio/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Carro da família/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Moto/i })).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).toBeDisabled();

    // Rerender with valid sub-step 1
    rerender(
      <DriverFlow
        vehicleType="CARRO_PROPRIO"
        availableSeats={2}
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
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);

    // Sub-etapa 2: Conforto
    expect(screen.getAllByText(/Fatores de conforto para você oferecer carona/i).length).toBeGreaterThan(0);
    fireEvent.click(continueBtn);

    // Sub-etapa 3: Compensação
    expect(screen.getAllByText(/Compensação justa por passageiro/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$ 3,50 é nossa referência mínima/i)).toBeInTheDocument();
    expect(screen.getByText(/15% em validação/i)).toBeInTheDocument();
    expect(screen.queryByText(/25%/i)).not.toBeInTheDocument();
    fireEvent.click(continueBtn);

    // Sub-etapa 4: Validação real
    expect(
      screen.getByText(/Se houver alguém compatível com o seu trajeto hoje, você ofereceria carona\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Com certeza, posso oferecer\./i)).toBeInTheDocument();

    const advanceBtn = screen.getByRole("button", { name: /Avançar para contato/i });
    expect(advanceBtn).not.toBeDisabled();
    fireEvent.click(advanceBtn);
    expect(nextCalled).toBe(true);
  });

  it("shows helmet alert and only 1 seat option when Moto is selected", () => {
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
    expect(screen.getByText(/uso obrigatório de capacete homologado/i)).toBeInTheDocument();
    expect(screen.getByText(/1 lugar disponível \(garupa\)/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "2" })).not.toBeInTheDocument();
  });

  it("handles 0 available seats warmly without blocking progression", () => {
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
        onNext={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/Tudo bem! Mesmo sem lugares livres hoje/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Poderia oferecer em outro momento\?/i),
    ).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /Continuar/i });
    expect(continueBtn).not.toBeDisabled();
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

    // Above max price R$ 25.00
    const res3 = validateFormStep("DRIVER_FLOW", {
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 2,
      driverPrice: 30.0,
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res3.success).toBe(false);

    // Valid data
    const res4 = validateFormStep("DRIVER_FLOW", {
      vehicleType: "CARRO_PROPRIO",
      availableSeats: 3,
      driverPrice: 10,
      driverComfortFactors: ["IDENTIDADE_VERIFICADA"],
      driverRealValidation: "COM_CERTEZA",
    });
    expect(res4.success).toBe(true);
  });
});
