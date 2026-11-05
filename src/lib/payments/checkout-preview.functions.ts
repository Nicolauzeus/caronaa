import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { estimateAsaasPixProcessing } from "./asaas-fee-estimate";
import { quotePassengerPaysProcessingFee } from "./passenger-fee";

/** Informational quote only: no verified merchant fee, charge or Pix QR is created. */
export const previewAsaasCheckout = createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({rideId:z.string().uuid()}).parse(input))
  .handler(async ({context,data}) => {
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
    // Contract rate is a project owner's working assumption until verified on
    // the merchant's actual Asaas tariff schedule; never use for a real charge.
    const estimate = estimateAsaasPixProcessing(fareCents);
    return {
      rideId:data.rideId,
      ...quotePassengerPaysProcessingFee(fareCents,estimate.processingFeeCents),
      estimatedFeeRateBps: estimate.rateBps,
      estimatedFeeFixedCents: estimate.fixedCents,
      estimatedProviderCostCents: estimate.estimatedProviderCostCents,
      feeVerifiedAt: null,
      feeSource: "ESTIMATED_UNVERIFIED" as const,
      currency:"BRL" as const,
      environment: process.env["ASAAS_ENV"] === "production" ? "production" as const : "sandbox" as const,
      checkoutReady:false as const,
      // ASAAS_ENABLE_CHARGES remains false until end-to-end readiness is verified.
    };
  });
