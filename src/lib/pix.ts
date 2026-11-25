const dictEmail = /^[a-z0-9.!#$'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const evp = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const cnpjMask = /^[\da-z]{2}\.[\da-z]{3}\.[\da-z]{3}\/[\da-z]{4}-\d{2}$/i;
const localPhone = /^(?:\(\d{2}\)\s*|\d{2}\s+)\d{4,5}[- ]?\d{4}$/;

function field(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("Campo Pix excede o limite BR Code");
  return id + length.toString().padStart(2, "0") + value;
}

/** Syntax only. An unformatted 11-digit key already in storage is a document.
 * A national phone must be identified as such when the driver saves it. */
export function normalizePixKey(input: string): string {
  const key = input.trim();
  if (!key) throw new Error("Informe sua chave Pix.");
  if (/^[\x20-\x7E]+$/.test(key)) {
    const lower = key.toLowerCase();
    if (key.length <= 77 && dictEmail.test(lower)) return lower;
    if (evp.test(key)) return lower;

    const digits = key.replace(/[ ()/.-]/g, "");
    if (localPhone.test(key) || /^\d{10}$/.test(key)) return "+55" + digits;
    if (/^\+[\d ().-]+$/.test(key) && /^\+[1-9]\d{1,14}$/.test(digits)) return digits;
    if (/^[\d ().-]+$/.test(key) && /^55\d{10,11}$/.test(digits)) return "+" + digits;
    if (/^[\d ./-]+$/.test(key) && /^(?:\d{11}|\d{14})$/.test(digits)) return digits;
    if (/^[a-z\d]{12}\d{2}$/i.test(key) || cnpjMask.test(key)) return digits.toUpperCase();
  }
  throw new Error("Confira o formato da chave Pix. Para telefone, inclua o código do país e o DDD.");
}

/** A static BR Code fills the transfer in the bank. It does not confirm receipt. */
export function buildPixPayload(key: string, name: string, amount: number, txid?: string) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 21_474_836.47 ||
      Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) {
    throw new Error("Valor Pix inválido");
  }
  if (txid !== undefined && !/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new Error("Identificador Pix inválido");
  }

  const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/ +/g, " ").toUpperCase().slice(0, 25).trimEnd() || "MOTORISTA";
  const merchant = field("00", "br.gov.bcb.pix") + field("01", normalizePixKey(key));
  const payload = field("00", "01") + field("26", merchant) + field("52", "0000") + field("53", "986") +
    (amount > 0 ? field("54", amount.toFixed(2)) : "") + field("58", "BR") + field("59", cleanName) +
    field("60", "FORTALEZA") + field("62", field("05", txid ?? "***")) + "6304";

  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}
