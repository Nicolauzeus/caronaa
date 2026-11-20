function field(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("Campo Pix excede o limite BR Code");
  return id + length.toString().padStart(2, "0") + value;
}

/** Use the normalized key in both the EMV QR and the payment display.
 * This checks the key syntax, not registration/ownership at a bank.
 */
export function normalizePixKey(input: string): string {
  const key = input.trim();
  if (!key) throw new Error("Chave Pix não cadastrada");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) && key.length <= 77) return key;
  if (/^[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(key)) return key.toLowerCase();
  const digits = key.replace(/\D/g, "");
  if (/^[\d.\-\s/]+$/.test(key) && (digits.length === 11 || digits.length === 14)) return digits;
  if (/^\+?\d[\d\s()\-]+$/.test(key) && digits.length >= 12 && digits.length <= 13 && digits.startsWith("55"))
    return "+" + digits;
  throw new Error("Chave Pix inválida. Confira CPF, CNPJ, telefone +55, e-mail ou chave aleatória.");
}
/** Static Pix: the bank pre-fills the amount but does not confirm receipt.
 * txid identifies the exact server-issued commission statement, not a
 * payment receipt. Existing legacy QR calls may omit txid.
 */
export function buildPixPayload(key: string, name: string, amount: number, txid?: string) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 21_474_836.47 ||
      Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) {
    throw new Error("Valor Pix inválido");
  }
  if (txid !== undefined && !/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new Error("Identificador Pix inválido");
  }
  const reference = txid ?? "***";
  const cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase().slice(0, 25) || 'MOTORISTA';
  const merchant = field('00', 'BR.GOV.BCB.PIX') + field('01', normalizePixKey(key));
  const payload = field('00','01') + field('26',merchant) + field('52','0000') + field('53','986') + (amount > 0 ? field('54',amount.toFixed(2)) : '') + field('58','BR') + field('59',cleanName) + field('60','FORTALEZA') + field('62',field('05',reference)) + '6304';
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i=0;i<8;i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return payload + crc.toString(16).toUpperCase().padStart(4,'0');
}
