// F07 — solicitação de acesso ao radar profissional (piloto). Espelha professional_access_missing no banco.
export type VehicleType = "CAR" | "MOTO";
export type CarCategory = "HATCH" | "SEDAN" | "SUV" | "MINIVAN" | "PICKUP";
export type AccessStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
export type MissingCode = "PHOTO" | "FULL_NAME" | "VEHICLE_MODEL" | "PLATE" | "VEHICLE_TYPE" | "CAR_CATEGORY" | "SEATS" | "MUNICIPALITY";

export const CAR_CATEGORIES: { value: CarCategory; label: string; maxSeats: number }[] = [
  { value: "HATCH", label: "Hatch", maxSeats: 4 },
  { value: "SEDAN", label: "Sedan", maxSeats: 4 },
  { value: "PICKUP", label: "Picape", maxSeats: 4 },
  { value: "SUV", label: "SUV", maxSeats: 6 },
  { value: "MINIVAN", label: "Minivan", maxSeats: 7 },
];

export const MISSING_LABELS: Record<MissingCode, string> = {
  PHOTO: "Foto real no perfil",
  FULL_NAME: "Nome completo (nome e sobrenome)",
  VEHICLE_MODEL: "Nome/modelo do veículo",
  PLATE: "Placa brasileira válida (ABC1234 ou ABC1D23)",
  VEHICLE_TYPE: "Tipo de veículo (carro ou moto)",
  CAR_CATEGORY: "Categoria do carro",
  SEATS: "Vagas para passageiros compatíveis com o veículo",
  MUNICIPALITY: "Município",
};
export const PROFILE_CODES: MissingCode[] = ["PHOTO", "FULL_NAME", "VEHICLE_MODEL", "PLATE"];

export const STATUS_LABELS: Record<AccessStatus, string> = {
  PENDING: "Em análise",
  APPROVED: "Autorizado para o radar (piloto)",
  REJECTED: "Não aprovado",
  CHANGES_REQUESTED: "Correções solicitadas",
};

export function normalizePlate(plate: string | null | undefined) {
  return (plate ?? "").replace(/[\s-]/g, "").toUpperCase();
}
export function isValidBrazilianPlate(plate: string | null | undefined) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(plate));
}
export function maxSeatsFor(type: VehicleType | null, category: CarCategory | null) {
  if (type === "MOTO") return 1;
  return CAR_CATEGORIES.find((c) => c.value === category)?.maxSeats ?? 7;
}

export type AccessInput = {
  avatarUrl?: string | null; fullName?: string | null; vehicleBrand?: string | null; vehicleDescription?: string | null;
  vehiclePlate?: string | null; vehicleType?: VehicleType | null; carCategory?: CarCategory | null; seats?: number | null; municipality?: string | null;
};

export function professionalAccessMissing(i: AccessInput): MissingCode[] {
  const m: MissingCode[] = [];
  if (!/^https:\/\//.test(i.avatarUrl ?? "")) m.push("PHOTO");
  if (!/^\S{2,}(\s+\S+)+$/.test((i.fullName ?? "").trim())) m.push("FULL_NAME");
  if (`${i.vehicleBrand ?? ""} ${i.vehicleDescription ?? ""}`.trim().length < 3) m.push("VEHICLE_MODEL");
  if (!isValidBrazilianPlate(i.vehiclePlate)) m.push("PLATE");
  const type = i.vehicleType ?? null;
  if (type !== "CAR" && type !== "MOTO") m.push("VEHICLE_TYPE");
  else if (type === "CAR" && !CAR_CATEGORIES.some((c) => c.value === i.carCategory)) m.push("CAR_CATEGORY");
  const s = i.seats ?? 0;
  if (!Number.isInteger(s) || s < 1 || s > 7 || s > maxSeatsFor(type, i.carCategory ?? null)) m.push("SEATS");
  if ((i.municipality ?? "").trim().length < 2) m.push("MUNICIPALITY");
  return m;
}

/** Extrai códigos de "Dados pendentes: A,B" retornados pelo banco. */
export function parseMissingError(message: string): MissingCode[] {
  const match = /Dados pendentes: ([A-Z_,]+)/.exec(message);
  return match ? (match[1].split(",").filter((c) => c in MISSING_LABELS) as MissingCode[]) : [];
}
