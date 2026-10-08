import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaInstallNotice } from "@/components/caronaa/PwaInstallNotice";
import { BrandLogo, CaronaaSymbol } from "@/components/caronaa/BrandElements";
import logo from "@/assets/brand/caronaa-logo.png.asset.json";

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Marca e instalação", () => {
  it("usa o arquivo oficial nas duas representações", () => {
    const { container } = render(<><BrandLogo /><CaronaaSymbol /></>);
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("src")).toBe(logo.url);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("aguarda suporte real e instala após clique", async () => {
    render(<PwaInstallNotice />);
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Instalar" })); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
  });

  it("permite fechar e não repete na mesma sessão", () => {
    const { unmount } = render(<PwaInstallNotice />);
    act(() => { window.dispatchEvent(new Event("beforeinstallprompt")); });
    fireEvent.click(screen.getByLabelText("Fechar aviso de instalação"));
    unmount();
    render(<PwaInstallNotice />);
    act(() => { window.dispatchEvent(new Event("beforeinstallprompt")); });
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
  });

  it("não mostra aviso no aplicativo instalado", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<PwaInstallNotice />);
    act(() => { window.dispatchEvent(new Event("beforeinstallprompt")); });
    expect(screen.queryByText("Instale a CARONAA")).toBeNull();
  });
});
