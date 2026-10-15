import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { prepareStsRideDraft, publicationDetailsSchema, type StsRideSeed } from "./ride-activation";

function stsError(error: { code?: string; message: string }) {
  console.error("[STS] Ride activation backend failure", {
    code: error.code,
    message: error.message,
    migration: "0037_sts_first_publication.sql",
  });
  return new Error(
    "Não foi possível recuperar o trajeto STS agora. Você pode pedir ou oferecer uma carona normalmente.",
  );
}

export const getStsRideDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as SupabaseClient;
    const { data, error } = await client.rpc("get_sts_ride_seed");
    if (error) throw stsError(error);
    if (!data) return null;
    const seed = data as StsRideSeed;
    const kind = seed.intent === "MOTORISTA" ? "offer" : "request";
    const draft = prepareStsRideDraft(seed, kind);
    const alternate = prepareStsRideDraft(seed, kind === "offer" ? "request" : "offer");
    const { data: existing, error: sourceError } = await client
      .from("form_ride_publications")
      .select("request_id,offer_id")
      .eq("submission_id", seed.submissionId)
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (sourceError) throw stsError(sourceError);
    if (existing)
      return {
        ...draft,
        alternate,
        publicationId: String(existing.request_id || existing.offer_id),
      };
    // AMBOS requires an explicit role choice rather than silently publishing twice.
    if (draft.classification === "sufficient" && seed.intent !== "AMBOS") {
      const { data: id, error: publishError } = await client.rpc("publish_sts_ride", {
        p_submission_id: draft.submissionId,
        p_kind: kind,
        p_details: { ...draft.details, price: 0 },
      });
      if (!publishError) return { ...draft, alternate, publicationId: String(id) };
      if (!publishError.message.includes("already have an active")) throw stsError(publishError);
    }
    return { ...draft, alternate, publicationId: null };
  });

export const publishStsRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        kind: z.enum(["request", "offer"]),
        details: publicationDetailsSchema,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: id, error } = await (context.supabase as SupabaseClient).rpc("publish_sts_ride", {
      p_submission_id: data.submissionId,
      p_kind: data.kind,
      p_details: { ...data.details, price: 0 },
    });
    if (error) throw stsError(error);
    return { publicationId: String(id) };
  });
