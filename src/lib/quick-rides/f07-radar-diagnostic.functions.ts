/** Retired diagnostic endpoints. Public F07 only accepts real consented GPS.
 * Keep old calls harmless without querying or changing operational data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const querySchema = z.object({
  municipality: z.string().trim().min(2).max(120),
  vehicleType: z.enum(["CAR","MOTO"]),
});
type TestMarker = {
  driver_key:string; lat:number; lng:number; seen_at:string;
  is_self:true; simulated:boolean;
};

export const getF07TestSelfRadar = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>querySchema.parse(v))
  .handler(async ():Promise<TestMarker[]>=>[]);

export const simulateF07TestLocation = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>querySchema.parse(v))
  .handler(async ()=>{
    throw new Error("Posição simulada indisponível. Autorize a localização real do aparelho.");
  });

export const clearF07TestLocation = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ()=>({ok:false}));
