// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { PassengerFlow } from "@/components/formulario/PassengerFlow";
import { DualFlow } from "@/components/formulario/DualFlow";
import { validateFormStep } from "@/lib/formulario/schema";
import { getNextStep, getPreviousStep } from "@/lib/formulario/flow";

describe("PassengerFlow and DualFlow", () => {
  describe("PassengerFlow", () => {
    it("renders PassengerFlow sub-steps and navigates smoothly", () => {
      let nextCalled = false;

      const { rerender } = render(
        <PassengerFlow
          passengerTransports={[]}
          passengerTransportsCustom=""
          passengerDifficulties={[]}
          passengerDifficultiesCustom=""
          passengerTrustFactors={[]}
          passengerGenderPreference={undefined}
          passengerFairPrice={10}
          passengerBarriers={[]}
          passengerBarriersCustom=""
          passengerIntention={undefined}
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerTrustFactorsChange={() => {}}
          onPassengerGenderPreferenceChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {
            nextCalled = true;
          }}
          onBack={() => {}}
        />,
      );

      // Sub-etapa 1: Como se desloca hoje
      expect(
        screen.getByText(/1\. Como você costuma se deslocar hoje para trajetos como esse\?/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Aplicativos \(Uber \/ 99\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ônibus convencional/i)).toBeInTheDocument();

      const continueBtn = screen.getByRole("button", { name: /Continuar/i });
      expect(continueBtn).toBeDisabled();

      // Rerender with valid sub-step 1
      rerender(
        <PassengerFlow
          passengerTransports={["UBER_99"]}
          passengerDifficulties={["DOR_01"]}
          passengerFairPrice={10}
          passengerIntention="COM_CERTEZA_HOJE"
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerTrustFactorsChange={() => {}}
          onPassengerGenderPreferenceChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {
            nextCalled = true;
          }}
          onBack={() => {}}
        />,
      );

      expect(continueBtn).not.toBeDisabled();
      fireEvent.click(continueBtn);

      // Sub-etapa 2: Confiança
      expect(screen.getByText(/O que traria confiança para você pegar carona\?/i)).toBeInTheDocument();
      fireEvent.click(continueBtn);

      // Sub-etapa 3: Contribuição justa
      expect(screen.getByText(/Contribuição justa por passageiro/i)).toBeInTheDocument();
      expect(screen.getAllByText(/R\$ 10,00/i).length).toBeGreaterThan(0);
      fireEvent.click(continueBtn);

      // Sub-etapa 4: Validação real
      expect(screen.getByText(/Validação real para o Siará Tech Summit/i)).toBeInTheDocument();
      expect(screen.getByText(/Com certeza, posso precisar hoje\./i)).toBeInTheDocument();

      const advanceBtn = screen.getByRole("button", { name: /Avançar para contato/i });
      expect(advanceBtn).not.toBeDisabled();
      fireEvent.click(advanceBtn);
      expect(nextCalled).toBe(true);
    });

    it("requires custom text when 'OUTRO' is selected for transport", () => {
      const { rerender } = render(
        <PassengerFlow
          passengerTransports={["OUTRO"]}
          passengerTransportsCustom=""
          passengerDifficulties={["DOR_01"]}
          passengerFairPrice={10}
          passengerIntention="COM_CERTEZA_HOJE"
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerTrustFactorsChange={() => {}}
          onPassengerGenderPreferenceChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />,
      );

      const continueBtn = screen.getByRole("button", { name: /Continuar/i });
      expect(continueBtn).toBeDisabled();

      // Provide custom transport
      rerender(
        <PassengerFlow
          passengerTransports={["OUTRO"]}
          passengerTransportsCustom="Bicicleta elétrica"
          passengerDifficulties={["DOR_01"]}
          passengerFairPrice={10}
          passengerIntention="COM_CERTEZA_HOJE"
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerTrustFactorsChange={() => {}}
          onPassengerGenderPreferenceChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />,
      );

      expect(continueBtn).not.toBeDisabled();
    });
  });

  describe("DualFlow (Fluxo 'Os Dois')", () => {
    it("renders the priority question with options and sub-steps", () => {
      render(
        <DualFlow
          dualPriority={undefined}
          onDualPriorityChange={() => {}}
          onTrustFactorsChange={() => {}}
          onGenderPreferenceChange={() => {}}
          onVehicleTypeChange={() => {}}
          onAvailableSeatsChange={() => {}}
          onMaxDetourMinutesChange={() => {}}
          onDriverFutureOfferChange={() => {}}
          onDriverPriceChange={() => {}}
          onDriverBarriersChange={() => {}}
          onDriverBarriersCustomChange={() => {}}
          onDriverRealValidationChange={() => {}}
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {}}
          onBack={() => {}}
        />,
      );

      expect(screen.getByText(/Qual é a sua prioridade hoje\?/i)).toBeInTheDocument();
      expect(screen.getByText("Oferecer")).toBeInTheDocument();
      expect(screen.getByText("Pegar")).toBeInTheDocument();
      expect(screen.getByText("Quero avaliar os dois")).toBeInTheDocument();
    });

    it("progresses through DualFlow sub-steps and triggers onNext", () => {
      let nextCalled = false;

      const { rerender } = render(
        <DualFlow
          dualPriority="AMBOS_AVALIAR"
          vehicleType="CARRO_PROPRIO"
          availableSeats={2}
          driverPrice={10}
          driverRealValidation="COM_CERTEZA"
          passengerFairPrice={10}
          passengerIntention="COM_CERTEZA_HOJE"
          onDualPriorityChange={() => {}}
          onTrustFactorsChange={() => {}}
          onGenderPreferenceChange={() => {}}
          onVehicleTypeChange={() => {}}
          onAvailableSeatsChange={() => {}}
          onMaxDetourMinutesChange={() => {}}
          onDriverFutureOfferChange={() => {}}
          onDriverPriceChange={() => {}}
          onDriverBarriersChange={() => {}}
          onDriverBarriersCustomChange={() => {}}
          onDriverRealValidationChange={() => {}}
          onPassengerTransportsChange={() => {}}
          onPassengerTransportsCustomChange={() => {}}
          onPassengerDifficultiesChange={() => {}}
          onPassengerDifficultiesCustomChange={() => {}}
          onPassengerFairPriceChange={() => {}}
          onPassengerBarriersChange={() => {}}
          onPassengerBarriersCustomChange={() => {}}
          onPassengerIntentionChange={() => {}}
          onNext={() => {
            nextCalled = true;
          }}
          onBack={() => {}}
        />,
      );

      const continueBtn = screen.getByRole("button", { name: /Continuar/i });
      expect(continueBtn).not.toBeDisabled();
      fireEvent.click(continueBtn);

      // Sub-etapa 2: Confiança
      expect(screen.getByText(/O que te dá mais segurança e confiança\?/i)).toBeInTheDocument();
      fireEvent.click(continueBtn);

      // Sub-etapa 3: Compensação
      expect(screen.getByText(/Compensação justa por passageiro/i)).toBeInTheDocument();
      fireEvent.click(continueBtn);

      // Sub-etapa 4: Validação real
      expect(screen.getByText(/Validação real para o Siará Tech Summit/i)).toBeInTheDocument();
      const advanceBtn = screen.getByRole("button", { name: /Avançar para contato/i });
      expect(advanceBtn).not.toBeDisabled();
      fireEvent.click(advanceBtn);
      expect(nextCalled).toBe(true);
    });
  });

  describe("Step navigation and validation rules", () => {
    it("routes PASSAGEIRO intent through PASSENGER_FLOW", () => {
      const passengerData = { source: "test", intent: "PASSAGEIRO" as const };
      expect(getNextStep("ROUTE_DETAILS", passengerData)).toBe("PROPOSAL_TRANSITION");
      expect(getNextStep("PROPOSAL_TRANSITION", passengerData)).toBe("PASSENGER_FLOW");
      expect(getNextStep("PASSENGER_FLOW", passengerData)).toBe("CONTACT");
      expect(getNextStep("CONTACT", passengerData)).toBe("SUCCESS");

      expect(getPreviousStep("CONTACT", passengerData)).toBe("PASSENGER_FLOW");
      expect(getPreviousStep("PASSENGER_FLOW", passengerData)).toBe("PROPOSAL_TRANSITION");
    });

    it("routes AMBOS intent through BOTH_FLOW", () => {
      const dualData = { source: "test", intent: "AMBOS" as const };
      expect(getNextStep("ROUTE_DETAILS", dualData)).toBe("PROPOSAL_TRANSITION");
      expect(getNextStep("PROPOSAL_TRANSITION", dualData)).toBe("BOTH_FLOW");
      expect(getNextStep("BOTH_FLOW", dualData)).toBe("CONTACT");
      expect(getNextStep("CONTACT", dualData)).toBe("SUCCESS");

      expect(getPreviousStep("CONTACT", dualData)).toBe("BOTH_FLOW");
      expect(getPreviousStep("BOTH_FLOW", dualData)).toBe("PROPOSAL_TRANSITION");
    });

    it("validates PASSENGER_FLOW step in validateFormStep", () => {
      // Invalid
      const res1 = validateFormStep("PASSENGER_FLOW", {
        passengerTransports: [],
        passengerDifficulties: [],
      });
      expect(res1.success).toBe(false);

      // Valid
      const res2 = validateFormStep("PASSENGER_FLOW", {
        passengerTransports: ["UBER_99"],
        passengerDifficulties: ["DOR_01"],
        passengerFairPrice: 12.5,
        passengerIntention: "COM_CERTEZA_HOJE",
      });
      expect(res2.success).toBe(true);
    });

    it("validates BOTH_FLOW step in validateFormStep", () => {
      // Missing dualPriority
      const res1 = validateFormStep("BOTH_FLOW", {
        vehicleType: "CARRO_PROPRIO",
        availableSeats: 2,
        driverPrice: 10,
        driverRealValidation: "COM_CERTEZA",
        passengerTransports: ["UBER_99"],
        passengerDifficulties: ["DOR_01"],
        passengerFairPrice: 10,
        passengerIntention: "COM_CERTEZA_HOJE",
      });
      expect(res1.success).toBe(false);

      // Complete
      const res2 = validateFormStep("BOTH_FLOW", {
        dualPriority: "AMBOS_AVALIAR",
        vehicleType: "CARRO_PROPRIO",
        availableSeats: 2,
        driverPrice: 10,
        driverRealValidation: "COM_CERTEZA",
        passengerTransports: ["UBER_99"],
        passengerDifficulties: ["DOR_01"],
        passengerFairPrice: 10,
        passengerIntention: "COM_CERTEZA_HOJE",
      });
      expect(res2.success).toBe(true);
    });
  });
});
