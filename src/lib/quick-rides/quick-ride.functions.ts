import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reverseGeocodeService } from "@/lib/location/service";
import { getDrivingRoute } from "@/lib/road-routing";
import { sessionRequest } from "@/lib/session-request-cache";
import {
  quoteProposedCaronaaFare,
  type FarePolicyConfig,
  type ExclusiveRateCard,
} from "@/lib/pricing/caronaa-fare-engine";
import { insideApprovedActivityRadius, resolveCorridorMunicipality } from "./corridor-coverage";

const point = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
const vehicle = z.enum(["CAR", "MOTO"]);
const coverageInput = point.extend({vehicleType:vehicle});
const quoteInput = z.object({
  origin: point, destination: point,
  originLabel: z.string().trim().min(3).max(180),
  destinationLabel: z.string().trim().min(3).max(180),
  vehicleType: vehicle,
}).refine(v=>v.origin.lat!==v.destination.lat || v.origin.lng!==v.destination.lng,
  {message:"Origem e destino devem ser diferentes."});
const quoteIdSchema = z.object({quoteId:z.string().uuid()});
const interestInput = z.object({
  municipality:z.string().trim().min(2).max(120),
  vehicleType:vehicle,
});
export type QuickRideCoverageStatus = "ENABLED" | "WAITLIST" | "OUTSIDE" | "UNKNOWN";
export type QuickRideCoverage = {
  municipality:string|null;
  region:"FORTALEZA_CORRIDOR"|"MACICO_BATURITE"|null;
  status:QuickRideCoverageStatus;
  radar:boolean;
  dispatch:boolean;
};
export type QuickRideFarePreview = {
  quoteId:string; expiresAt:string; municipality:string;
  region:string; vehicleType:"CAR"|"MOTO";
  distanceKm:number; durationMinutes:number;
  customerPaysCents:number; driverReceivesCents:number;
  platformCommissionCents:number; commissionBps:number;
  commissionSource:"OFFICIAL_ACTIVITY"|"MACICO"|"STANDARD";
  policyVersion:string;
};
function safeCents(n:unknown):number{
  const value=Number(n);
  if(!Number.isSafeInteger(value)||value<0)throw new Error("Tarifa profissional não configurada.");
  return value;
}
function rateCard(row:any):ExclusiveRateCard{
  return {
    baseCents:safeCents(row.base_cents),
    perKmCents:safeCents(row.per_km_cents),
    perMinuteCents:safeCents(row.per_minute_cents),
    minimumCents:safeCents(row.minimum_cents),
  };
}

/** Server-verified coordinates + Google address components; user profile is
 * intentionally NEVER read to infer pricing or dispatch eligibility.
 */
async function resolveCoverage(client:any,coordinates:z.infer<typeof coverageInput>):Promise<QuickRideCoverage>{
  let reverse: Awaited<ReturnType<typeof reverseGeocodeService>> = null;
  try {
    reverse=await sessionRequest(
      "quick-region-reverse:"+coordinates.lat.toFixed(5)+":"+coordinates.lng.toFixed(5),
      ()=>reverseGeocodeService(coordinates.lat,coordinates.lng),90_000,
    );
  }
  catch { /* Geocoding failure is UNKNOWN, never an invented municipality. */ }
  if(!reverse?.city) return {
    municipality:null,region:null,status:"UNKNOWN",radar:false,dispatch:false,
  };
  const canonical=resolveCorridorMunicipality(reverse.city,reverse.state,reverse.country);
  if(!canonical) return {
    municipality:reverse.city,region:null,status:"OUTSIDE",radar:false,dispatch:false,
  };
  const {data,error}=await client.rpc("caronaa_quick_region_status",{
    p_municipality:canonical.municipality,
    p_vehicle:coordinates.vehicleType,
  });
  if(error) throw new Error("Cobertura temporariamente indisponível. Confira a migration 0139.");
  const status=String(data?.status??"WAITLIST");
  return {
    municipality:canonical.municipality,region:canonical.region,
    status:status==="ENABLED"?"ENABLED":status==="OUTSIDE"?"OUTSIDE":"WAITLIST",
    radar:data?.radar===true,dispatch:data?.dispatch===true,
  };
}

export const getQuickRideCoverage = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>coverageInput.parse(v))
  .handler(async ({context,data}) => resolveCoverage(context.supabase,data));

export const getQuickRideFarePreview = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>quoteInput.parse(v))
  .handler(async ({context,data})=>{
    const {data:rateAllowed,error:rateError}=await (context.supabase as any)
      .rpc("caronaa_quick_quote_rate_gate");
    if(rateError||rateAllowed!==true)
      throw new Error("Limite de cotações atingido ou serviço indisponível. Tente novamente em um minuto.");
    const coverage=await resolveCoverage(context.supabase,{
      ...data.origin,vehicleType:data.vehicleType,
    });
    if(coverage.status!=="ENABLED"||!coverage.municipality||!coverage.region)
      throw new Error(
        coverage.status==="OUTSIDE"
          ? "O embarque fica fora da área de atendimento atual."
          : "Esta modalidade ainda não está habilitada neste município."
      );
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const admin=supabaseAdmin as any;
    const {data:policy,error:policyError}=await admin.from("caronaa_quick_tariff_policies")
      .select("pricing_region,vehicle_type,base_cents,per_km_cents,per_minute_cents,minimum_cents,commission_bps,processing_fee_cents,minimum_platform_margin_cents,intermunicipal_enabled,policy_version,published")
      .eq("pricing_region",coverage.region)
      .eq("vehicle_type",data.vehicleType)
      .eq("published",true).maybeSingle();
    if(policyError||!policy) throw new Error("Tarifa ainda não homologada pela operação.");
    // For a point-to-point commercial trip, a destination outside the corridor
    // is not silently assumed to be permitted. Municipal borders may require
    // different authorizations even if Google Routes can calculate the road.
    const destinationReverse=await sessionRequest(
      "quick-destination-city:"+context.userId+":"+
        data.destination.lat.toFixed(5)+":"+data.destination.lng.toFixed(5),
      ()=>reverseGeocodeService(data.destination.lat,data.destination.lng),90_000,
    );
    if(!destinationReverse?.city) throw new Error("Não foi possível verificar o município de destino.");
    const destinationCity=resolveCorridorMunicipality(
      destinationReverse.city,destinationReverse.state,destinationReverse.country,
    );
    if(!destinationCity)
      throw new Error("Destino fora da cobertura habilitada. Selecione um destino no eixo Fortaleza–Maciço.");
    if(destinationCity.municipality!==coverage.municipality) {
      if(policy.intermunicipal_enabled!==true)
        throw new Error("Esta modalidade ainda não foi homologada para corridas entre municípios.");
      const {data:destinationStatus,error:destinationError}=
        await (context.supabase as any).rpc("caronaa_quick_region_status",{
          p_municipality:destinationCity.municipality,p_vehicle:data.vehicleType,
        });
      if(destinationError||destinationStatus?.status!=="ENABLED")
        throw new Error("Destino ainda não habilitado para esta modalidade.");
    }
    // No incorrect costs or unapproved tariff can be produced client-side.
    const commissionBps=safeCents(policy.commission_bps);
    if(commissionBps>4000||
       (coverage.region==="MACICO_BATURITE"&&commissionBps!==2000))
      throw new Error("Política de comissão profissional inconsistente.");
    const quotedAt=new Date().toISOString();
    const {data:events,error:eventsError}=await admin.from("caronaa_quick_official_activities")
      .select("id,starts_at,ends_at,center_lat,center_lng,radius_m,published")
      .eq("municipality",coverage.municipality).eq("published",true)
      .lte("starts_at",quotedAt).gt("ends_at",quotedAt).limit(30);
    if(eventsError) throw new Error("Não foi possível verificar a política de atividades.");
    const matchingEvent=(events??[]).find((e:any)=>
      insideApprovedActivityRadius(data.origin,{
        center_lat:Number(e.center_lat),
        center_lng:Number(e.center_lng),
        radius_m:Number(e.radius_m),
      })
    );
    const serviceRate=rateCard(policy);
    const config:FarePolicyConfig={
      standardCommissionBps:commissionBps,
      macicoSharedCarMinimumCents:null,
      friendExtraSeatDiscountBps:0,
      exclusiveCar:data.vehicleType==="CAR"?serviceRate:{
        baseCents:0,perKmCents:0,perMinuteCents:0,minimumCents:0,
      },
      exclusiveMotoOutside:data.vehicleType==="MOTO"?serviceRate:{
        baseCents:0,perKmCents:0,perMinuteCents:0,minimumCents:0,
      },
      processingFeeCents:safeCents(policy.processing_fee_cents),
    };
    const key="quick-fare-route:"+context.userId+":"+data.origin.lat.toFixed(5)+":"+
      data.origin.lng.toFixed(5)+":"+data.destination.lat.toFixed(5)+":"+
      data.destination.lng.toFixed(5);
    const road=await sessionRequest(key,()=>getDrivingRoute([data.origin,data.destination]),60_000);
    const q=quoteProposedCaronaaFare({
      distanceKm:road.distanceKm,
      durationMinutes:road.durationMinutes,
      mode:data.vehicleType==="MOTO"?"EXCLUSIVE_MOTO":"EXCLUSIVE_CAR",
      region:coverage.region==="MACICO_BATURITE"?"MACICO_BATURITE":"OUTSIDE_MACICO",
      occupiedSeats:1,
      party:"INDIVIDUAL",
      quotedAt,
      officialActivity:matchingEvent?{
        id:String(matchingEvent.id),published:true,enabled:true,
        startsAt:String(matchingEvent.starts_at),
        endsAt:String(matchingEvent.ends_at),
        pickupInsideApprovedArea:true,
      }:null,
    },config);
    if(q.platformNetBeforeTaxes < safeCents(policy.minimum_platform_margin_cents))
      throw new Error("Esta tarifa não cobre a margem operacional mínima. A operação precisa revisar o preço antes de abrir solicitações.");
    // Prices are only inserted from this authenticated SERVER function.
    const {data:record,error:saveError}=await admin.from("caronaa_quick_fare_quotes")
      .insert({
        passenger_id:context.userId,municipality:coverage.municipality,
        pricing_region:coverage.region,vehicle_type:data.vehicleType,
        origin_label:data.originLabel,destination_label:data.destinationLabel,
        origin_lat:data.origin.lat,origin_lng:data.origin.lng,
        destination_lat:data.destination.lat,destination_lng:data.destination.lng,
        distance_km:road.distanceKm,duration_minutes:road.durationMinutes,
        customer_pays_cents:q.customerPaysCents,
        driver_receives_cents:q.driverReceivesCents,
        platform_commission_cents:q.platformGrossCommissionCents,
        platform_processing_fee_cents:q.processingFeeCents,
        commission_bps:q.commissionBps,
        policy_version:String(policy.policy_version),
        activity_id:matchingEvent?.id??null,
      }).select("id,expires_at").single();
    if(saveError||!record)throw new Error("Não foi possível registrar a cotação da corrida.");
    return {
      quoteId:String(record.id),expiresAt:String(record.expires_at),
      municipality:coverage.municipality,region:coverage.region,vehicleType:data.vehicleType,
      distanceKm:road.distanceKm,durationMinutes:road.durationMinutes,
      customerPaysCents:q.customerPaysCents,driverReceivesCents:q.driverReceivesCents,
      platformCommissionCents:q.platformGrossCommissionCents,
      commissionBps:q.commissionBps,commissionSource:q.commissionSource,
      policyVersion:String(policy.policy_version),
    } satisfies QuickRideFarePreview;
  });

export const submitQuotedQuickRide = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>quoteIdSchema.parse(v))
  .handler(async({context,data})=>{
    const {data:rideId,error}=await (context.supabase as any)
      .rpc("caronaa_quick_submit_quoted",{p_quote_id:data.quoteId});
    if(error||typeof rideId!=="string")
      throw new Error("Não foi possível solicitar a corrida. Verifique se a cotação ainda é válida.");
    return {rideId};
  });

export const registerQuickRideRegionInterest = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>interestInput.parse(v))
  .handler(async({context,data})=>{
    const {error}=await (context.supabase as any)
      .rpc("caronaa_register_coverage_interest",{
        p_municipality:data.municipality,p_vehicle:data.vehicleType,
      });
    if(error)throw new Error("Não foi possível registrar seu interesse.");
    return {ok:true};
  });
