import { describe, expect, it } from 'vitest';
import { buildPixPayload } from './pix';
describe('Pix BR Code', () => {
  it('encodes merchant key, contribution and sanitized name', () => {
    const code=buildPixPayload('motorista@example.com','João Silva',12.5);
    expect(code).toContain('BR.GOV.BCB.PIX');
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