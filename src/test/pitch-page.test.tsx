import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock TanStack router
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { PitchLandingPage } from "@/routes/pitch";
import * as pitchService from "@/lib/pitch/pitch-service";

describe("Pitch Landing Page & Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the main headline, subtitle and the three interest choices", () => {
    render(<PitchLandingPage />);

    expect(screen.getByText("Vamos construir a próxima fase juntos?")).toBeInTheDocument();
    expect(screen.getByText(/A CARONAA está começando sua fase de validação/i)).toBeInTheDocument();

    expect(screen.getByText("Quero acompanhar como possível investidor")).toBeInTheDocument();
    expect(screen.getByText("Quero conversar sobre uma parceria")).toBeInTheDocument();
    expect(screen.getByText("Quero os dois")).toBeInTheDocument();
  });

  it("shows investor fields when 'INVESTIDOR' is clicked", () => {
    render(<PitchLandingPage />);

    const investorBtn = screen.getByText("Quero acompanhar como possível investidor");
    fireEvent.click(investorBtn);

    expect(
      screen.getByText(
        "Quero acompanhar os resultados da fase de validação e conversar sobre a próxima etapa da CARONAA.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Quero acompanhar durante a validação")).toBeInTheDocument();
    expect(screen.getByText("Quero conversar diretamente com a equipe")).toBeInTheDocument();
  });

  it("shows partner fields when 'PARCEIRO' is clicked", () => {
    render(<PitchLandingPage />);

    const partnerBtn = screen.getByText("Quero conversar sobre uma parceria");
    fireEvent.click(partnerBtn);

    expect(screen.getByText(/Queremos levar a CARONAA para instituições/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Nome da instituição, empresa ou universidade/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Quero testar a CARONAA na instituição e que outros se beneficiem"),
    ).toBeInTheDocument();
  });

  it("toggles the phone field when same_phone_whatsapp checkbox is unselected", () => {
    render(<PitchLandingPage />);

    const checkbox = screen.getByLabelText("Meu WhatsApp é o mesmo número para ligação");
    expect(checkbox).toBeChecked();
    expect(screen.queryByLabelText("Telefone para ligação *")).not.toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByLabelText(/Telefone para ligação/i)).toBeInTheDocument();
  });

  it("validates mandatory fields on submit and displays error messages", async () => {
    render(<PitchLandingPage />);

    const submitBtn = screen.getByRole("button", {
      name: /Quero acompanhar a CARONAA/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Selecione como gostaria de acompanhar a CARONAA."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Informe seu nome completo com pelo menos 3 letras."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Informe um número de WhatsApp válido com DDD (ex: (85) 99999-9999)."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Por favor, escreva sua mensagem ou sugestão (mínimo 3 caracteres)."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("É necessário concordar com o contato para prosseguirmos."),
      ).toBeInTheDocument();
    });
  });

  it("submits successfully and reveals the post-submission success view and Instagram CTA", async () => {
    const saveSpy = vi.spyOn(pitchService, "savePitchContact").mockResolvedValue({
      success: true,
      data: {
        id: "test-123",
        created_at: new Date().toISOString(),
        interest: "INVESTIDOR",
        name: "Carlos Investidor",
        whatsapp: "(85) 99999-8888",
        phone: "(85) 99999-8888",
        same_phone_whatsapp: true,
        email: "carlos@fundo.com.br",
        investor_update_preference: "DURANTE_VALIDACAO",
        institution_name: null,
        institution_type: null,
        institution_address: null,
        partnership_type: null,
        partnership_type_custom: null,
        message: "Gostei muito da proposta no pitch!",
        consent_contact: true,
        consent_newsletter: true,
        status: "NOVO",
        suggestion_status: "NOVA",
        notes: null,
        source: "pitch_sts_2026",
      },
    });

    render(<PitchLandingPage />);

    // 1. Select interest
    fireEvent.click(screen.getByText("Quero acompanhar como possível investidor"));

    // 2. Fill base fields
    fireEvent.change(screen.getByLabelText(/^Nome completo/i), {
      target: { value: "Carlos Investidor" },
    });
    fireEvent.change(screen.getByPlaceholderText("(85) 99999-9999"), {
      target: { value: "(85) 99999-8888" },
    });
    fireEvent.change(screen.getByPlaceholderText("contato@empresa.com.br"), {
      target: { value: "carlos@fundo.com.br" },
    });

    // 3. Select investor preference
    fireEvent.click(screen.getByText("Quero acompanhar durante a validação"));

    // 4. Fill message
    fireEvent.change(screen.getByLabelText(/Existe algo que você gostaria de nos dizer/i), {
      target: { value: "Gostei muito da proposta no pitch!" },
    });

    // 5. Consent checkbox
    fireEvent.click(screen.getByLabelText(/Concordo que a CARONAA utilize meus dados de contato/i));

    // 6. Submit
    fireEvent.click(screen.getByRole("button", { name: /Quero acompanhar a CARONAA/i }));

    // 7. Verify Success Screen
    await waitFor(() => {
      expect(
        screen.getByText("Obrigado por querer acompanhar a CARONAA! 🚗💛"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Estamos começando a transformar a validação em evidência/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Preencher formulário")).toBeInTheDocument();
      expect(screen.getByText("Já preenchi")).toBeInTheDocument();
    });

    // 8. Click 'Já preenchi' to reveal Instagram CTA
    fireEvent.click(screen.getByText("Já preenchi"));

    expect(screen.getByText("Siga a CARONAA no Instagram")).toBeInTheDocument();
    expect(screen.getByText("Seguir @caronaa.app")).toBeInTheDocument();
    expect(screen.getByText("Já segui")).toBeInTheDocument();

    // 9. Click 'Já segui'
    fireEvent.click(screen.getByText("Já segui"));
    expect(screen.getByText("Conectado 🎉")).toBeInTheDocument();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  describe("Brazilian Phone Validation & Formatting Helpers", () => {
    it("formats 10-digit and 11-digit numbers properly", async () => {
      const { formatBrazilianPhoneNumber } = await import("@/lib/pitch/schema");

      expect(formatBrazilianPhoneNumber("85999998888")).toBe("(85) 99999-8888");
      expect(formatBrazilianPhoneNumber("8533334444")).toBe("(85) 3333-4444");
      expect(formatBrazilianPhoneNumber("85")).toBe("85");
      expect(formatBrazilianPhoneNumber("859")).toBe("(85) 9");
      expect(formatBrazilianPhoneNumber("85999998888999")).toBe("(85) 99999-8888");
    });

    it("validates Brazilian phone numbers with valid DDDs and cell rules", async () => {
      const { isValidBrazilianPhoneNumber } = await import("@/lib/pitch/schema");

      // Valid numbers
      expect(isValidBrazilianPhoneNumber("(85) 99999-8888")).toBe(true);
      expect(isValidBrazilianPhoneNumber("85999998888")).toBe(true);
      expect(isValidBrazilianPhoneNumber("8533334444")).toBe(true);
      expect(isValidBrazilianPhoneNumber("11988887777")).toBe(true);

      // Invalid DDD (00, 05, etc.)
      expect(isValidBrazilianPhoneNumber("00999998888")).toBe(false);
      expect(isValidBrazilianPhoneNumber("05999998888")).toBe(false);

      // Repetitions
      expect(isValidBrazilianPhoneNumber("11111111111")).toBe(false);
      expect(isValidBrazilianPhoneNumber("00000000000")).toBe(false);

      // Wrong length
      expect(isValidBrazilianPhoneNumber("85999")).toBe(false);
      expect(isValidBrazilianPhoneNumber("")).toBe(false);

      // 11 digits without initial 9
      expect(isValidBrazilianPhoneNumber("85888887777")).toBe(false);
    });
  });
});
