import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { InstitutionalHeader } from "@/components/formulario/InstitutionalHeader";

describe("InstitutionalHeader Component", () => {
  it("renders CARONAA as main brand, Unifor Hub ecosystem, and STS 2026 exhibition context", () => {
    render(<InstitutionalHeader variant="light" />);

    // 1. Marca Principal
    expect(screen.getByAltText("CARONAA")).toBeInTheDocument();

    // 2. Ecossistema
    expect(screen.getByText("Startup do Unifor Hub")).toBeInTheDocument();

    // 3. Contexto do Evento
    expect(screen.getByText("Expositora no Siará Tech Summit 2026")).toBeInTheDocument();

    // 4. Apoio / Realização do Evento
    expect(screen.getByText(/Realização Sebrae/i)).toBeInTheDocument();
  });

  it("renders progress and step counter when showProgress is true", () => {
    render(
      <InstitutionalHeader
        variant="sticky"
        showProgress
        progress={50}
        currentStep={3}
        totalSteps={6}
      />,
    );

    expect(screen.getByText(/50% concluído • Etapa 3 de 6/i)).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
  });

  it("displays final step indicator properly", () => {
    render(
      <InstitutionalHeader
        variant="sticky"
        showProgress
        progress={100}
        currentStep={6}
        totalSteps={6}
        isFinalStep
      />,
    );

    expect(screen.getByText(/100% concluído • Etapa Final \(6\/6\)/i)).toBeInTheDocument();
  });
});
