import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPwa, requestPersistentStorage } from "./pwa";

afterEach(() => vi.unstubAllGlobals());

describe("PWA", () => {
  it("não registra em HTTP sem contexto seguro", async () => {
    const register = vi.fn();
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    await registerPwa();
    expect(register).not.toHaveBeenCalled();
  });

  it("registra no escopo da aplicação sem cache do script", async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    await registerPwa();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("preserva armazenamento que já é persistente", async () => {
    const persist = vi.fn();
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { storage: { persisted: async () => true, persist } });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("solicita persistência sem fingir que o navegador concedeu", async () => {
    const persist = vi.fn().mockResolvedValue(false);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist } });
    expect(await requestPersistentStorage()).toBe(false);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("trata API indisponível sem interromper o app", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {});
    await expect(registerPwa()).resolves.toBeUndefined();
    expect(await requestPersistentStorage()).toBe(false);
  });
});
