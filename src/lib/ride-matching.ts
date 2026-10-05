export type RideCompatibilityInput = {
  request: {
    origin: string;
    destination: string;
    rideDate: string;
    departureTime: string;
    passengerCount: number;
    userId: string;
  };
  offer: {
    origin: string;
    destination: string;
    rideDate: string;
    departureTime: string;
    availableSeats: number;
    seatsRemaining: number;
    userId: string;
  };
};

const normalizeLocation = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/** Mirrors the database matching rule: same normalized route/date/time, enough capacity, distinct users. */
export function isRideRequestCompatibleWithOffer(input: RideCompatibilityInput): boolean {
  return (
    normalizeLocation(input.request.origin) !== normalizeLocation(input.request.destination) &&
    normalizeLocation(input.offer.origin) === normalizeLocation(input.request.origin) &&
    normalizeLocation(input.offer.destination) === normalizeLocation(input.request.destination) &&
    input.request.rideDate.length > 0 &&
    input.offer.rideDate === input.request.rideDate &&
    input.request.departureTime.length > 0 &&
    input.offer.departureTime === input.request.departureTime &&
    Number.isInteger(input.request.passengerCount) &&
    Number.isInteger(input.offer.availableSeats) &&
    Number.isInteger(input.offer.seatsRemaining) &&
    input.request.passengerCount >= 1 &&
    input.request.passengerCount <= 6 &&
    input.offer.availableSeats >= 1 &&
    input.offer.availableSeats <= 6 &&
    input.offer.seatsRemaining >= input.request.passengerCount &&
    input.offer.seatsRemaining <= input.offer.availableSeats &&
    input.request.userId !== input.offer.userId
  );
}
