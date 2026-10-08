function field(id: string, value: string) { return id + value.length.toString().padStart(2, '0') + value; }
export function buildPixPayload(key: string, name: string, amount: number) {
  const cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase().slice(0, 25) || 'MOTORISTA';
  const merchant = field('00', 'BR.GOV.BCB.PIX') + field('01', key);
  const payload = field('00','01') + field('26',merchant) + field('52','0000') + field('53','986') + (amount > 0 ? field('54',amount.toFixed(2)) : '') + field('58','BR') + field('59',cleanName) + field('60','FORTALEZA') + field('62',field('05','***')) + '6304';
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i=0;i<8;i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return payload + crc.toString(16).toUpperCase().padStart(4,'0');
}
