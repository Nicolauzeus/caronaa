import { describe, expect, it } from "vitest";
import { authenticatedNav, sharedDriverNav, isAppNavSelected } from "./app-navigation";

describe("CARONAA mobile-first navigation", () => {
  it("keeps the shared destination dock free of role-switch shortcuts", () => {
    expect(authenticatedNav.map(item => item.label)).toEqual(["Início", "Viagens", "Perfil"]);
    expect(authenticatedNav.map(item => item.to)).toEqual(["/home", "/minhas-caronas", "/perfil"]);
  });

  it("uses a driver-only dock and separates the cockpit from driver trips", () => {
    expect(sharedDriverNav.map(item => item.label)).toEqual(["Painel", "Viagens", "Perfil"]);
    expect(sharedDriverNav.map(item => item.to)).toEqual(["/home", "/home", "/perfil"]);
    const panel = sharedDriverNav.filter(item =>
      isAppNavSelected("/home", "offer", item.to, item.label, false));
    expect(panel.map(item => item.label)).toEqual(["Painel"]);
    const trips = sharedDriverNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label, true));
    expect(trips.map(item => item.label)).toEqual(["Viagens"]);
  });
  it("activates only the home tab during regular map browsing", () => {
    const selected = authenticatedNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label));
    expect(selected.map(item => item.label)).toEqual(["Início"]);
  });

  it("keeps Home selected during the role-switch intent", () => {
    for (const intent of ["offer", "request"]) {
      const selected = authenticatedNav.filter(item =>
        isAppNavSelected("/home", intent, item.to, item.label));
      expect(selected.map(item => item.label)).toEqual(["Início"]);
    }
  });

  it("highlights trips and profile without incorrectly selecting the map", () => {
    expect(isAppNavSelected("/minhas-caronas", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/viagem/ride-id", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/perfil", "Perfil")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/home", "Início")).toBe(false);
  });
});
