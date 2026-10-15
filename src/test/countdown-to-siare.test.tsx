import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  CountdownToSiare,
  getCountdownState,
  STS_START_ISO,
  STS_END_ISO,
  FORTALEZA_TIMEZONE,
} from "@/components/caronaa/CountdownToSiare";

// Mock router link
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("CountdownToSiare Component", () => {
  it("tem o timezone configurado explicitamente para America/Fortaleza", () => {
    expect(FORTALEZA_TIMEZONE).toBe("America/Fortaleza");
    expect(STS_START_ISO).toContain("-03:00");
    expect(STS_END_ISO).toContain("-03:00");
  });

  describe("1. Antes do evento", () => {
    // 24 horas antes do início: 06/10/2026 às 14:00 (UTC-3)
    const beforeNow = new Date("2026-10-06T14:00:00-03:00");

    it("calcula corretamente os dias, horas, minutos e segundos", () => {
      const state = getCountdownState(beforeNow);
      expect(state.status).toBe("before");
      expect(state.days).toBe(1);
      expect(state.hours).toBe(0);
      expect(state.minutes).toBe(0);
      expect(state.seconds).toBe(0);
      expect(state.diffMs).toBeGreaterThan(0);
    });

    it("renderiza 'Faltam', os dígitos DD/HH/MM/SS e 'para o Siará Tech Summit'", () => {
      render(<CountdownToSiare now={beforeNow} />);

      expect(screen.getByText("Faltam")).toBeInTheDocument();
      expect(screen.getByText("para o Siará Tech Summit")).toBeInTheDocument();

      // Checa a presença dos blocos de contagem
      expect(screen.getByText("DD")).toBeInTheDocument();
      expect(screen.getByText("HH")).toBeInTheDocument();
      expect(screen.getByText("MM")).toBeInTheDocument();
      expect(screen.getByText("SS")).toBeInTheDocument();

      // 01 dia restante
      expect(screen.getByText("01")).toBeInTheDocument();
    });
  });

  describe("2. Exatamente no início do evento", () => {
    // Exatamente no momento do início: 07/10/2026 às 14:00 (UTC-3)
    const exactStart = new Date("2026-10-07T14:00:00-03:00");

    it("identifica o status de início com precisão", () => {
      const state = getCountdownState(exactStart);
      expect(state.status).toBe("started");
      expect(state.diffMs).toBe(0);
    });

    it("renderiza '🚀 O Siará Tech Summit começou!'", () => {
      render(<CountdownToSiare now={exactStart} />);

      expect(screen.getByText(/O Siará Tech Summit começou!/i)).toBeInTheDocument();
    });
  });

  describe("3. Durante os dias do evento", () => {
    // Dia 2 do evento: 08/10/2026 às 15:30 (UTC-3)
    const duringNow = new Date("2026-10-08T15:30:00-03:00");

    it("identifica que está durante os dias do evento", () => {
      const state = getCountdownState(duringNow);
      expect(state.status).toBe("during");
    });

    it("renderiza '🚀 Estamos no Siará Tech Summit' com link para /formulario", () => {
      render(<CountdownToSiare now={duringNow} />);

      expect(screen.getByText(/Estamos no Siará Tech Summit/i)).toBeInTheDocument();

      const formLink = screen.getByRole("link", { name: /Participar do formulário/i });
      expect(formLink).toBeInTheDocument();
      expect(formLink).toHaveAttribute("href", "/formulario");
    });
  });

  describe("4. Após o encerramento do evento", () => {
    // Após o término do evento: 10/10/2026 às 08:00 (UTC-3)
    const afterNow = new Date("2026-10-10T08:00:00-03:00");

    it("não calcula contagem regressiva negativa", () => {
      const state = getCountdownState(afterNow);
      expect(state.status).toBe("after");
      expect(state.diffMs).toBe(0);
      expect(state.days).toBe(0);
      expect(state.hours).toBe(0);
    });

    it("substitui por mensagem de encerramento e CTA 'Continuar na CARONAA'", () => {
      render(<CountdownToSiare now={afterNow} />);

      // Não exibe texto de contagem nem números negativos
      expect(screen.queryByText("Faltam")).not.toBeInTheDocument();
      expect(screen.queryByText(/-\d+/)).not.toBeInTheDocument();

      // Exibe mensagem de encerramento
      expect(
        screen.getByText("Obrigado por fazer parte do começo da CARONAA."),
      ).toBeInTheDocument();

      // CTA para continuar no app
      const continueBtn = screen.getByRole("link", { name: /Continuar na CARONAA/i });
      expect(continueBtn).toBeInTheDocument();
    });
  });
});
