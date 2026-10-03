import rafael from "@/assets/driver-rafael.jpg";
import marina from "@/assets/driver-marina.jpg";
import lucas from "@/assets/driver-lucas.jpg";

export type Ride = {
  id: number;
  driver: string;
  photo: string;
  rating: string;
  reviews: number;
  origin: string;
  destination: string;
  date: string;
  time: string;
  arrival: string;
  seats: number;
  price: number;
  vehicle: string;
  meeting: string;
  type: "Urbana" | "Intermunicipal";
};

export const currentUser = {
  name: "Ana Beatriz",
  firstName: "Ana",
  city: "Fortaleza, CE",
  photo: marina,
  rating: "4,9",
  rides: 12,
  joined: "Março de 2026",
};

export const rides: Ride[] = [
  { id: 1, driver: "Rafael Oliveira", photo: rafael, rating: "4,9", reviews: 42, origin: "Aldeota", destination: "Meireles", date: "Hoje, 03 out", time: "07:30", arrival: "08:05", seats: 2, price: 8, vehicle: "Honda Fit · Prata", meeting: "Praça Portugal", type: "Urbana" },
  { id: 2, driver: "Marina Costa", photo: marina, rating: "5,0", reviews: 28, origin: "Fortaleza", destination: "Eusébio", date: "Hoje, 03 out", time: "08:15", arrival: "09:00", seats: 3, price: 15, vehicle: "Hyundai HB20 · Branco", meeting: "Shopping Iguatemi Bosque", type: "Intermunicipal" },
  { id: 3, driver: "Lucas Ferreira", photo: lucas, rating: "4,8", reviews: 36, origin: "Benfica", destination: "Centro", date: "Amanhã, 04 out", time: "09:00", arrival: "09:30", seats: 1, price: 7, vehicle: "Chevrolet Onix · Azul", meeting: "Praça da Gentilândia", type: "Urbana" },
  { id: 4, driver: "Rafael Oliveira", photo: rafael, rating: "4,9", reviews: 42, origin: "Fortaleza", destination: "Aquiraz", date: "Amanhã, 04 out", time: "10:30", arrival: "11:25", seats: 2, price: 20, vehicle: "Honda Fit · Prata", meeting: "Terminal Papicu", type: "Intermunicipal" },
];

export const myPassengerRides = [
  { id: 101, origin: "Aldeota", destination: "Meireles", date: "Hoje, 03 out", time: "07:30", driver: "Rafael Oliveira", status: "Confirmada", photo: rafael },
  { id: 102, origin: "Fortaleza", destination: "Eusébio", date: "Amanhã, 04 out", time: "08:15", driver: "Marina Costa", status: "Aguardando", photo: marina },
];

export const myDriverRides = [
  { id: 201, origin: "Benfica", destination: "Centro", date: "Seg, 05 out", time: "08:00", driver: "Você está dirigindo", status: "Publicada", photo: marina },
];

export const rideService = {
  list: () => rides,
  findById: (id: number) => rides.find((ride) => ride.id === id),
};
