import { describe, expect, it } from 'vitest';
import { buildPixPayload, normalizePixKey } from './pix';
describe('Pix BR Code', () => {
  it('encodes merchant key, contribution and sanitized name', () => {
    const code=buildPixPayload('motorista@example.com','João Silva',12.5);
    expect(code).toContain('br.gov.bcb.pix');
    expect(code).toContain('motorista@example.com');
    expect(code).toContain('540512.50');
    expect(code).toContain('JOAO SILVA');
    expect(code).toMatch(/6304[0-9A-F]{4}$/);
  });
  it('uses an open amount when the contribution is zero', () => {
    expect(buildPixPayload('motorista@example.com','Motorista',0)).not.toContain('54040.00');
  });
  it('includes server-issued Pix statement TXID and the exact R$8.05 amount', () => {
    const code = buildPixPayload(
      'caronaa@example.com', 'CARONAA', 8.05,
      'C4A55D7E2F1234ABC1234ABC1',
    );
    expect(code).toContain('54048.05');
    expect(code).toContain('C4A55D7E2F1234ABC1234ABC1');
    expect(code).toMatch(/6304[0-9A-F]{4}$/);
  });
  it('never issues a QR with a negative, imprecise, or malformed payable amount', () => {
    expect(() => buildPixPayload('caronaa@example.com', 'CARONAA', -2)).toThrow(/Valor/);
    expect(() => buildPixPayload('caronaa@example.com', 'CARONAA', 7.505)).toThrow(/Valor/);
    expect(() => buildPixPayload('caronaa@example.com', 'CARONAA', 7.5, 'INVALID*TXID')).toThrow(/Identificador/);
  });
  it('matches independent CRC-16/CCITT calculation', () => {
    const code=buildPixPayload('motorista@example.com','Motorista',30);
    let crc=65535;
    for(const byte of new TextEncoder().encode(code.slice(0,-4))) {
      crc ^= byte*256;
      for(let i=0;i<8;i++)crc=((crc*2)^((crc&32768)?4129:0))&65535;
    }
    expect(code.slice(-4)).toBe(crc.toString(16).toUpperCase().padStart(4,'0'));
  });
});
describe("canonical driver Pix keys", () => {
  it.each([
    [" Driver@Example.COM ", "driver@example.com"],
    ["(85) 99999-0101", "+5585999990101"],
    ["85 99999-0101", "+5585999990101"],
    ["+55 (55) 99999-0101", "+5555999990101"],
    ["+244 900 000 001", "+244900000001"],
    ["+1 (202) 555-0100", "+12025550100"],
    ["5585999990101", "+5585999990101"],
    ["123.456.789-01", "12345678901"],
    ["12345678901", "12345678901"],
    ["12.345.678/0001-90", "12345678000190"],
    ["a1.b2c.3d4/e5f6-78", "A1B2C3D4E5F678"],
    ["123E4567-E89B-12D3-A456-426655440000", "123e4567-e89b-12d3-a456-426655440000"],
  ])("encodes %s in the registered key format", (input, expected) => {
    expect(normalizePixKey(input)).toBe(expected);
    const code = buildPixPayload(input, "Motorista", 30, "CR001");
    expect(code).toContain("0014br.gov.bcb.pix01" + String(expected.length).padStart(2, "0") + expected);
    expect(code).toContain("540530.00");
    expect(code).toContain("62090505CR001");
  });
  it.each(["", "+05585999990101", "á@example.com", "me@-example.com", "a@@example.com", "x".repeat(76) + "@y"])
    ("rejects malformed key %j", key => expect(() => normalizePixKey(key)).toThrow());
  it("fits a 77-byte email in the BR Code merchant account field", () => {
    const key = "x".repeat(64) + "@example.test";
    expect(key).toHaveLength(77);
    expect(buildPixPayload(key, "  ", 30)).toContain("26990014br.gov.bcb.pix0177" + key);
    expect(buildPixPayload(key, "  ", 30)).toContain("5909MOTORISTA");
  });
});
