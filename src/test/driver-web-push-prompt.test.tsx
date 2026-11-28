import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({ native: false, supported: true, iosNeedsInstall: false, subscribe: vi.fn() }));
vi.mock("@/lib/native/capacitor-bridge", () => ({ isNativeAndroid: () => env.native }));
vi.mock("@/lib/push/web-push-client", () => ({
  isWebPushSupported: () => env.supported,
  needsIOSHomeScreen: () => env.iosNeedsInstall,
  subscribeDriverToPush: env.subscribe,
}));
import { DriverWebPushPrompt, openDriverWebPushPrompt } from "@/components/caronaa/DriverWebPushPrompt";

let permission = "default";
let counter = 0;
let userId: string;
const requestPermission = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  userId = "invitation-test-" + ++counter;
  permission = "default";
  env.native = false; env.supported = true; env.iosNeedsInstall = false;
  env.subscribe.mockReset().mockResolvedValue({ ok: true });
  Object.defineProperty(window, "Notification", { configurable: true, value: {
    get permission() { return permission; }, requestPermission,
  } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const invitation = () => screen.queryByRole("complementary", { name: "Configurar alertas do CARONAA" });

describe("CARONAA guided browser permission card", () => {
  it("shows the branded invitation automatically without opening the browser prompt", () => {
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(invitation()).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "CARONAA" })).toBeInTheDocument();
    expect(screen.getByText(/confirme “Permitir”/)).toBeInTheDocument();
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("waits for accepted permission and saved subscription before showing success", async () => {
    let complete!: (result: { ok: true }) => void;
    env.subscribe.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" }));
    expect(env.subscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Ativando..." })).toBeDisabled();
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
    await act(async () => { complete({ ok: true }); });
    expect(screen.getByText("Notificações ativadas neste navegador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entendi" })).toBeInTheDocument();
  });

  it("keeps registration errors recoverable with an explicit retry", async () => {
    env.subscribe.mockResolvedValueOnce({ ok: false, reason: "SAVE_FAILED" }).mockResolvedValueOnce({ ok: true });
    render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" }));
    expect(await screen.findByText(/Não foi possível cadastrar este navegador/)).toBeInTheDocument();
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Notificações ativadas neste navegador")).toBeInTheDocument();
    expect(env.subscribe).toHaveBeenCalledTimes(2);
  });

  it("remembers Agora não across remounts without requesting permission", () => {
    const first = render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(invitation()).toBeNull();
    first.unmount();
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(invitation()).toBeNull();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("lets the user manually reopen a deferred invitation", () => {
    render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    act(() => openDriverWebPushPrompt());
    expect(invitation()).toBeInTheDocument();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("offers a new invitation after the 24-hour deferral expires", () => {
    vi.useFakeTimers();
    const first = render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    first.unmount();
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(invitation()).toBeInTheDocument();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("keeps the deferral scoped to the current account", () => {
    const current = render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    current.rerender(<DriverWebPushPrompt userId={userId + "-other"}/>);
    expect(invitation()).toBeInTheDocument();
  });

  it("reconciles an existing grant silently without showing another invitation", async () => {
    permission = "granted";
    render(<DriverWebPushPrompt userId={userId}/>);
    await waitFor(() => expect(env.subscribe).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(invitation()).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("does not mistake granted permission for successful persistence", async () => {
    permission = "granted";
    env.subscribe.mockResolvedValue({ ok: false, reason: "SAVE_FAILED" });
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(await screen.findByText(/Não foi possível cadastrar este navegador/)).toBeInTheDocument();
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("shows recovery for a blocked permission without prompting on entry", () => {
    permission = "denied";
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(screen.getByRole("button", { name: "Verificar permissão" })).toBeInTheDocument();
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("explains iOS installation instead of asking an unavailable permission", () => {
    env.iosNeedsInstall = true; env.supported = false;
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).toBeNull();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("keeps the web invitation and subscription out of the native APK", () => {
    env.native = true; permission = "granted";
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(invitation()).toBeNull();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("does not open a permission prompt when returning or reconnecting", () => {
    render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    act(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(invitation()).toBeNull();
  });

  it("silently completes registration after permission is enabled in browser settings", async () => {
    permission = "denied";
    render(<DriverWebPushPrompt userId={userId}/>);
    permission = "granted";
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(env.subscribe).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(invitation()).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("ignores completion from an account that was unmounted", async () => {
    let complete!: (result: { ok: true }) => void;
    env.subscribe.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const first = render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" }));
    first.unmount();
    render(<DriverWebPushPrompt userId={userId + "-new"}/>);
    await act(async () => { complete({ ok: true }); });
    expect(invitation()).toBeInTheDocument();
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
  });

  it("remembers a deferral during the session even when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    const first = render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    first.unmount();
    render(<DriverWebPushPrompt userId={userId}/>);
    expect(invitation()).toBeNull();
  });

  it("keeps sensitive routes quiet while allowing manual access", () => {
    render(<DriverWebPushPrompt userId={userId} automatic={false}/>);
    expect(invitation()).toBeNull();
    act(() => openDriverWebPushPrompt());
    expect(invitation()).toBeInTheDocument();
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("closes the confirmed success card after six seconds", async () => {
    vi.useFakeTimers();
    render(<DriverWebPushPrompt userId={userId}/>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" })); });
    expect(screen.getByText("Notificações ativadas neste navegador")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(invitation()).toBeNull();
  });

  it("turns an unexpected subscription error into a visible retry", async () => {
    env.subscribe.mockRejectedValue(new Error("network failure"));
    render(<DriverWebPushPrompt userId={userId}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ativar notificações" }));
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Notificações ativadas neste navegador")).toBeNull();
  });
});
