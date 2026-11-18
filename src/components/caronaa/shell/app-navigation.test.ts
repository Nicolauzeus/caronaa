import { describe, expect, it } from "vitest";
import { authenticatedNav, isAppNavSelected } from "./app-navigation";

describe("CARONAA mobile-first navigation", () => {
  it("preserves exactly four usable destinations, without advertising tabs", () => {
    expect(authenticatedNav.map(item => item.label)).toEqual(["Início", "Oferecer", "Viagens", "Perfil"]);
    expect(authenticatedNav.map(item => item.to)).toEqual(["/home", "/home", "/minhas-caronas", "/perfil"]);
  });

  it("activates only the home tab during regular map browsing", () => {
    const selected = authenticatedNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label));
    expect(selected.map(item => item.label)).toEqual(["Início"]);
  });

  it("routes the offer intent exclusively to the offer tab", () => {
    const selected = authenticatedNav.filter(item =>
      isAppNavSelected("/home", "offer", item.to, item.label));
    expect(selected.map(item => item.label)).toEqual(["Oferecer"]);
    expect(isAppNavSelected("/oferecer", undefined, "/home", "Oferecer")).toBe(true);
  });

  it("highlights trips and profile without incorrectly selecting the map", () => {
    expect(isAppNavSelected("/minhas-caronas", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/viagem/ride-id", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/perfil", "Perfil")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/home", "Início")).toBe(false);
  });
});
