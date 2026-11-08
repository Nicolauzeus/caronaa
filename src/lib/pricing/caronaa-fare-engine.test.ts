import { describe, expect, it } from "vitest";
import {
  quoteProposedCaronaaFare,
  type FarePolicyConfig, type FareQuoteInput,
  MACICO_MOTO_MIN_FARE_CENTS, OUTSIDE_MIN_FARE_CENTS,
} from "./caronaa-fare-engine";

const config: FarePolicyConfig = {
  // All configurable values in these tests are ILLUSTRATIVE, not live fares.
  standardCommissionBps: 2000,
  macicoSharedCarMinimumCents: null,
  friendExtraSeatDiscountBps: 1000,
  exclusiveCar: {
    baseCents: 700, perKmCents: 180, perMinuteCents: 25, minimumCents: 950,
  },
  exclusiveMotoOutside: {
    baseCents: 450, perKmCents: 100, perMinuteCents: 10, minimumCents: 500,
  },
  processingFeeCents: 0,
};
const base: FareQuoteInput = {
  distanceKm: 11,
  durationMinutes: 25,
  mode: "SHARED_CAR",
  region: "OUTSIDE_MACICO",
  occupiedSeats: 1,
  party: "INDIVIDUAL",
  quotedAt: "2026-11-07T20:00:00.000Z",
};
const activity = {
  id: "event-2026",
  published: true,
  enabled: true,
  startsAt: "2026-11-07T19:00:00.000Z",
  endsAt: "2026-11-07T23:00:00.000Z",
  pickupInsideApprovedArea: true,
};

describe("CARONAA pricing policy draft (not yet active)", () => {
  it("outside Maciço: minimum R$ 4.50; exactly 11km costs R$ 6.00", () => {
    expect(OUTSIDE_MIN_FARE_CENTS).toBe(450);
    expect(quoteProposedCaronaaFare({...base,distanceKm:2},config).customerPaysCents).toBe(450);
    expect(quoteProposedCaronaaFare(base,config).customerPaysCents).toBe(600);
  });

  it("Maciço moto: R$ 7.50 includes <=11km and 20% leaves R$ 6.00 to driver", () => {
    expect(MACICO_MOTO_MIN_FARE_CENTS).toBe(750);
    for(const km of [0.5,5,11]) {
      const q=quoteProposedCaronaaFare({...base,region:"MACICO_BATURITE",mode:"EXCLUSIVE_MOTO",distanceKm:km},config);
      expect(q.customerPaysCents).toBe(750);
      expect(q.platformGrossCommissionCents).toBe(150);
      expect(q.driverReceivesCents).toBe(600);
      expect(q.commissionBps).toBe(2000);
    }
  });

  it("Maciço moto after 11km charges only extra kilometres at R$6 per 11km", () => {
    const q=quoteProposedCaronaaFare({...base,mode:"SHARED_MOTO",region:"MACICO_BATURITE",distanceKm:12},config);
    expect(q.customerPaysCents).toBe(805);
    expect(q.driverReceivesCents).toBe(644);
    expect(q.platformGrossCommissionCents).toBe(161);
  });

  it("refuses a R$7.50 mototaxi quote if each Asaas Pix costs R$1.99", () => {
    const input={...base,region:"MACICO_BATURITE" as const,mode:"EXCLUSIVE_MOTO" as const};
    expect(()=>quoteProposedCaronaaFare(input,{...config,processingFeeCents:199})).toThrow(/processamento supera/);
    const promo=quoteProposedCaronaaFare(input,{...config,processingFeeCents:99});
    expect(promo.customerPaysCents).toBe(750);
    expect(promo.driverReceivesCents).toBe(600);
    expect(promo.platformGrossCommissionCents).toBe(150);
    expect(promo.platformNetBeforeTaxesCents).toBe(51);
  });

  it("event 15% overrides regional 20% only when active and within authorized area", () => {
    const input={...base,mode:"EXCLUSIVE_MOTO" as const,region:"MACICO_BATURITE" as const,officialActivity:activity};
    const q=quoteProposedCaronaaFare(input,config);
    expect(q.commissionSource).toBe("OFFICIAL_ACTIVITY");
    expect(q.commissionBps).toBe(1500);
    expect(q.customerPaysCents).toBe(750);
    expect(q.driverReceivesCents).toBe(637);
    expect(quoteProposedCaronaaFare({...input,officialActivity:{...activity,pickupInsideApprovedArea:false}},config).commissionBps).toBe(2000);
    expect(quoteProposedCaronaaFare({...input,quotedAt:"2026-11-08T01:00:00Z"},config).commissionBps).toBe(2000);
    expect(quoteProposedCaronaaFare({...input,officialActivity:{...activity,published:false}},config).commissionBps).toBe(2000);
  });

  it("activity 15% cannot cover a R$1.99 dynamic Pix on the R$7.50 minimum", () => {
    const input={...base,mode:"EXCLUSIVE_MOTO" as const,
      region:"MACICO_BATURITE" as const,officialActivity:activity};
    expect(()=>quoteProposedCaronaaFare(input,{...config,processingFeeCents:199})).toThrow(/processamento supera/);
    const promotional=quoteProposedCaronaaFare(input,{...config,processingFeeCents:99});
    expect(promotional.platformGrossCommissionCents).toBe(113);
    expect(promotional.platformNetBeforeTaxesCents).toBe(14);
    expect(promotional.driverReceivesCents).toBe(637);
  });

  it("outside-event default commission is not silently set to 15%", () => {
    expect(()=>quoteProposedCaronaaFare(base,{...config,standardCommissionBps:null})).toThrow(/não definida/);
    const q=quoteProposedCaronaaFare(base,config);
    expect(q.commissionSource).toBe("STANDARD");
    expect(q.commissionBps).toBe(2000); // explicitly configured illustrative rate
  });

  it("two friends occupy two real seats, discount is funded by the platform", () => {
    const q=quoteProposedCaronaaFare({...base,party:"FRIENDS",occupiedSeats:2},config);
    expect(q.standardGroupTotalCents).toBe(1200);
    expect(q.platformGrossCommissionCents).toBe(240);
    expect(q.platformFundedDiscountCents).toBe(60);
    expect(q.customerPaysCents).toBe(1140);
    expect(q.driverReceivesCents).toBe(960);
    expect(q.platformNetBeforeTaxesCents).toBe(180);
    expect(q.customerPaysCents).toBe(q.driverReceivesCents+q.platformNetBeforeTaxesCents);
  });

  it("a friends discount cannot put any of three seats below R$ 4.50", () => {
    const q=quoteProposedCaronaaFare({...base,party:"FRIENDS",occupiedSeats:3,distanceKm:2},config);
    expect(q.standardGroupTotalCents).toBe(1350);
    expect(q.platformFundedDiscountCents).toBe(0);
    expect(q.customerPaysCents).toBe(1350);
  });

  it("platform covers payment costs and caps discounts to remaining commission", () => {
    const q=quoteProposedCaronaaFare({...base,party:"FRIENDS",occupiedSeats:2},
      {...config,processingFeeCents:200});
    expect(q.platformFundedDiscountCents).toBe(40);
    expect(q.platformNetBeforeTaxesCents).toBe(0);
    expect(q.driverReceivesCents).toBe(960);
    expect(()=>quoteProposedCaronaaFare(base,{...config,processingFeeCents:121})).toThrow(/processamento supera/);
  });

  it("exclusive car uses its own base, kilometres and minutes, not 6/11 flat", () => {
    const q=quoteProposedCaronaaFare({...base,mode:"EXCLUSIVE_CAR",occupiedSeats:3,party:"INDIVIDUAL",
      distanceKm:10,durationMinutes:20},config);
    expect(q.customerPaysCents).toBe(3000); // 700 + 1800 + 500
    expect(q.referenceFareCents).toBe(3000);
    expect(q.driverReceivesCents).toBe(2400);
  });

  it("exclusive moto outside Maciço uses a different configured rate card", () => {
    const q=quoteProposedCaronaaFare({...base,mode:"EXCLUSIVE_MOTO",distanceKm:2,durationMinutes:5},config);
    expect(q.customerPaysCents).toBe(700);
    expect(q.driverReceivesCents).toBe(560);
  });

  it("does not invent a Maciço shared-car minimum", () => {
    expect(()=>quoteProposedCaronaaFare({...base,region:"MACICO_BATURITE"},config)).toThrow(/não definida/);
  });

  it("rejects moto with multiple seats or unverified friends discount", () => {
    expect(()=>quoteProposedCaronaaFare({...base,mode:"SHARED_MOTO",occupiedSeats:2},config)).toThrow(/Moto/);
    expect(()=>quoteProposedCaronaaFare({...base,party:"FRIENDS"},config)).toThrow(/duas ou mais/);
    expect(()=>quoteProposedCaronaaFare({...base,occupiedSeats:2},config)).toThrow(/reserva de amigos/);
    expect(()=>quoteProposedCaronaaFare({...base,distanceKm:0},config)).toThrow(/Distância/);
    expect(()=>quoteProposedCaronaaFare({...base,distanceKm:Infinity},config)).toThrow(/Distância/);
  });
});
