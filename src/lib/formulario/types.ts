export type CaronaaIntent = "MOTORISTA" | "PASSAGEIRO" | "AMBOS";

export type VehicleType = "CARRO_PROPRIO" | "CARRO_COMPARTILHADO" | "MOTO";

export type PassengerTransport =
  | "ONIBUS"
  | "METRO_VLT"
  | "CARRO_PROPRIO"
  | "MOTO_PROPRIA"
  | "UBER_99"
  | "TAXI"
  | "CARONA"
  | "BICICLETA"
  | "APE"
  | "COMBINACAO"
  | "OUTRO";

export type DepartureWindow = "ANTES_18" | "18_19" | "19_20" | "20_21" | "21_22" | "APOS_22";

export type UserOccupation = "ESTUDANTE" | "TRABALHADOR" | "ESTUDANTE_TRABALHADOR" | "OUTRO";

export type WeeklyFrequency = "1_2" | "3_4" | "5_MAIS" | "EVENTUAL";

export type RouteCostRange = "0_5" | "6_10" | "11_20" | "21_30" | "31_50" | "ACIMA_50";

export type CostPeriod = "POR_TRECHO" | "POR_DIA";

export type PainPointCode =
  | "DOR_01"
  | "DOR_02"
  | "DOR_03"
  | "DOR_04"
  | "DOR_05"
  | "DOR_06"
  | "OUTRO_PROBLEMA"
  | "SEM_GRANDES_DIFICULDADES";

export type InterestLevel =
  "USARIA_HOJE" | "PROVAVELMENTE_USARIA" | "TALVEZ" | "PROVAVELMENTE_NAO" | "NAO_USARIA";

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
  "ATE_5" | "5_10" | "10_15" | "15_20" | "ACIMA_20" | "DEPENDE_DISTANCIA" | "GRATUITO";

export type CommitmentLevel = "SIM_HOJE" | "QUERO_VER_MATCH" | "NAO_HOJE";

export interface CaronaaStsFormData {
  source: string;
  campaign?: string | null | undefined;

  intent?: CaronaaIntent | undefined;

  destinationNeighborhood?: string | undefined;
  destinationReference?: string | undefined;
  originNeighborhood?: string | undefined;
  departureWindow?: DepartureWindow | undefined;
  occupation?: UserOccupation | undefined;
  weeklyFrequency?: WeeklyFrequency | undefined;

  name?: string | undefined;
  whatsapp?: string | undefined;
  email?: string | undefined;

  // Passageiro
  passengerCount?: number | undefined;
  currentTransport?: PassengerTransport | undefined;
  routeCostRange?: RouteCostRange | undefined;
  costPeriod?: CostPeriod | undefined;
  painPoints?: PainPointCode[] | undefined;
  mainPainPoint?: PainPointCode | undefined;
  mainPainIntensity?: number | undefined;
  passengerInterest?: InterestLevel | undefined;
  passengerTrustFactors?: TrustFactor[] | undefined;
  passengerPriceRange?: PriceRange | undefined;
  passengerCommitment?: CommitmentLevel | undefined;

  // Motorista
  vehicleType?: VehicleType | undefined;
  availableSeats?: number | undefined;
  maxDetourMinutes?: number | undefined;
  driverTrustFactors?: TrustFactor[] | undefined;
  driverPrice?: number | undefined;
  caronaaFee?: number | undefined;
  driverNetAmount?: number | undefined;
  familyCarCompanions?: number | undefined;
  driverInterest?: InterestLevel | undefined;
  driverCommitment?: CommitmentLevel | undefined;

  // Metadados
  campaignEvent?: string | undefined;
  submissionId?: string | undefined;
  createdAt?: string | undefined;
}
