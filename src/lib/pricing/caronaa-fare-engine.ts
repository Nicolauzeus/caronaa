/**
 * Pricing policy prototype: NOT YET used by payment or ride quote RPCs.
 *
 * Money is always integral BRL cents. Distances must come from trusted
 * server-side Google Routes, region/event from verified administrative data.
 * Never accept a client's claimed region, event, fee, or discount as authority.
 */
export const PROPOSED_FARE_POLICY_VERSION = "caronaa-regional-fares-v0-preview";
export const OUTSIDE_MIN_FARE_CENTS = 450;
export const MACICO_MOTO_MIN_FARE_CENTS = 750;
export const MACICO_MOTO_INCLUDED_KM = 11;
export const SOLIDARITY_REFERENCE_KM = 11;
export const SOLIDARITY_REFERENCE_CENTS = 600;
export const MACICO_COMMISSION_BPS = 2000;
export const OFFICIAL_ACTIVITY_COMMISSION_BPS = 1500;

export type PricingRegion = "MACICO_BATURITE" | "OUTSIDE_MACICO";
export type PricingMode =
  | "SHARED_CAR"
  | "SHARED_MOTO"
  | "EXCLUSIVE_CAR"
  | "EXCLUSIVE_MOTO";
export type PartyKind = "INDIVIDUAL" | "FRIENDS";

export interface ExclusiveRateCard {
  // The business has NOT approved these amounts; supply them from policy config.
  baseCents: number;
  perKmCents: number;
  perMinuteCents: number;
  minimumCents: number;
}

export interface OfficialActivityEvidence {
  id: string;
  published: boolean;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  pickupInsideApprovedArea: boolean;
}

export interface FarePolicyConfig {
  /** Outside Maciço and outside events: not yet chosen. Null MUST fail closed. */
  standardCommissionBps: number | null;
  /** Explicit configured Maciço shared-car minimum, pending validation. */
  macicoSharedCarMinimumCents: number | null;
  /** Percentage off EXTRA occupied seats, funded by platform earnings. */
  friendExtraSeatDiscountBps: number;
  exclusiveCar: ExclusiveRateCard;
  exclusiveMotoOutside: ExclusiveRateCard;
  /** Real transaction fee per charge, funded by the platform, never hidden. */
  processingFeeCents: number;
}

export interface FareQuoteInput {
  distanceKm: number;
  durationMinutes?: number;
  mode: PricingMode;
  region: PricingRegion;
  /** Occupants, not number of distinct accounts. */
  occupiedSeats: number;
  party: PartyKind;
  /** Supply by server; do not trust request-body activity flags. */
  officialActivity?: OfficialActivityEvidence | null;
  /** Server quote creation timestamp. */
  quotedAt: string;
}

export interface ProposedFareQuote {
  reference: typeof PROPOSED_FARE_POLICY_VERSION;
  mode: PricingMode;
  region: PricingRegion;
  commissionSource: "OFFICIAL_ACTIVITY" | "MACICO" | "STANDARD";
  commissionBps: number;
  occupiedSeats: number;
  referenceFareCents: number;
  standardGroupTotalCents: number;
  platformFundedDiscountCents: number;
  customerPaysCents: number;
  driverReceivesCents: number;
  platformGrossCommissionCents: number;
  platformNetBeforeTaxesCents: number;
  processingFeeCents: number;
}

function integerCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Política inválida: ${field} deve ser um inteiro em centavos.`);
  }
  return value;
}
function basisPoints(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 4000) {
    throw new Error(`Política inválida: ${field} deve estar entre 0 e 4000 bps.`);
  }
  return value;
}
function validateExclusiveCard(card: ExclusiveRateCard): void {
  integerCents(card.baseCents, "baseCents");
  integerCents(card.perKmCents, "perKmCents");
  integerCents(card.perMinuteCents, "perMinuteCents");
  integerCents(card.minimumCents, "minimumCents");
}

function activityIsEligible(activity: OfficialActivityEvidence | null | undefined, quotedAt: string): boolean {
  if (!activity || !activity.enabled || !activity.published ||
      !activity.pickupInsideApprovedArea || !activity.id.trim()) return false;
  const begin = Date.parse(activity.startsAt);
  const end = Date.parse(activity.endsAt);
  const now = Date.parse(quotedAt);
  return Number.isFinite(begin) && Number.isFinite(end) &&
    Number.isFinite(now) && begin < end && now >= begin && now < end;
}

function commissionRate(
  input: FareQuoteInput,
  config: FarePolicyConfig,
): Pick<ProposedFareQuote, "commissionSource" | "commissionBps"> {
  if (activityIsEligible(input.officialActivity, input.quotedAt)) {
    return {
      commissionSource: "OFFICIAL_ACTIVITY",
      commissionBps: OFFICIAL_ACTIVITY_COMMISSION_BPS,
    };
  }
  if (input.region === "MACICO_BATURITE") {
    return { commissionSource: "MACICO", commissionBps: MACICO_COMMISSION_BPS };
  }
  if (config.standardCommissionBps == null)
    throw new Error("Comissão padrão fora de atividade ainda não definida pela administração.");
  return {
    commissionSource: "STANDARD",
    commissionBps: basisPoints(config.standardCommissionBps, "standardCommissionBps"),
  };
}

function referenceFare(
  input: FareQuoteInput,
  config: FarePolicyConfig,
): { fare: number; floor: number } {
  const { distanceKm, durationMinutes, region, mode } = input;
  // Mototaxi in Maciço: R$ 7.50 covers up to 11km, then the 6/11km
  // marginal rate applies to the EXCESS, not retroactively to the whole trip.
  if (region === "MACICO_BATURITE" &&
      (mode === "SHARED_MOTO" || mode === "EXCLUSIVE_MOTO")) {
    const extraDistance = Math.max(0, distanceKm - MACICO_MOTO_INCLUDED_KM);
    return {
      fare: MACICO_MOTO_MIN_FARE_CENTS +
        Math.round(extraDistance * SOLIDARITY_REFERENCE_CENTS / SOLIDARITY_REFERENCE_KM),
      floor: MACICO_MOTO_MIN_FARE_CENTS,
    };
  }
  if (mode === "SHARED_CAR" || mode === "SHARED_MOTO") {
    let floor = OUTSIDE_MIN_FARE_CENTS;
    if (region === "MACICO_BATURITE" && mode === "SHARED_CAR") {
      if (config.macicoSharedCarMinimumCents == null) {
        throw new Error("Tarifa mínima para carro compartilhado no Maciço ainda não definida.");
      }
      floor = integerCents(config.macicoSharedCarMinimumCents, "macicoSharedCarMinimumCents");
    }
    return {
      fare: Math.max(floor, Math.round(distanceKm * SOLIDARITY_REFERENCE_CENTS / SOLIDARITY_REFERENCE_KM)),
      floor,
    };
  }
  const card = mode === "EXCLUSIVE_CAR" ? config.exclusiveCar : config.exclusiveMotoOutside;
  validateExclusiveCard(card);
  if (durationMinutes == null || !Number.isFinite(durationMinutes) || durationMinutes < 0)
    throw new Error("Duração estimada Google Routes obrigatória para corrida exclusiva.");
  const floor = Math.max(
    region === "OUTSIDE_MACICO" ? OUTSIDE_MIN_FARE_CENTS : 0,
    card.minimumCents,
  );
  return {
    fare: Math.max(floor, card.baseCents +
      Math.round(distanceKm * card.perKmCents) +
      Math.round(durationMinutes * card.perMinuteCents)),
    floor,
  };
}

export function quoteProposedCaronaaFare(
  input: FareQuoteInput,
  config: FarePolicyConfig,
): ProposedFareQuote {
  if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0 ||
      input.distanceKm > 1500) throw new Error("Distância rodoviária inválida.");
  if (input.region !== "MACICO_BATURITE" && input.region !== "OUTSIDE_MACICO")
    throw new Error("Região de precificação inválida.");
  if (!Number.isFinite(Date.parse(input.quotedAt)))
    throw new Error("Horário da cotação inválido.");
  if (!Number.isInteger(input.occupiedSeats) || input.occupiedSeats < 1 ||
      input.occupiedSeats > 7) throw new Error("Quantidade de passageiros inválida.");
  if ((input.mode === "SHARED_MOTO" || input.mode === "EXCLUSIVE_MOTO") &&
      input.occupiedSeats > 1) throw new Error("Moto permite somente um passageiro.");
  if (input.party === "FRIENDS" && (input.mode !== "SHARED_CAR" ||
      input.occupiedSeats < 2)) {
    throw new Error("Desconto de amigos exige duas ou mais vagas de carona compartilhada.");
  }
  if (input.party !== "FRIENDS" && input.occupiedSeats > 1 &&
      input.mode === "SHARED_CAR")
    throw new Error("Mais de uma vaga sob uma conta exige reserva de amigos.");

  const { fare, floor } = referenceFare(input, config);
  const { commissionBps, commissionSource } = commissionRate(input, config);
  const commission = Math.round(
    (input.mode.startsWith("EXCLUSIVE") ? fare : fare * input.occupiedSeats) *
    commissionBps / 10000,
  );
  const count = input.mode.startsWith("EXCLUSIVE") ? 1 : input.occupiedSeats;
  const standardTotal = fare * count;
  const processingFeeCents = integerCents(config.processingFeeCents, "processingFeeCents");
  if (commission < processingFeeCents) {
    throw new Error("Taxa de processamento supera a receita disponível para a plataforma.");
  }
  const friendsDiscountBps = basisPoints(
    config.friendExtraSeatDiscountBps, "friendExtraSeatDiscountBps",
  );
  // The driver is paid as if there were NO marketing discount. The platform
  // funds only what its commission can cover and keeps each seat's min floor.
  const requestedDiscount = input.party === "FRIENDS"
    ? Math.round((input.occupiedSeats - 1) * fare * friendsDiscountBps / 10000)
    : 0;
  const discount = Math.min(
    requestedDiscount,
    Math.max(0, standardTotal - floor * count),
    Math.max(0, commission - processingFeeCents),
  );
  const customerPays = standardTotal - discount;
  const driverReceives = standardTotal - commission;
  const platformNet = commission - discount - processingFeeCents;
  if (!Number.isSafeInteger(customerPays) || !Number.isSafeInteger(driverReceives) ||
      !Number.isSafeInteger(platformNet) || platformNet < 0) {
    throw new Error("Cotação financeira inválida.");
  }
  if (input.region === "MACICO_BATURITE" && input.mode.endsWith("MOTO") &&
      driverReceives < 600) {
    throw new Error("A remuneração do mototaxista no Maciço não pode ser inferior a R$ 6.");
  }
  return {
    reference: PROPOSED_FARE_POLICY_VERSION,
    mode: input.mode,
    region: input.region,
    commissionSource,
    commissionBps,
    occupiedSeats: input.occupiedSeats,
    referenceFareCents: fare,
    standardGroupTotalCents: standardTotal,
    platformFundedDiscountCents: discount,
    customerPaysCents: customerPays,
    driverReceivesCents: driverReceives,
    platformGrossCommissionCents: commission,
    platformNetBeforeTaxesCents: platformNet,
    processingFeeCents,
  };
}
