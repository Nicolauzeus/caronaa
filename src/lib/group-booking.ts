import { calculatePassengerFare, fromCents, toCents } from "./ride-cost";

/** One reservation owner pays for all seats, including companions who exit earlier. */
export type GroupPassengerFare = {
  passengerIndex: number;
  destination: string;
  roadDistanceKm: number;
  price: number;
};

export type GroupBookingQuote = {
  passengerCount: number;
  passengers: GroupPassengerFare[];
  totalCents: number;
  total: number;
  payer: "REQUEST_OWNER";
  paymentMethod: "DRIVER_PIX";
};

/** Accept only server-computed driving distances, never prices supplied by the client. */
export function quoteGroupBooking(
  passengers: ReadonlyArray<{ destination: string; roadDistanceKm: number }>,
): GroupBookingQuote {
  if (!Number.isInteger(passengers.length) || passengers.length < 1 || passengers.length > 6) {
    throw new Error("A reserva deve conter de 1 a 6 passageiros.");
  }
  const fares: GroupPassengerFare[] = passengers.map((passenger, index) => {
    if (!passenger.destination.trim() || passenger.destination.length > 160) {
      throw new Error("Informe um destino válido para cada pessoa.");
    }
    const price = calculatePassengerFare(passenger.roadDistanceKm);
    return {
      passengerIndex: index + 1,
      destination: passenger.destination.trim(),
      roadDistanceKm: passenger.roadDistanceKm,
      price,
    };
  });
  const totalCents = fares.reduce((sum, fare) => sum + toCents(fare.price), 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error("O valor total da reserva é inválido.");
  }
  return {
    passengerCount: fares.length,
    passengers: fares,
    totalCents,
    total: fromCents(totalCents),
    payer: "REQUEST_OWNER",
    paymentMethod: "DRIVER_PIX",
  };
}
