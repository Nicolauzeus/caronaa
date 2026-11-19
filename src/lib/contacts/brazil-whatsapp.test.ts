import {describe,it,expect} from "vitest";
import {brazilWhatsappChatUrl,normalizeBrazilWhatsapp,validBrazilWhatsapp,formatBrazilWhatsapp}
  from "./brazil-whatsapp";
describe("F02/F07: one phone validator for every role",()=>{
  it.each([
    ["(85) 99999-1234","+5585999991234"],
    ["(11) 99999-1234","+5511999991234"],
    ["(55) 99999-1234","+5555999991234"],
    ["+55 (85) 99999-1234","+5585999991234"],
    ["+55 (55) 99999-1234","+5555999991234"],
  ])("does not invent or strip DDD in %s", (input,e164)=>{
    expect(normalizeBrazilWhatsapp(input)).toBe(e164);
    expect(brazilWhatsappChatUrl(input)).toBe("https://wa.me/"+e164.slice(1));
  });
  it.each(["(20) 99999-1234","(85) 88888-1234","123","","+55 (85) 99999-1234567"])(
    "rejects invalid formats without claiming WhatsApp verification: %s",v=>{
      expect(validBrazilWhatsapp(v)).toBe(false);
      expect(brazilWhatsappChatUrl(v)).toBeNull();
    });
  it("formats a pasted country-coded number without repeating 55",()=>{
    expect(formatBrazilWhatsapp("+55 (85) 99999-1234")).toBe("(85) 99999-1234");
  });
});
