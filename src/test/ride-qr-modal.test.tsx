import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RideQrModal } from '@/components/caronaa/RideQrModal';
const {toCanvas,generate}=vi.hoisted(()=>({toCanvas:vi.fn().mockResolvedValue(undefined),generate:vi.fn()}));
vi.mock('qrcode',()=>({default:{toCanvas}}));
vi.mock('@/lib/ride-qr-service',()=>({generateRideQrToken:generate}));
describe('QR modal',()=>{
  it('draws the real QR after the loading canvas becomes available',async()=>{
    generate.mockResolvedValue({token:'actual-token',rideId:'ride-test',expiresAt:new Date(Date.now()+600000).toISOString()});
    render(<RideQrModal rideId="ride-test" open onOpenChange={vi.fn()} />);
    await waitFor(()=>expect(toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement),'caronaa:ride-confirm:actual-token',expect.any(Object)));
    expect(screen.queryByText('Não foi possível gerar o código.')).not.toBeInTheDocument();
  });
});