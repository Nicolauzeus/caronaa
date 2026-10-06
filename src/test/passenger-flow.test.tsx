import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { PassengerFlow } from "@/components/formulario/PassengerFlow";
import { DualFlow } from "@/components/formulario/DualFlow";
import { validateFormStep } from "@/lib/formulario/schema";
import { getNextStep, getPreviousStep } from "@/lib/formulario/flow";

describe("PassengerFlow and DualFlow", () => {
  describe("PassengerFlow", () => {
    it("renders all 6 items in the exact required order", () => {
      render(
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
          onNext={() => {}}
          onBack={() => {}}
        />,
      );

      // Item 1: Como se desloca hoje
      expect(
        screen.getByText(/1\. Como você costuma se deslocar hoje para trajetos como esse\?/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Aplicativos \(Uber \/ 99\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ônibus convencional/i)).toBeInTheDocument();

      // Item 2: Maior dificuldade
      expect(
        screen.getByText(/2\. Quais as maiores dificuldades que você enfrenta no deslocamento\?/i),
      ).toBeInTheDocument();

      // Item 3: Confiança
      expect(
        screen.getByText(/3\. O que traria confiança para você pegar uma carona\?/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Aviso de transparência e segurança/i)).toBeInTheDocument();
      expect(
        screen.getByText(/não constituem garantia absoluta de segurança/i),
      ).toBeInTheDocument();

      // Item 4: Valor justo a pagar
      expect(
        screen.getByText(/4\. Quanto você consideraria justo pagar pelo trajeto\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/R\$ 3,50 é nossa referência mínima para validação/i),
      ).toBeInTheDocument();

      // Item 5: Barreiras
      expect(
        screen.getByText(/5\. O que mais te faria hesitar em pegar uma carona\?/i),
      ).toBeInTheDocument();

      // Item 6: Intenção
      expect(
        screen.getByText(
          /6\. Se houver alguém compatível com o seu trajeto hoje, você pegaria essa carona\?/i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/Com certeza, posso precisar hoje\./i)).toBeInTheDocument();
      expect(screen.getByText(/Talvez\./i)).toBeInTheDocument();
      expect(screen.getByText(/Com certeza — e não apenas hoje\./i)).toBeInTheDocument();
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

    it("enforces fair price between R$ 3,50 and R$ 25,00", () => {
      const { rerender } = render(
        <PassengerFlow
          passengerTransports={["UBER_99"]}
          passengerDifficulties={["DOR_01"]}
          passengerFairPrice={2.0} // Below min
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

      expect(screen.getByRole("button", { name: /Continuar/i })).toBeDisabled();
      expect(screen.getByText(/O valor mínimo permitido é de R\$ 3,50/i)).toBeInTheDocument();

      rerender(
        <PassengerFlow
          passengerTransports={["UBER_99"]}
          passengerDifficulties={["DOR_01"]}
          passengerFairPrice={30.0} // Above max
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

      expect(screen.getByRole("button", { name: /Continuar/i })).toBeDisabled();
      expect(screen.getByText(/O valor máximo permitido é de R\$ 25,00/i)).toBeInTheDocument();
    });

    it("displays gender preference as confidential personal data when selected", () => {
      render(
        <PassengerFlow
          passengerTransports={["UBER_99"]}
          passengerDifficulties={["DOR_01"]}
          passengerTrustFactors={["MESMO_GENERO"]}
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

      expect(
        screen.getByText(/Qual gênero você gostaria de considerar\? \(Opcional\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Dado pessoal protegido:/i)).toBeInTheDocument();
    });
  });

  describe("DualFlow (Fluxo 'Os Dois')", () => {
    it("renders the priority question first with exact options", () => {
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

      const priorityGroup = screen.getByRole("radiogroup", {
        name: /Prioridade entre oferecer e pegar/i,
      });
      expect(priorityGroup).toBeInTheDocument();
      expect(within(priorityGroup).getByText("Oferecer")).toBeInTheDocument();
      expect(within(priorityGroup).getByText("Pegar")).toBeInTheDocument();
      expect(within(priorityGroup).getByText("Quero avaliar os dois")).toBeInTheDocument();
    });

    it("shares trust factors and asks driver and passenger specifics without duplicate questions", () => {
      render(
        <DualFlow
          dualPriority="AMBOS_AVALIAR"
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

      // Unified trust section
      expect(screen.getByText(/Confiança e Segurança Unificada/i)).toBeInTheDocument();
      // Driver section
      expect(screen.getByText(/Para quando você for motorista/i)).toBeInTheDocument();
      expect(screen.getByText(/Qual veículo você tem disponível\? \*/i)).toBeInTheDocument();
      expect(screen.getByText(/Vagas disponíveis para oferecer: \*/i)).toBeInTheDocument();

      // Passenger section
      expect(screen.getByText(/Para quando você for passageiro/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Como costuma se deslocar hoje para trajetos como esse\? \*/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Maiores dificuldades que enfrenta no deslocamento: \*/i),
      ).toBeInTheDocument();

      // Does NOT ask route/neighborhoods or occupation (those belong only to step 1)
      expect(screen.queryByText(/Informe seu perfil/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bairro de origem/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Destino/i)).not.toBeInTheDocument();
    });

    it("enables continue button only when both driver and passenger required fields are filled", () => {
      let nextCalled = false;

      const { rerender } = render(
        <DualFlow
          dualPriority="AMBOS_AVALIAR"
          vehicleType="CARRO_PROPRIO"
          availableSeats={2}
          driverPrice={10}
          driverRealValidation="COM_CERTEZA"
          passengerTransports={[]} // Incomplete passenger
          passengerDifficulties={[]}
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
      expect(continueBtn).toBeDisabled();

      // Complete passenger fields
      rerender(
        <DualFlow
          dualPriority="AMBOS_AVALIAR"
          vehicleType="CARRO_PROPRIO"
          availableSeats={2}
          driverPrice={10}
          driverRealValidation="COM_CERTEZA"
          passengerTransports={["UBER_99"]}
          passengerDifficulties={["DOR_01"]}
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

      expect(continueBtn).not.toBeDisabled();
      fireEvent.click(continueBtn);
      expect(nextCalled).toBe(true);
    });
  });

  describe("Step navigation and validation rules", () => {
    it("routes PASSAGEIRO intent through PASSENGER_FLOW", () => {
      const passengerData = { source: "test", intent: "PASSAGEIRO" as const };
      expect(getNextStep("PROFILE_ROUTE", passengerData)).toBe("PROPOSAL_TRANSITION");
      expect(getNextStep("PROPOSAL_TRANSITION", passengerData)).toBe("PASSENGER_FLOW");
      expect(getNextStep("PASSENGER_FLOW", passengerData)).toBe("CONTACT");
      expect(getNextStep("CONTACT", passengerData)).toBe("SUCCESS");

      expect(getPreviousStep("CONTACT", passengerData)).toBe("PASSENGER_FLOW");
      expect(getPreviousStep("PASSENGER_FLOW", passengerData)).toBe("PROPOSAL_TRANSITION");
    });

    it("routes AMBOS intent through BOTH_FLOW", () => {
      const dualData = { source: "test", intent: "AMBOS" as const };
      expect(getNextStep("PROFILE_ROUTE", dualData)).toBe("PROPOSAL_TRANSITION");
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
