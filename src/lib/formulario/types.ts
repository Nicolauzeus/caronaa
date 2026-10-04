export type CaronaaIntent =
  | "MOTORISTA"
  | "PASSAGEIRO"
  | "AMBOS";

export type VehicleType =
  | "CARRO_PROPRIO"
  | "CARRO_COMPARTILHADO"
  | "MOTO";

export type PassengerTransport =
  | "ONIBUS"
  | "UBER_99"
  | "CARONA"
  | "BICICLETA"
  | "APE"
  | "OUTRO";

export type DepartureWindow =
  | "ANTES_18"
  | "18_19"
  | "19_20"
  | "20_21"
  | "21_22"
  | "APOS_22";

export type TrustFactor =
  | "IDENTIDADE_VERIFICADA"
  | "FOTO"
  | "WHATSAPP_VERIFICADO"
  | "PERFIL_CARONAA"
  | "DADOS_VEICULO"
  | "PLACA"
  | "AVALIACOES"
  | "PARTICIPANTE_STS"
  | "ROTA_VISIVEL"
  | "COMPARTILHAR_VIAGEM"
  | "OUTRO";

export type PriceRange =
  | "ATE_5"
  | "5_10"
  | "10_15"
  | "15_20"
  | "ACIMA_20"
  | "DEPENDE_DISTANCIA"
  | "GRATUITO";

export type CommitmentLevel =
  | "SIM_HOJE"
  | "QUERO_VER_MATCH"
  | "NAO_HOJE";

export interface CaronaaStsFormData {
  source: "sts-2026";

  intent?: CaronaaIntent;

  destinationNeighborhood?: string;
  destinationReference?: string;
  departureWindow?: DepartureWindow;

  name?: string;
  whatsapp?: string;

  // Passageiro
  passengerCount?: number;
  currentTransport?: PassengerTransport;
  passengerTrustFactors?: TrustFactor[];
  passengerPriceRange?: PriceRange;
  passengerCommitment?: CommitmentLevel;

  // Motorista
  vehicleType?: VehicleType;
  availableSeats?: number;
  maxDetourMinutes?: number;
  driverTrustFactors?: TrustFactor[];
  driverPriceRange?: PriceRange;
  driverCommitment?: CommitmentLevel;

  // Metadados
  submissionId?: string;
  createdAt?: string;
}
