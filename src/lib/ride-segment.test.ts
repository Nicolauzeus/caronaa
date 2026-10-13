import { expect, test } from "vitest";
import { areRideLocationsCompatible as c } from "./ride-matching";
const P = [
  { lat: -3.7, lng: -38.5 },
  { lat: -3.7, lng: -38.4 },
  { lat: -3.6, lng: -38.4 },
];
type Point = { lat: number; lng: number };
const mk = (o: Point, d: Point) => ({
  request: {
    origin: "x",
    destination: "y",
    originCoordinate: o,
    destinationCoordinate: d,
    rideDate: "",
    departureTime: "08:00",
    passengerCount: 1,
    userId: "p",
  },
  offer: {
    origin: "a",
    destination: "f",
    originCoordinate: P[0],
    destinationCoordinate: P[2],
    routePath: P,
    rideDate: "",
    departureTime: "08:00",
    availableSeats: 3,
    seatsRemaining: 3,
    userId: "d",
  },
});
test("subtrecho", () => {
  expect(c(mk({ lat: -3.7, lng: -38.45 }, { lat: -3.65, lng: -38.4 }))).toBe(true);
  expect(c(mk({ lat: -3.65, lng: -38.4 }, { lat: -3.7, lng: -38.45 }))).toBe(false);
  expect(c(mk({ lat: -3.75, lng: -38.45 }, { lat: -3.65, lng: -38.4 }))).toBe(false);
});
