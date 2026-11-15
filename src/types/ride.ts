/** Passenger-visible, server-authorized offer projection for the ON_ROUTE mode. */
export interface OnRouteMatch {
  offerId: string;
  driverUserId: string;
  driverName: string;
  driverAvatarUrl?: string;
  departureTime: string;
  availableSeats: number;
  seatsRemaining: number;
  pickupMeeting: { lat: number; lng: number; walkMeters: number; poiName: string };
  dropoffMeeting: { lat: number; lng: number; walkMeters: number; poiName: string };
  totalWalkMeters: number;
  estimatedPrice: number;
}
