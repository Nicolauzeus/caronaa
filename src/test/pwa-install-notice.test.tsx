import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaInstallNotice } from "@/components/caronaa/PwaInstallNotice";
import { BrandLogo, CaronaaSymbol } from "@/components/caronaa/BrandElements";
import logo from "@/assets/brand/caronaa-logo.png.asset.json";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("Marca e instalação", () => {
  it("usa o arquivo oficial nas duas representações", () => {
    const { container } = render(<><BrandLogo /><CaronaaSymbol /></>);
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("src")).toBe(logo.url);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("aguarda suporte real e instala após clique", async () => {
    vi.useFakeTimers();
    render(<PwaInstallNotice />);
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(30000));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Instalar" })); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
    vi.useRealTimers();
  });

  it("reapresenta o convite na home pública após 30 segundos, mesmo depois de fechar", () => {
    vi.useFakeTimers();
    render(<PwaInstallNotice />);
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByLabelText("Instalar CARONAA")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar aviso de instalação"));
    expect(screen.queryByLabelText("Instalar CARONAA")).toBeNull();
    act(() => vi.advanceTimersByTime(29000));
    expect(screen.queryByLabelText("Instalar CARONAA")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText("Instalar CARONAA")).toBeInTheDocument();
  });

  it("mostra na /home autenticada mesmo sem beforeinstallprompt e oferece instruções", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/home");
    render(<PwaInstallNotice />);
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByLabelText("Instalar CARONAA")).toBeInTheDocument();
    expect(screen.getByText(/menu do navegador/)).toBeInTheDocument();
  });

  it("não interrompe outras rotas, mas aparece ao entrar na Home SPA", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/viagem-rapida");
    render(<PwaInstallNotice />);
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.queryByLabelText("Instalar CARONAA")).toBeNull();
    act(() => window.history.pushState({}, "", "/home"));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByLabelText("Instalar CARONAA")).toBeInTheDocument();
  });

  it("não mostra aviso no aplicativo instalado", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<PwaInstallNotice />);
    act(() => { window.dispatchEvent(new Event("beforeinstallprompt")); });
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
  });
});
