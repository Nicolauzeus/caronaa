import { describe, expect, it } from "vitest";
import { buildCaronaaSupportWhatsAppUrl, CARONAA_SUPPORT_WHATSAPP } from "./DriverWhatsAppSupport";

describe("CARONAA support WhatsApp handoff", () => {
  it("targets the configured Brazilian WhatsApp number", () => {
    const url = new URL(buildCaronaaSupportWhatsAppUrl("Dúvida sobre meu cadastro"));
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/" + CARONAA_SUPPORT_WHATSAPP);
    expect(url.pathname).toBe("/5585987584347");
  });

  it("preserves punctuation and Portuguese characters in the composed message", () => {
    const body = "Olá, CARONAA! Minha moto: Honda & Yamaha #123.";
    const url = new URL(buildCaronaaSupportWhatsAppUrl("  " + body + "\n"));
    expect(url.searchParams.get("text")).toBe(body);
  });
});
