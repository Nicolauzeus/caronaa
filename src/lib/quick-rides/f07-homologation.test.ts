import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quoteProposedCaronaaFare, type FarePolicyConfig } from "@/lib/pricing/caronaa-fare-engine";
import { resolveCorridorMunicipality } from "./corridor-coverage";

const schema=readFileSync("drizzle/migrations/0143_f07_homologacao_end_to_end.sql","utf8");
const activation=readFileSync("scripts/sql/f07-homologacao-ativar.sql","utf8");
const cities=[
  "Fortaleza","Maracanaú","Pacatuba","Guaiúba","Acarape","Redenção",
  "Aracoiaba","Baturité","Barreira","Ocara","Capistrano","Itapiúna",
  "Aratuba","Guaramiranga","Mulungu","Pacoti","Palmácia",
];

const config=(car:boolean,region:"MACICO_BATURITE"|"OUTSIDE_MACICO"):FarePolicyConfig=>({
  standardCommissionBps: region==="OUTSIDE_MACICO" ? 1500 : 2000,
  macicoSharedCarMinimumCents:null,
  friendExtraSeatDiscountBps:0,
  exclusiveCar: car ? (region==="MACICO_BATURITE"
    ? {baseCents:500,perKmCents:200,perMinuteCents:30,minimumCents:1000}
    : {baseCents:550,perKmCents:220,perMinuteCents:35,minimumCents:1200})
    : {baseCents:0,perKmCents:0,perMinuteCents:0,minimumCents:0},
  exclusiveMotoOutside: !car ? (region==="MACICO_BATURITE"
    ? {baseCents:0,perKmCents:0,perMinuteCents:0,minimumCents:750}
    : {baseCents:350,perKmCents:120,perMinuteCents:20,minimumCents:600})
    : {baseCents:0,perKmCents:0,perMinuteCents:0,minimumCents:0},
  processingFeeCents:0,
});
function fare(car:boolean,region:"MACICO_BATURITE"|"OUTSIDE_MACICO",km:number,minutes:number){
  return quoteProposedCaronaaFare({
    distanceKm:km,durationMinutes:minutes,
    mode:car?"EXCLUSIVE_CAR":"EXCLUSIVE_MOTO",
    region,occupiedSeats:1,party:"INDIVIDUAL",
    quotedAt:"2026-11-12T12:00:00.000Z",officialActivity:null,
  },config(car,region));
}

describe("F07 homologation: 17-city corridor and tariff matrices",()=>{
  it("catalogues exactly the requested Ceará municipalities",()=>{
    expect(cities).toHaveLength(17);
    for(const city of cities){
      expect(resolveCorridorMunicipality(city,"CE","BR")).not.toBeNull();
      expect(activation).toContain("'"+city+"'");
    }
    expect(resolveCorridorMunicipality("Recife","PE","BR")).toBeNull();
    expect(activation).not.toContain("'Itaitinga'");
  });
  it("requires isolated database environment before activation",()=>{
    expect(activation).toContain("current_setting('caronaa.f07_target',true)");
    expect(activation).toContain("IS DISTINCT FROM 'homologacao'");
    expect(schema).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(schema).toContain("TO service_role");
    expect(schema).toContain("FROM PUBLIC,anon,authenticated");
    expect(activation).toContain("interval '14 days'");
    expect(schema).toContain("caronaa_f07_test_dispatch_allowed()");
  });
  it("stores approved Car/Moto tariffs and enables intercity only in staging activation",()=>{
    const policies=[
      ["MACICO_BATURITE","MOTO",0,0,0,750,2000,50,"macico-moto-piloto"],
      ["MACICO_BATURITE","CAR",500,200,30,1000,2000,100,"macico-car-piloto"],
      ["FORTALEZA_CORRIDOR","MOTO",350,120,20,600,1500,50,"fortaleza-moto-piloto"],
      ["FORTALEZA_CORRIDOR","CAR",550,220,35,1200,1500,100,"fortaleza-car-piloto"],
    ];
    for(const [region,v,b,km,minute,min,bps,margin,ver] of policies){
      expect(activation).toContain(
        `('${region}','${v}',${b},${km},${minute},${min},${bps},0,${margin},true,true,'${ver}'`
      );
    }
    expect(activation).toContain("car_enabled=true,moto_enabled=true");
    expect(activation).toContain("public_discovery_enabled=true,dispatch_enabled=true");
  });
  it("Macico Moto charges R$7.50 until 11 km and marginal price only after",()=>{
    const min=fare(false,"MACICO_BATURITE",11,18);
    expect(min.customerPaysCents).toBe(750);
    expect(min.commissionBps).toBe(2000);
    expect(min.driverReceivesCents).toBe(600);
    expect(fare(false,"MACICO_BATURITE",14,24).customerPaysCents).toBe(914);
  });
  it("quotes all four pilot combinations with correct minima and commissions",()=>{
    expect(fare(true,"MACICO_BATURITE",5,12).customerPaysCents).toBe(1860);
    expect(fare(true,"MACICO_BATURITE",5,12).commissionBps).toBe(2000);
    expect(fare(false,"OUTSIDE_MACICO",3,8).customerPaysCents).toBe(870);
    expect(fare(false,"OUTSIDE_MACICO",3,8).commissionBps).toBe(1500);
    expect(fare(true,"OUTSIDE_MACICO",5,12).customerPaysCents).toBe(2070);
    expect(fare(true,"OUTSIDE_MACICO",5,12).commissionBps).toBe(1500);
  });
  it("validates destination at quote, submit, and driver acceptance",()=>{
    const server=readFileSync("src/lib/quick-rides/quick-ride.functions.ts","utf8");
    expect(server).toContain("destination_municipality:destinationCity.municipality");
    expect(server).toContain('destinationStatus?.status!=="ENABLED"');
    expect(server).toContain("policy.intermunicipal_enabled!==true");
    expect(schema).toContain("q.destination_municipality IS NULL");
    expect(schema).toContain("q.destination_municipality=o.municipality OR t.intermunicipal_enabled");
    expect(schema).toContain("d.municipality=q.destination_municipality");
    expect(schema).toContain("guard_caronaa_quick_driver_assignment");
    expect(schema).toContain("to_jsonb(NEW) - 'ride_id'");
  });
  it("restricts pilot authorization to the service role and consented GPS",()=>{
    expect(schema).toContain("caronaa_f07_pilot_activate_driver");
    expect(schema).toContain("email_confirmed_at IS NOT NULL");
    expect(schema).toContain("public.driver_platform_access_allowed(p_user_id)");
    expect(schema).toContain("GRANT EXECUTE ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text)");
    const block=schema.split("CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_activate_driver(")[1].split("CREATE OR REPLACE FUNCTION")[0];
    expect(block).not.toContain("professional_driver_locations");
    // Historical migration contract only. Current retired endpoints are
    // exercised behaviorally in f07-retired-controls.test.ts.
  });
  it("only permits a quoted completed participant to retrieve a static Pix",()=>{
    expect(schema).toContain("get_completed_quick_ride_pix");
    expect(schema).toContain("r.passenger_id IS DISTINCT FROM auth.uid()");
    expect(schema).toContain("r.driver_id IS DISTINCT FROM auth.uid()");
    expect(schema).toContain("r.status<>'COMPLETED'");
    expect(schema).toContain("q.customer_pays_cents <> q.driver_receives_cents+q.platform_commission_cents");
    expect(schema).toContain("'automaticConfirmation',false");
  });
});
