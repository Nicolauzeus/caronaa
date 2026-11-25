import { QuickRidePayment } from "./QuickRidePayment";

export function QuickRidePixCard({ rideId }: { rideId: string }) {
  return <QuickRidePayment key={rideId} rideId={rideId} />;
}
