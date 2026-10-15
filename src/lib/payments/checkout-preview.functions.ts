import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readVerifiedPixFee } from "./fee-configuration";
import { quotePassengerPaysProcessingFee } from "./passenger-fee";

/** Read-only checkout preview. Authenticated payer sees the exact fare/fee before consent.
 * A QR must NEVER be created from this preview alone.
 */
export const previewAsaasCheckout = createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({rideId:z.string().uuid()}).parse(input))
  .handler(async ({context,data}) => {
    const {feeCents,verifiedAt} = readVerifiedPixFee(process.env);
    const {data:ride,error} = await context.supabase.from("rides")
      .select("ride_id,passenger_user_id,status,passenger_group_total")
      .eq("ride_id",data.rideId).maybeSingle();
    if(error || !ride || ride.passenger_user_id !== context.userId)
      throw new Error("Esta cobrança não está disponível para o seu usuário");
    if(!["CONFIRMED","IN_PROGRESS","COMPLETED"].includes(ride.status))
      throw new Error("A carona ainda não foi confirmada");
    const fareReais = ride.passenger_group_total == null ? NaN : Number(ride.passenger_group_total);
    if(!Number.isFinite(fareReais) || fareReais <= 0)
      throw new Error("Preço da reserva indisponível. Refaça a cotação.");
    const fareCents = Math.round(fareReais*100);
    return {
      rideId:data.rideId, ...quotePassengerPaysProcessingFee(fareCents,feeCents),
      feeVerifiedAt:verifiedAt, currency:"BRL" as const, sandbox:true as const,
      checkoutReady:false as const, // No confirmed customer/wallet provisioning or charge endpoint yet
    };
  });
