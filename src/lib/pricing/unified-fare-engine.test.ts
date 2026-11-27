import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateUnifiedFare,
  DEFAULT_UNIFIED_PRICING_CONFIG,
  loadUnifiedPricingConfig,
  quoteUnifiedFare,
  type UnifiedPricingConfig,
} from "./unified-fare-engine";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  result: {data:null as unknown, error:null as unknown},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.result = {data: {on_route_rate_per_km:6/11, minimum_fare:3},error:null};
  mock.from.mockReturnValue({
    select: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle: vi.fn(async () => mock.result),
      })),
    })),
  });
});

describe("CARONAA — unified fare engine, default R$ 6 / 11km", () => {
  it.each([
    [5, 3, 6, 9],
    [11, 6, 12, 18],
    [25, 13.64, 27.28, 40.92],
  ])("ON_ROUTE car %.0fkm: one, two and three seats", (distanceKm, perSeat, two, three) => {
    const one = calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"CAR",seats:1});
    expect(one.perSeatFare).toBe(perSeat);
    expect(one.totalFare).toBe(perSeat);
    expect(calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"CAR",seats:2}).totalFare).toBe(two);
    expect(calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"CAR",seats:3}).totalFare).toBe(three);
  });

  it.each([
    [5, 3],
    [11, 6],
    [25, 13.64],
  ])("ON_ROUTE moto %.0fkm: only one seat", (distanceKm, fare) => {
    expect(calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"MOTO",seats:1}).totalFare).toBe(fare);
    expect(() => calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"MOTO",seats:2})).toThrow(/vagas/);
  });

  it.each([
    [5, 10.64],
    [11, 23.40],
    [25, 53.18],
  ])("EXCLUSIVE car %.0fkm: 3-seat base times 1.30", (distanceKm, fare) => {
    const result = calculateUnifiedFare({distanceKm,mode:"EXCLUSIVE",vehicleType:"CAR"});
    expect(result.totalFare).toBe(fare);
    expect(result.seats).toBe(3);
    expect(result.totalFareCents).toBe(Math.round(fare*100));
  });

  it.each([
    [5, 3.90],
    [11, 7.80],
    [25, 17.73],
  ])("EXCLUSIVE moto %.0fkm: 1-seat base times 1.30", (distanceKm, fare) => {
    const result = calculateUnifiedFare({distanceKm,mode:"EXCLUSIVE",vehicleType:"MOTO"});
    expect(result.totalFare).toBe(fare);
    expect(result.seats).toBe(1);
  });

  it("rounds ON_ROUTE per seat BEFORE multiplying, EXCLUSIVE only at the end", () => {
    const config:UnifiedPricingConfig = {
      on_route_rate_per_km:0.3333,minimum_fare:0.1,exclusive_multiplier:1.30,
    };
    expect(calculateUnifiedFare({distanceKm:5,mode:"ON_ROUTE",vehicleType:"CAR",seats:3},config).totalFare).toBe(5.01);
    expect(calculateUnifiedFare({distanceKm:5,mode:"EXCLUSIVE",vehicleType:"CAR"},config).totalFare).toBe(6.50);
  });

  it("enforces minimum price in both modes", () => {
    const config:UnifiedPricingConfig = {on_route_rate_per_km:0.01,minimum_fare:5,exclusive_multiplier:1.30};
    expect(calculateUnifiedFare({distanceKm:5,mode:"ON_ROUTE",vehicleType:"CAR",seats:3},config).totalFare).toBe(15);
    expect(calculateUnifiedFare({distanceKm:5,mode:"EXCLUSIVE",vehicleType:"MOTO"},config).totalFare).toBe(6.5);
  });

  it.each([0,-1,Infinity,NaN])("rejects invalid distances (%s)", distanceKm => {
    expect(()=>calculateUnifiedFare({distanceKm,mode:"ON_ROUTE",vehicleType:"CAR"})).toThrow(/distância/);
  });

  it.each([0,1.5,4,-2])("rejects invalid seat counts (%s)", seats => {
    expect(()=>calculateUnifiedFare({distanceKm:11,mode:"ON_ROUTE",vehicleType:"CAR",seats})).toThrow(/vagas/);
  });

  it("reads the two pricing columns from Supabase", async () => {
    mock.result = {data:{on_route_rate_per_km:1.5,minimum_fare:4},error:null};
    const {config,source}=await loadUnifiedPricingConfig();
    expect(mock.from).toHaveBeenCalledWith("caronaa_unified_pricing_configs");
    expect(source).toBe("DATABASE");
    expect(config).toEqual({on_route_rate_per_km:1.5,minimum_fare:4,exclusive_multiplier:1.30});
    const quote=await quoteUnifiedFare({distanceKm:5,mode:"ON_ROUTE",vehicleType:"CAR",seats:2});
    expect(quote.totalFare).toBe(15);
    expect(quote.configSource).toBe("DATABASE");
  });

  it("falls back on Supabase query error", async () => {
    mock.result={data:null,error:{code:"PGRST205"}};
    const result=await loadUnifiedPricingConfig();
    expect(result).toEqual({config:DEFAULT_UNIFIED_PRICING_CONFIG,source:"FALLBACK"});
    expect((await quoteUnifiedFare({distanceKm:11,mode:"ON_ROUTE",vehicleType:"CAR"})).totalFare).toBe(6);
  });

  it("falls back on missing or invalid configuration", async () => {
    mock.result={data:{on_route_rate_per_km:0,minimum_fare:-2},error:null};
    expect((await loadUnifiedPricingConfig()).source).toBe("FALLBACK");
    mock.result={data:null,error:null};
    expect((await loadUnifiedPricingConfig()).source).toBe("FALLBACK");
  });

  it("falls back on a network exception without logging payloads", async () => {
    mock.from.mockImplementation(()=>{throw new Error("network unavailable");});
    expect((await quoteUnifiedFare({distanceKm:5,mode:"EXCLUSIVE",vehicleType:"MOTO"})).totalFare).toBe(3.9);
  });
});
