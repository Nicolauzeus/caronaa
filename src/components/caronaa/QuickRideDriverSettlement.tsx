import { QuickRidePayment } from "./QuickRidePayment";

export function QuickRideDriverSettlement({ rideId, onPixReady }: {
  rideId: string; onPixReady?: (ready: boolean) => void;
}) {
  return <QuickRidePayment key={rideId} rideId={rideId} driver onPixReady={onPixReady} />;
}
