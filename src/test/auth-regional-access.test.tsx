import type { ComponentType, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  oauth: vi.fn(),
  onboarding: vi.fn(),
  destination: vi.fn(),
  geolocation: vi.fn(),
  reverse: vi.fn(),
  toastError: vi.fn(),
  search: {} as Record<string, unknown>,
  auth: { user: null, loading: false } as { user: Record<string, unknown> | null; loading: boolean },
}));

vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<typeof import("@tanstack/react-router")>(),
  useNavigate: () => api.navigate,
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) =>
    <a href={to} className={className}>{children}</a>,
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => api.auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signUp: api.signUp, signInWithPassword: api.signIn, signOut: api.signOut } },
}));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: { signInWithOAuth: api.oauth } } }));
vi.mock("@/lib/onboarding/progressive-onboarding", () => ({ readOnboarding: api.onboarding }));
vi.mock("@/lib/onboarding/research-gate", () => ({ resolvePostOnboardingDestination: api.destination }));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: api.reverse }));
vi.mock("@/components/caronaa/AppShell", () => ({ Brand: () => <span>CARONAA</span> }));
vi.mock("@/components/caronaa/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">Tema</button> }));
vi.mock("sonner", () => ({ toast: { error: api.toastError } }));

import { Route } from "@/routes/auth";

const AuthPage = Route.options.component as ComponentType;
const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const signedInUser = { id: "user-1", email_confirmed_at: "2026-11-16T12:00:00Z" };

beforeEach(() => {
  vi.resetAllMocks();
  api.auth = { user: null, loading: false };
  api.search = {};
  vi.spyOn(Route, "useSearch").mockImplementation(() => api.search as never);
  api.signUp.mockResolvedValue({ data: { session: null }, error: null });
  api.signIn.mockResolvedValue({ data: { session: {} }, error: null });
  api.oauth.mockResolvedValue({ error: null });
  api.onboarding.mockResolvedValue({ status: "BASIC_COMPLETED", region_code: "OTHER" });
  api.destination.mockResolvedValue("/home");
  api.geolocation.mockImplementation((success) => success({
    coords: { latitude: -23.55, longitude: -46.63, accuracy: 20 },
  }));
  api.reverse.mockResolvedValue({ state: "São Paulo" });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true, value: { getCurrentPosition: api.geolocation },
  });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
  else Reflect.deleteProperty(navigator, "geolocation");
  if (originalSecureContext) Object.defineProperty(window, "isSecureContext", originalSecureContext);
  else Reflect.deleteProperty(window, "isSecureContext");
});

function choosePassengerForSignup() {
  fireEvent.click(screen.getByRole("button", { name: /Sou passageiro/i }));
  fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "Pessoa Teste" } });
}

function enterCredentials() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "cadastro@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-segura" } });
}

function expectNoGeographicGate() {
  expect(api.geolocation).not.toHaveBeenCalled();
  expect(api.reverse).not.toHaveBeenCalled();
  expect(api.signOut).not.toHaveBeenCalled();
  expect(screen.queryByText(/apenas no Ceará|confirmando sua localização/i)).not.toBeInTheDocument();
}

describe("F02 account access without a regional restriction", () => {
  it.each(["outside Ceará", "denied GPS", "missing geolocation", "unavailable geocoding", "insecure context"])(
    "allows email signup with %s and preserves email confirmation",
    async (scenario) => {
      api.search = { mode: "cadastro" };
      if (scenario === "denied GPS") api.geolocation.mockImplementation((_success, reject) => reject(new Error("denied")));
      if (scenario === "missing geolocation") Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
      if (scenario === "unavailable geocoding") api.reverse.mockRejectedValue(new Error("offline"));
      if (scenario === "insecure context") Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
      render(<AuthPage />);
      choosePassengerForSignup();
      enterCredentials();
      fireEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
      await screen.findByRole("heading", { name: "Confirme seu e-mail" });
      expect(api.signUp).toHaveBeenCalledWith({
        email: "cadastro@example.com", password: "senha-segura",
        options: {
          emailRedirectTo: `${window.location.origin}/auth?mode=entrar&redirect=%2Fonboarding`,
          data: { full_name: "Pessoa Teste", initial_usage_role: "PASSAGEIRO" },
        },
      });
      expect(api.navigate).not.toHaveBeenCalled();
      expectNoGeographicGate();
    },
  );

  it("sends a signup with an existing session to onboarding", async () => {
    api.search = { mode: "cadastro" };
    api.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    render(<AuthPage />);
    choosePassengerForSignup();
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({ to: "/onboarding", replace: true }));
    expectNoGeographicGate();
  });

  it.each(["entrar", "cadastro"])("starts Google %s without requesting location or adding regionCheck", async (mode) => {
    api.search = { mode, redirect: "/perfil" };
    render(<AuthPage />);
    if (mode === "cadastro") choosePassengerForSignup();
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/i }));
    await waitFor(() => expect(api.oauth).toHaveBeenCalledOnce());
    const [provider, options] = api.oauth.mock.calls[0];
    const callback = new URL(options.redirect_uri);
    expect(provider).toBe("google");
    expect(callback.origin).toBe(window.location.origin);
    expect(callback.pathname).toBe("/auth");
    expect(callback.searchParams.get("redirect")).toBe("/perfil");
    expect(callback.searchParams.has("regionCheck")).toBe(false);
    expectNoGeographicGate();
  });

  it("keeps password login independent of region and follows the existing access decision", async () => {
    api.search = { redirect: "/oferecer" };
    render(<AuthPage />);
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: /Entrar na CARONAA/ }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({ to: "/oferecer", replace: true }));
    expect(api.signIn).toHaveBeenCalledWith({ email: "cadastro@example.com", password: "senha-segura" });
    expect(api.destination).toHaveBeenCalledOnce();
    expectNoGeographicGate();
  });

  it.each(["/home", "/formulario", "/aguardando", "/disponibilidade-profissional"])(
    "ignores a legacy regionCheck callback and retains the normal destination %s",
    async (next) => {
      api.search = { regionCheck: "1", redirect: "/oferecer" };
      api.auth = { user: signedInUser, loading: false };
      api.destination.mockResolvedValue(next);
      api.geolocation.mockImplementation((_success, reject) => reject(new Error("denied")));
      render(<AuthPage />);
      await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
        to: next === "/home" ? "/oferecer" : next, replace: true,
      }));
      expectNoGeographicGate();
    },
  );

  it("keeps onboarding required for an incomplete account on an old Google callback", async () => {
    api.search = { regionCheck: "1" };
    api.auth = { user: signedInUser, loading: false };
    api.onboarding.mockResolvedValue(null);
    render(<AuthPage />);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({ to: "/onboarding", replace: true }));
    expect(api.destination).not.toHaveBeenCalled();
    expectNoGeographicGate();
  });

  it("does not bypass the existing access decision if that check fails", async () => {
    api.search = { regionCheck: "1" };
    api.auth = { user: signedInUser, loading: false };
    api.destination.mockRejectedValue(new Error("Não foi possível verificar seu acesso."));
    render(<AuthPage />);
    await waitFor(() => expect(api.toastError).toHaveBeenCalledWith("Não foi possível verificar seu acesso."));
    expect(api.navigate).not.toHaveBeenCalled();
    expectNoGeographicGate();
  });
  it("uses the universal signup for mototaxistas with no second credential form", async () => {
    api.search = { mode: "cadastro", redirect: "/cadastro-motorista" };
    render(<AuthPage />);
    // A professional entry implies the initial motorist intention; it is not authorization.
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
    expect(screen.getByText("Motorista")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "Motorista Teste" } });
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
    await waitFor(() => expect(api.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        emailRedirectTo: `${window.location.origin}/auth?mode=entrar&redirect=%2Fcadastro-motorista`,
        data: { full_name: "Motorista Teste", initial_usage_role: "MOTORISTA" },
      },
    })));
    expect(screen.getByRole("heading", { name: /Confirme seu e-mail/i })).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
    expectNoGeographicGate();
  });

  it("preserves only the professional continuation while basic onboarding is incomplete", async () => {
    api.search = { mode: "entrar", redirect: "/cadastro-motorista" };
    api.auth = { user: signedInUser, loading: false };
    api.onboarding.mockResolvedValue(null);
    render(<AuthPage />);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
      to: "/onboarding", search: { redirect: "/cadastro-motorista" }, replace: true,
    }));
    expect(api.destination).not.toHaveBeenCalled();
  });

  it("sends a completed universal account to professional data, never a new signup", async () => {
    api.search = { mode: "entrar", redirect: "/cadastro-motorista" };
    api.auth = { user: signedInUser, loading: false };
    render(<AuthPage />);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
      to: "/cadastro-motorista", replace: true,
    }));
    expect(api.signUp).not.toHaveBeenCalled();
  });

});
