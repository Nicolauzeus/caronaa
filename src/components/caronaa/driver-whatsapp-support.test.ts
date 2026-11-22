import { describe, expect, it } from "vitest";
import { buildCaronaaSupportWhatsAppUrl } from "./DriverWhatsAppSupport";
describe("CARONAA support WhatsApp configuration",()=>{
  it("uses the current server-provided international number",()=>{
    const url=new URL(buildCaronaaSupportWhatsAppUrl("Dúvida sobre meu cadastro","+244944175424"));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/244944175424");
  });
  it("preserves Portuguese text in the handoff",()=>{
    const msg="Olá, CARONAA! Minha moto: Honda & Yamaha #123.";
    const url=new URL(buildCaronaaSupportWhatsAppUrl(" "+msg+"\n","+244944175424"));
    expect(url.searchParams.get("text")).toBe(msg);
  });
  it("refuses invalid destination instead of using a hidden fallback",()=>{
    expect(()=>buildCaronaaSupportWhatsAppUrl("teste","")).toThrow();
  });
});