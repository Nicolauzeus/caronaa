import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ContactStep } from "@/components/formulario/ContactStep";
import { FormSuccess } from "@/components/formulario/FormSuccess";
import { validateFormStep } from "@/lib/formulario/schema";
import { prepareSubmission, sanitizeSubmissionRawPayload } from "@/lib/formulario/submission";
import type { CaronaaStsFormData } from "@/lib/formulario/types";

// Mock TanStack router Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    target,
    rel,
    className,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} target={target} rel={rel} className={className}>
      {children}
    </a>
  ),
}));

describe("ContactStep and FormSuccess", () => {
  it("renders ContactStep with required fields, briefing placeholder, and disabled submit button", () => {
    let nextCalled = false;
    let nameVal = "";
    let whatsappVal = "";
    let feedbackVal = "";
    let termsChecked = false;
    let privacyChecked = false;

    const { rerender } = render(
      <ContactStep
        name=""
        whatsapp=""
        email=""
        feedback=""
        termsAccepted={false}
        privacyAccepted={false}
        researchAccepted={true}
        onNameChange={(val) => {
          nameVal = val;
        }}
        onWhatsappChange={(val) => {
          whatsappVal = val;
        }}
        onEmailChange={() => {}}
        onFeedbackChange={(val) => {
          feedbackVal = val;
        }}
        onTermsAcceptedChange={(val) => {
          termsChecked = val;
        }}
        onPrivacyAcceptedChange={(val) => {
          privacyChecked = val;
        }}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    // Labels e campos
    expect(screen.getByLabelText(/Como prefere ser chamado\? \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/WhatsApp para contato \*/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/E-mail institucional ou pessoal \(opcional\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Comentário ou sugestão \*/i)).toBeInTheDocument();

    // Placeholder do briefing
    const feedbackInput = screen.getByPlaceholderText(
      /Alguma dúvida, sugestão ou detalhe sobre seu trajeto\? Conte aqui para a nossa equipe\.\.\./i,
    );
    expect(feedbackInput).toBeInTheDocument();

    // Seção "Antes de continuar" e checkboxes
    expect(screen.getByText(/Antes de continuar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Li e concordo com os Termos de Uso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Concordo com a Política de Privacidade/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Aceito receber pesquisas de validação e novidades/i),
    ).toBeInTheDocument();

    // Links de termos, privacidade e segurança com target="_blank"
    const termosLink = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termosLink).toHaveAttribute("target", "_blank");
    expect(termosLink).toHaveAttribute("href", "/termos");

    const privacidadeLink = screen.getByRole("link", { name: /Política de Privacidade/i });
    expect(privacidadeLink).toHaveAttribute("target", "_blank");
    expect(privacidadeLink).toHaveAttribute("href", "/privacidade");

    const segurancaLink = screen.getByRole("link", { name: /Segurança e responsabilidades/i });
    expect(segurancaLink).toHaveAttribute("target", "_blank");
    expect(segurancaLink).toHaveAttribute("href", "/seguranca");

    // Bloco transparência
    expect(screen.getByText(/Transparência e responsabilidade:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma carona é garantida antecipadamente nem iniciada automaticamente/i),
    ).toBeInTheDocument();

    // Botão desabilitado inicialmente
    const submitBtn = screen.getByRole("button", { name: /Concluir e procurar combinação/i });
    expect(submitBtn).toBeDisabled();

    // Re-renderizar com dados completos válidos
    rerender(
      <ContactStep
        name="Maria Clara"
        whatsapp="85999998888"
        email="maria@exemplo.com"
        feedback="Posso pegar pessoas perto do shopping Iguatemi."
        termsAccepted={true}
        privacyAccepted={true}
        researchAccepted={true}
        onNameChange={() => {}}
        onWhatsappChange={() => {}}
        onEmailChange={() => {}}
        onFeedbackChange={() => {}}
        onTermsAcceptedChange={() => {}}
        onPrivacyAcceptedChange={() => {}}
        onNext={() => {
          nextCalled = true;
        }}
        onBack={() => {}}
      />,
    );

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);
    expect(nextCalled).toBe(true);
  });

  it("validates CONTACT step with validateFormStep correctly", () => {
    const invalidResult = validateFormStep("CONTACT", {
      name: "A",
      whatsapp: "123",
      feedback: "",
      termsAccepted: false,
      privacyAccepted: false,
    });

    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success && "errors" in invalidResult) {
      expect(invalidResult.errors.name).toMatch(/Informe como prefere ser chamado/i);
      expect(invalidResult.errors.whatsapp).toMatch(/WhatsApp válido com DDD/i);
      expect(invalidResult.errors.feedback).toMatch(/Deixe seu comentário, dúvida ou sugestão/i);
      expect(invalidResult.errors.termsAccepted).toMatch(/Termos de Uso/i);
      expect(invalidResult.errors.privacyAccepted).toMatch(/Política de Privacidade/i);
    }

    const validResult = validateFormStep("CONTACT", {
      name: "João Silva",
      whatsapp: "85988887777",
      feedback: "Tudo ótimo com a proposta.",
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(validResult.success).toBe(true);
  });

  it("renders FormSuccess with MOTORISTA specific messaging and CTAs", () => {
    const mockDriverData: CaronaaStsFormData = {
      source: "sts2026",
      intent: "MOTORISTA",
      destinationNeighborhood: "Aldeota",
      originNeighborhood: "Centro de Eventos do Ceará",
      departureWindow: "21_22",
      name: "Carlos Motorista",
      whatsapp: "85999991111",
      driverPrice: 15.0,
      feedback: "Carro confortável com ar-condicionado.",
      termsAccepted: true,
      privacyAccepted: true,
    };

    render(<FormSuccess data={mockDriverData} />);

    // Perfil Motorista
    expect(screen.getByText(/🚗 Motorista cadastrado • STS 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/🚗 Oferta de carona registrada!/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Recebemos sua oferta de carona! Mapearemos passageiros cujo trajeto e horário coincidam/i,
      ),
    ).toBeInTheDocument();

    // Disclaimer honesto sem promessas
    expect(screen.getByText(/não prometemos carona confirmada ou garantida/i)).toBeInTheDocument();

    // CTAs exigidos
    const signupCta = screen.getByRole("link", { name: /Quero criar minha conta/i });
    expect(signupCta).toHaveAttribute("href", "/auth");

    const loginCta = screen.getByRole("link", { name: /Já tenho uma conta/i });
    expect(loginCta).toHaveAttribute("href", "/auth");

    const backCta = screen.getByRole("link", { name: /Voltar ao início/i });
    expect(backCta).toHaveAttribute("href", "/");
  });

  it("renders FormSuccess with PASSAGEIRO specific messaging and CTAs", () => {
    const mockPassengerData: CaronaaStsFormData = {
      source: "sts2026",
      intent: "PASSAGEIRO",
      destinationNeighborhood: "Meireles",
      originNeighborhood: "Centro de Eventos do Ceará",
      departureWindow: "20_21",
      name: "Ana Passageira",
      whatsapp: "85988882222",
      passengerFairPrice: 10.0,
      passengerCount: 1,
      feedback: "Prefiro motoristas verificados.",
      termsAccepted: true,
      privacyAccepted: true,
    };

    render(<FormSuccess data={mockPassengerData} />);

    // Perfil Passageiro
    expect(screen.getByText(/🙋 Passageiro cadastrado • STS 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/🙋 Interesse em carona registrado!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Recebemos sua solicitação de carona! Mapearemos motoristas credenciados/i),
    ).toBeInTheDocument();

    // Disclaimer honesto
    expect(
      screen.getByText(/não prometemos carona encontrada, confirmada ou garantida/i),
    ).toBeInTheDocument();

    // CTAs
    expect(screen.getByRole("link", { name: /Quero criar minha conta/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Já tenho uma conta/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Voltar ao início/i })).toHaveAttribute("href", "/");
  });

  it("renders FormSuccess with AMBOS specific messaging and CTAs", () => {
    const mockDualData: CaronaaStsFormData = {
      source: "sts2026",
      intent: "AMBOS",
      destinationNeighborhood: "Papicu",
      originNeighborhood: "Centro de Eventos do Ceará",
      departureWindow: "21_22",
      name: "Felipe Flexível",
      whatsapp: "85977773333",
      driverPrice: 12.0,
      feedback: "Tanto faz oferecer ou pegar carona.",
      termsAccepted: true,
      privacyAccepted: true,
    };

    render(<FormSuccess data={mockDualData} />);

    // Perfil Ambos
    expect(screen.getByText(/🔄 Motorista & Passageiro • STS 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/🔄 Disponibilidade registrada!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Recebemos seu interesse duplo! Analisaremos tanto oportunidades/i),
    ).toBeInTheDocument();

    // CTAs
    expect(screen.getByRole("link", { name: /Quero criar minha conta/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Já tenho uma conta/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Voltar ao início/i })).toHaveAttribute("href", "/");
  });

  it("prepares submission with separate structured consents and keeps them in raw_payload for Supabase", () => {
    const formData: CaronaaStsFormData = {
      source: "sts2026",
      campaign: "evento-sts",
      intent: "PASSAGEIRO",
      destinationNeighborhood: "Aldeota",
      originNeighborhood: "Centro de Eventos",
      departureWindow: "21_22",
      occupation: "ESTUDANTE",
      weeklyFrequency: "1_2",
      name: "Mariana Lima",
      whatsapp: "(85) 99999-0000",
      email: "mariana@gmail.com",
      feedback: "Gostaria de carona para voltar depois do encerramento.",
      termsAccepted: true,
      privacyAccepted: true,
      researchAccepted: false,
      termsVersion: "sts_2026_v1",
      consentsTimestamp: "2026-10-06T00:00:00.000Z",
    };

    const submission = prepareSubmission(formData);

    expect(submission.name).toBe("Mariana Lima");
    expect(submission.whatsapp).toBe("85999990000");
    expect(submission.email).toBe("mariana@gmail.com");
    expect(submission.feedback).toBe("Gostaria de carona para voltar depois do encerramento.");
    expect(submission.termsAccepted).toBe(true);
    expect(submission.privacyAccepted).toBe(true);
    expect(submission.researchAccepted).toBe(false);
    expect(submission.termsVersion).toBe("sts_2026_v1");
    expect(submission.consentsTimestamp).toBe("2026-10-06T00:00:00.000Z");

    const rawPayload = sanitizeSubmissionRawPayload(submission);

    // Consentimentos estruturados presentes separadamente no rawPayload para persistência JSONB
    expect(rawPayload.feedback).toBe("Gostaria de carona para voltar depois do encerramento.");
    expect(rawPayload.termsAccepted).toBe(true);
    expect(rawPayload.privacyAccepted).toBe(true);
    expect(rawPayload.researchAccepted).toBe(false);
    expect(rawPayload.termsVersion).toBe("sts_2026_v1");
    expect(rawPayload.consentsTimestamp).toBe("2026-10-06T00:00:00.000Z");
  });

  it("blocks submission if either mandatory consent is missing (Item 8)", () => {
    // Only terms accepted, privacy missing
    const missingPrivacy = validateFormStep("CONTACT", {
      name: "Lucas",
      whatsapp: "85999991234",
      feedback: "Sem observações adicionais.",
      termsAccepted: true,
      privacyAccepted: false,
    });
    expect(missingPrivacy.success).toBe(false);
    if (!missingPrivacy.success && "errors" in missingPrivacy) {
      expect(missingPrivacy.errors.privacyAccepted).toMatch(/Política de Privacidade/i);
    }

    // Only privacy accepted, terms missing
    const missingTerms = validateFormStep("CONTACT", {
      name: "Lucas",
      whatsapp: "85999991234",
      feedback: "Sem observações adicionais.",
      termsAccepted: false,
      privacyAccepted: true,
    });
    expect(missingTerms.success).toBe(false);
    if (!missingTerms.success && "errors" in missingTerms) {
      expect(missingTerms.errors.termsAccepted).toMatch(/Termos de Uso/i);
    }
  });

  it("persists form draft so user can navigate to /termos or /privacidade and return without losing data (Item 9)", async () => {
    const { saveFormDraft, loadFormDraft, clearFormDraft } =
      await import("@/lib/formulario/draft-storage");

    clearFormDraft();

    const sampleData: Partial<CaronaaStsFormData> = {
      name: "Bárbara Santos",
      whatsapp: "85988884444",
      destinationNeighborhood: "Pajuçara, Maracanaú",
      departureWindow: "21_22",
      feedback: "Voltando do evento à noite",
      termsAccepted: true,
    };

    saveFormDraft(sampleData, "CONTACT");

    const reloaded = loadFormDraft();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.step).toBe("CONTACT");
    expect(reloaded?.data.name).toBe("Bárbara Santos");
    expect(reloaded?.data.whatsapp).toBe("85988884444");
    expect(reloaded?.data.destinationNeighborhood).toBe("Pajuçara, Maracanaú");
    expect(reloaded?.data.feedback).toBe("Voltando do evento à noite");
    expect(reloaded?.data.termsAccepted).toBe(true);

    clearFormDraft();
  });

  it("correctly handles destinations like Maracanaú, Pajuçara, Parangaba and specific addresses (Item 4-7)", () => {
    const destinations = [
      "Maracanaú",
      "Pajuçara, Maracanaú",
      "Parangaba, Fortaleza",
      "Rua 10, 250 - Pajuçara, Maracanaú",
      "Avenida Washington Soares, 1321 - Edson Queiroz",
    ];

    for (const dest of destinations) {
      const stepVal = validateFormStep("PROFILE_ROUTE", {
        intent: "PASSAGEIRO",
        occupation: "ESTUDANTE",
        originNeighborhood: "Centro de Eventos do Ceará",
        destinationNeighborhood: dest,
        weeklyFrequency: "1_2",
        departureWindow: "21_22",
      });

      expect(stepVal.success).toBe(true);
    }
  });

  it("verifies funnel analytics events are properly typed and tracked (Item 11)", async () => {
    const { trackFunnelEvent } = await import("@/lib/funnel-events");

    // Test tracking contact completed
    await expect(
      trackFunnelEvent({
        eventName: "form_contact_completed",
        source: "sts2026",
        campaign: null,
        campaignEvent: "Siará Tech Summit 2026",
        formStep: "CONTACT",
      }),
    ).resolves.not.toThrow();

    // Test tracking terms accepted
    await expect(
      trackFunnelEvent({
        eventName: "form_terms_accepted",
        source: "sts2026",
        campaign: null,
        campaignEvent: "Siará Tech Summit 2026",
        formStep: "CONTACT",
      }),
    ).resolves.not.toThrow();

    // Test tracking form completed
    await expect(
      trackFunnelEvent({
        eventName: "form_completed",
        source: "sts2026",
        campaign: null,
        campaignEvent: "Siará Tech Summit 2026",
        submissionId: "test-sub-123",
      }),
    ).resolves.not.toThrow();
  });
});
