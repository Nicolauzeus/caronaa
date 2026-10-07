import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormSuccess } from "@/components/formulario/FormSuccess";
import type { CaronaaStsFormData } from "@/lib/formulario/types";
import {
  saveFormConversionDraft,
  getFormConversionDraft,
  clearFormConversionDraft,
  FORM_CONVERSION_STORAGE_KEY,
} from "@/lib/formulario/conversion";
import * as funnelEvents from "@/lib/funnel-events";
import * as authContext from "@/lib/auth-context";

// Mock router link
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    onClick,
    className,
  }: {
    to: string;
    search?: Record<string, unknown>;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => {
    const searchString = search
      ? "?" + new URLSearchParams(search as Record<string, string>).toString()
      : "";
    return (
      <a href={`${to}${searchString}`} onClick={onClick} className={className}>
        {children}
      </a>
    );
  },
}));

describe("Form to Account Conversion Flow", () => {
  const trackFunnelEventSpy = vi.spyOn(funnelEvents, "trackFunnelEvent").mockResolvedValue();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const mockFormData: CaronaaStsFormData = {
    source: "sts-2026",
    campaign: "sts_meta_ads",
    campaignEvent: "Siará Tech Summit 2026",
    submissionId: "sub-12345-sts",
    intent: "MOTORISTA",
    originNeighborhood: "Centro de Eventos do Ceará",
    destinationNeighborhood: "Aldeota",
    departureWindow: "18_19",
    name: "Carlos Motorista",
    whatsapp: "85999998888",
    email: "carlos@exemplo.com",
    availableSeats: 3,
    driverPrice: 15.0,
    driverGenderPreference: "FEMININO",
    driverComfortFactors: ["AR_CONDICIONADO", "MUSICA_BAIXA"],
    termsAccepted: true,
    privacyAccepted: true,
  };

  it("stores and retrieves conversion payload cleanly without duplication", () => {
    saveFormConversionDraft(mockFormData);

    const stored = getFormConversionDraft();
    expect(stored).not.toBeNull();
    expect(stored?.submissionId).toBe("sub-12345-sts");
    expect(stored?.name).toBe("Carlos Motorista");
    expect(stored?.whatsapp).toBe("85999998888");
    expect(stored?.email).toBe("carlos@exemplo.com");
    expect(stored?.intent).toBe("MOTORISTA");
    expect(stored?.originNeighborhood).toBe("Centro de Eventos do Ceará");
    expect(stored?.destinationNeighborhood).toBe("Aldeota");
    expect(stored?.departureWindow).toBe("18_19");
    expect(stored?.preferences?.genderPreference).toBe("FEMININO");
    expect(stored?.preferences?.driverSeats).toBe(3);
    expect(stored?.preferences?.comfortFactors).toEqual(["AR_CONDICIONADO", "MUSICA_BAIXA"]);

    clearFormConversionDraft();
    expect(getFormConversionDraft()).toBeNull();
  });

  it("renders authenticated state: displays association message and 'Continuar no aplicativo' CTA", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: { id: "user-abc-123", email: "carlos@exemplo.com" } as never,
      loading: false,
      signOut: vi.fn(),
    });

    render(<FormSuccess data={mockFormData} />);

    // Mensagem de associação exigida
    expect(screen.getByText(/Seu cadastro foi associado à sua conta CARONAA/i)).toBeInTheDocument();

    // CTA de continuação
    const continueBtn = screen.getByRole("link", { name: /Continuar no aplicativo/i });
    expect(continueBtn).toBeInTheDocument();
    expect(continueBtn).toHaveAttribute("href", "/home");

    // Eventos disparados: form_success e form_to_account_conversion
    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "form_success",
        userId: "user-abc-123",
        submissionId: "sub-12345-sts",
      }),
    );

    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "form_to_account_conversion",
        userId: "user-abc-123",
        submissionId: "sub-12345-sts",
        metadata: expect.objectContaining({
          conversionType: "already_authenticated",
        }),
      }),
    );

    // Clicar no botão aciona account_cta_clicked
    fireEvent.click(continueBtn);
    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "account_cta_clicked",
        userId: "user-abc-123",
        submissionId: "sub-12345-sts",
        metadata: expect.objectContaining({
          action: "continue_to_app",
        }),
      }),
    );
  });

  it("renders unauthenticated state: offers 'Quero criar minha conta' and 'Já tenho uma conta'", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(<FormSuccess data={mockFormData} />);

    // Verifica que rascunho de conversão foi gravado para consumo da tela /auth
    const stored = getFormConversionDraft();
    expect(stored?.submissionId).toBe("sub-12345-sts");
    expect(stored?.name).toBe("Carlos Motorista");

    // CTA 1: "Quero criar minha conta"
    const signupBtn = screen.getByRole("link", { name: /Quero criar minha conta/i });
    expect(signupBtn).toBeInTheDocument();
    expect(signupBtn.getAttribute("href")).toContain("/auth?mode=cadastro");
    expect(signupBtn.getAttribute("href")).toContain("submissionId=sub-12345-sts");

    // CTA 2: "Já tenho uma conta"
    const loginBtn = screen.getByRole("link", { name: /Já tenho uma conta/i });
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn.getAttribute("href")).toContain("/auth?mode=entrar");
    expect(loginBtn.getAttribute("href")).toContain("submissionId=sub-12345-sts");

    // Verifica disparo de form_success com authenticated: false
    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "form_success",
        userId: null,
        submissionId: "sub-12345-sts",
      }),
    );

    // Clicar em "Quero criar minha conta" dispara account_cta_clicked (signup)
    fireEvent.click(signupBtn);
    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "account_cta_clicked",
        userId: null,
        submissionId: "sub-12345-sts",
        metadata: expect.objectContaining({
          action: "signup",
        }),
      }),
    );

    // Clicar em "Já tenho uma conta" dispara account_cta_clicked (login)
    fireEvent.click(loginBtn);
    expect(trackFunnelEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "account_cta_clicked",
        userId: null,
        submissionId: "sub-12345-sts",
        metadata: expect.objectContaining({
          action: "login",
        }),
      }),
    );
  });
});
