import { describe, expect, it, vi } from 'vitest';
import { generateRideQrToken, confirmRideByQr } from './ride-qr-service';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
describe('boarding QR fails closed',()=>{
  it('never fabricates a token when the function is unavailable',async()=>{
    rpc.mockResolvedValue({data:null,error:{message:'function does not exist'}});
    await expect(generateRideQrToken('ride-id')).rejects.toThrow('function does not exist');
  });
  it('never pretends boarding succeeded when the function is unavailable',async()=>{
    rpc.mockResolvedValue({data:null,error:{message:'function does not exist'}});
    await expect(confirmRideByQr('caronaa:ride-confirm:abcdef123456')).rejects.toThrow('function does not exist');
  });
  it('uses the actual returned token',async()=>{
    const result={token:'real-token',rideId:'ride-id',expiresAt:'2026-10-08T12:00:00Z'};
    rpc.mockResolvedValue({data:result,error:null});
    await expect(generateRideQrToken('ride-id')).resolves.toEqual(result);
  });
});