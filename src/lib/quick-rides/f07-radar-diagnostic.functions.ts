/**
 * F07 diagnostic map — private homologation environment ONLY.
 * Simulated points never become live GPS and cannot be dispatched.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { f07TestEnvironmentConfigured } from "@/lib/quick-rides/f07-pilot.functions";
import { geocodeAddressService } from "@/lib/location/service";
import { normalizeMunicipality, resolveCorridorMunicipality } from "@/lib/quick-rides/corridor-coverage";

const querySchema = z.object({
  municipality: z.string().trim().min(2).max(120),
  vehicleType: z.enum(["CAR","MOTO"]),
});
type TestMarker = {
  driver_key:string; lat:number; lng:number; seen_at:string;
  is_self:true; simulated:boolean;
};

async function testDbEnabled(): Promise<boolean> {
  if (!f07TestEnvironmentConfigured()) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("caronaa_f07_pilot_control")
    .select("enabled,expires_at").eq("id",true).maybeSingle();
  return !error && data?.enabled===true &&
    Date.parse(String(data.expires_at??""))>Date.now();
}

export const getF07TestSelfRadar = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>querySchema.parse(v))
  .handler(async ({context,data}):Promise<TestMarker[]>=>{
    if(!(await testDbEnabled())) return [];
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    // ID comes from verified session, NEVER the browser.
    const {data:rows,error}=await (supabaseAdmin as any).rpc(
      "caronaa_f07_test_self_radar",{
        p_user_id:context.userId,
        p_municipality:data.municipality,
        p_vehicle:data.vehicleType,
      },
    );
    if(error) return [];
    return (Array.isArray(rows)?rows:[]).filter((r:any)=>
      r.is_self===true && Number.isFinite(r.lat) &&
      Number.isFinite(r.lng)
    ).map((r:any)=>({
      driver_key:String(r.driver_key),lat:Number(r.lat),lng:Number(r.lng),
      seen_at:String(r.seen_at),is_self:true as const,simulated:r.simulated===true,
    }));
  });

export const simulateF07TestLocation = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>querySchema.parse(v))
  .handler(async ({context,data})=>{
    if(!(await testDbEnabled())){
      throw new Error("Localização simulada disponível somente no ambiente isolado de homologação.");
    }
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const admin=supabaseAdmin as any;
    const [presence,driver,region,fees,access]=await Promise.all([
      (context.supabase as any).from("professional_presence")
        .select("is_available,last_seen_at").eq("user_id",context.userId).maybeSingle(),
      admin.from("professional_driver_authorizations").select("approved,vehicle_type")
        .eq("user_id",context.userId).maybeSingle(),
      admin.from("professional_service_regions").select("public_discovery_enabled")
        .eq("municipality",data.municipality).maybeSingle(),
      (context.supabase as any).rpc("get_my_driver_platform_fees"),
      (context.supabase as any).rpc("get_my_professional_access"),
    ]);
    if(presence.error || presence.data?.is_available!==true ||
       driver.error || driver.data?.approved!==true ||
       driver.data.vehicle_type!==data.vehicleType ||
       region.error || region.data?.public_discovery_enabled!==true ||
       fees.error || fees.data?.driverAllowed!==true ||
       access.error || access.data?.authorized!==true) {
      throw new Error("Simulação indisponível: motorista, veículo ou município não habilitado.");
    }
    // This is a Google-resolved municipal CENTRE, not the driver's position.
    // Validate the city AND state to avoid a false preview from a typo.
    const geo=await geocodeAddressService(`${data.municipality}, Ceará, Brasil`);
    const resolved=resolveCorridorMunicipality(geo?.city,geo?.state,geo?.country);
    if(!resolved || normalizeMunicipality(resolved.municipality)!==
         normalizeMunicipality(data.municipality) ||
       !Number.isFinite(geo?.lat) || !Number.isFinite(geo?.lng)){
      throw new Error("Não foi possível confirmar o centro do município pelo Google.");
    }
    const now=new Date();
    const expiresAt=new Date(now.getTime()+15*60*1000).toISOString();
    const {error}=await admin.from("caronaa_f07_simulated_driver_positions")
      .upsert({
        user_id:context.userId,municipality:resolved.municipality,
        vehicle_type:data.vehicleType,lat:geo.lat,lng:geo.lng,
        updated_at:now.toISOString(),expires_at:expiresAt,
      },{onConflict:"user_id"});
    if(error)throw new Error("Migration 0144 pendente ou simulação indisponível.");
    return {
      simulated:true as const,municipality:resolved.municipality,
      lat:Number(geo.lat),lng:Number(geo.lng),
      updatedAt:now.toISOString(),expiresAt,
    };
  });

export const clearF07TestLocation = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context})=>{
    if(!f07TestEnvironmentConfigured())return {ok:false};
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {error}=await (supabaseAdmin as any)
      .from("caronaa_f07_simulated_driver_positions")
      .delete().eq("user_id",context.userId);
    return {ok:!error};
  });
