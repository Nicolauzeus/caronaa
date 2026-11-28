import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const platform = vi.hoisted(() => ({ native: false }));
vi.mock("@/lib/native/capacitor-bridge", () => ({ isNativeAndroid: () => platform.native }));
import { DriverWebPushStatus } from "@/components/caronaa/DriverWebPushStatus";

beforeEach(() => { platform.native = false; });
afterEach(cleanup);
describe("driver browser alert status", () => {
  it("offers explicit opt-in without claiming registration", () => {
    const enable = vi.fn();
    render(<DriverWebPushStatus result={null} pending={false} onEnable={enable}/>);
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" }));
    expect(enable).toHaveBeenCalledOnce();
  });
  it("shows registration success with its delivery limitation", () => {
    render(<DriverWebPushStatus result={{ ok: true, remote: "web" }} pending={false} onEnable={() => {}}/>);
    expect(screen.getByText("Notificações ativadas neste navegador")).toBeTruthy();
    expect(screen.getByText(/O som e a entrega dependem/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("allows retry after a failed save", () => {
    const enable = vi.fn();
    render(<DriverWebPushStatus result={{ ok: false, reason: "SAVE_FAILED" }} pending={false} onEnable={enable}/>);
    expect(screen.getByText(/Não foi possível cadastrar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(enable).toHaveBeenCalledOnce();
  });
  it("explains blocked permission and offers a recheck", () => {
    render(<DriverWebPushStatus result={{ ok: false, reason: "DENIED" }} pending={false} onEnable={() => {}}/>);
    expect(screen.getByText(/configurações deste site/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verificar permissão" })).toBeTruthy();
  });
  it("explains the iOS installation requirement", () => {
    render(<DriverWebPushStatus result={{ ok: false, reason: "INSTALL_REQUIRED" }} pending={false} onEnable={() => {}}/>);
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("disables repeated taps during registration", () => {
    render(<DriverWebPushStatus result={null} pending={true} onEnable={() => {}}/>);
    expect(screen.getByRole("button", { name: "Ativando..." })).toBeDisabled();
  });
  it("keeps browser setup out of the Android APK", () => {
    platform.native = true;
    const { container } = render(<DriverWebPushStatus result={null} pending={false} onEnable={() => {}}/>);
    expect(container.childElementCount).toBe(0);
  });
});
