import { describe, expect, it } from "vitest";
import { authenticatedNav, sharedDriverNav, professionalNav, isAppNavSelected } from "./app-navigation";

describe("CARONAA mobile-first navigation", () => {
  it("keeps the four passenger destinations in the approved order", () => {
    expect(authenticatedNav.map(item => item.label)).toEqual(["Início", "Oferecer", "Viagens", "Perfil"]);
    expect(authenticatedNav.map(item => item.to)).toEqual(["/home", "/home", "/minhas-caronas", "/perfil"]);
  });

  it("keeps the four shared-driver destinations and highlights offer intent separately", () => {
    expect(sharedDriverNav.map(item => item.label)).toEqual(["Início", "Oferecer", "Viagens", "Perfil"]);
    expect(sharedDriverNav.map(item => item.to)).toEqual(["/home", "/home", "/home", "/perfil"]);
    const panel = sharedDriverNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label, false));
    expect(panel.map(item => item.label)).toEqual(["Início"]);
    const offer = sharedDriverNav.filter(item =>
      isAppNavSelected("/home", "scheduled", item.to, item.label, false));
    expect(offer.map(item => item.label)).toEqual(["Oferecer"]);
    const trips = sharedDriverNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label, true));
    expect(trips.map(item => item.label)).toEqual(["Viagens"]);
  });

  it("uses the same four destinations for the professional cockpit",()=>{
    expect(professionalNav.map(item=>item.label)).toEqual(["Início","Oferecer","Viagens","Perfil"]);
    expect(professionalNav.map(item=>item.to)).toEqual([
      "/disponibilidade-profissional","/home","/viagens-profissionais","/perfil",
    ]);
  });
  it("activates only the home tab during regular map browsing", () => {
    const selected = authenticatedNav.filter(item =>
      isAppNavSelected("/home", undefined, item.to, item.label));
    expect(selected.map(item => item.label)).toEqual(["Início"]);
  });

  it("highlights Offer for offer intent and Home for passenger request intent", () => {
    const offer = authenticatedNav.filter(item =>
      isAppNavSelected("/home", "offer", item.to, item.label));
    expect(offer.map(item => item.label)).toEqual(["Oferecer"]);
    const request = authenticatedNav.filter(item =>
      isAppNavSelected("/home", "request", item.to, item.label));
    expect(request.map(item => item.label)).toEqual(["Início"]);
  });

  it("highlights trips and profile without incorrectly selecting the map", () => {
    expect(isAppNavSelected("/minhas-caronas", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/viagem/ride-id", undefined, "/minhas-caronas", "Viagens")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/perfil", "Perfil")).toBe(true);
    expect(isAppNavSelected("/perfil", undefined, "/home", "Início")).toBe(false);
  });
});
