/** Brazilian mobile-number formatting shared by signup, profiles and contact links.
 * A valid digit pattern does NOT mean the number is registered on WhatsApp.
 * Never strip a national DDD 55: remove Brazil's country code only at 13 digits.
 */
const BRAZIL_DDDS=new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "),
);

function nationalDigits(value:string):string{
  const digits=value.replace(/\D/g,"");
  return digits.length===13&&digits.startsWith("55")?digits.slice(2):digits;
}

export function formatBrazilWhatsapp(value:string):string{
  const digits=nationalDigits(value).slice(0,11);
  if(!digits)return "";
  if(digits.length<=2)return "("+digits;
  if(digits.length<=7)return "("+digits.slice(0,2)+") "+digits.slice(2);
  return "("+digits.slice(0,2)+") "+digits.slice(2,7)+"-"+digits.slice(7);
}

export function validBrazilWhatsapp(value:string):boolean{
  const digits=nationalDigits(value);
  return /^\d{11}$/.test(digits)&&BRAZIL_DDDS.has(digits.slice(0,2))&&digits[2]==="9";
}

export function normalizeBrazilWhatsapp(value:string):string|null{
  return validBrazilWhatsapp(value)?"+55"+nationalDigits(value):null;
}

/** User-initiated link only. Never infer contact consent from a valid phone. */
export function brazilWhatsappChatUrl(value:string|null|undefined):string|null{
  if(!value)return null;
  const normalized=normalizeBrazilWhatsapp(value);
  return normalized?"https://wa.me/"+normalized.slice(1):null;
}
