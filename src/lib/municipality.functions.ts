import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { municipalityFromGoogle } from "./municipality";

// Reuse the project's user-owned Google server credential; never the browser key.
export const searchMunicipalities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().trim().min(2).max(120), sessionToken: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getGoogleServerKey } = await import("./location/google-server-key");
    const key = getGoogleServerKey();
    if (!key) throw new Error("Busca de municípios Google não configurada.");
    const { authenticatedGoogleRequest } = await import("./google-request.server");
    const response = await authenticatedGoogleRequest({
      url: "https://places.googleapis.com/v1/places:autocomplete", key,
      userId: context.userId, caller: "searchMunicipalities", operation: "autocomplete",
      fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      body: { input: data.query, sessionToken: data.sessionToken, includedPrimaryTypes: ["(cities)"], includedRegionCodes: ["br"], languageCode: "pt-BR", locationBias: { circle: { center: { latitude: -4.22, longitude: -38.71 }, radius: 50000 } } },
    });
    await checkGoogle(response);
    const result = await response.json() as { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[] };
    return (result.suggestions ?? []).flatMap(({ placePrediction: p }) => p?.placeId && p.text?.text ? [{ placeId: p.placeId, label: p.text.text }] : []).slice(0, 5);
  });

export const resolveMunicipality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{1,250}$/), sessionToken: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getGoogleServerKey } = await import("./location/google-server-key");
    const key = getGoogleServerKey();
    if (!key) throw new Error("Busca de municípios Google não configurada.");
    const { authenticatedGoogleRequest } = await import("./google-request.server");
    const response = await authenticatedGoogleRequest({
      url: `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}?languageCode=pt-BR&sessionToken=${encodeURIComponent(data.sessionToken)}`, key,
      userId: context.userId, caller: "resolveMunicipality", operation: "details",
      fieldMask: "id,types,addressComponents",
    });
    await checkGoogle(response);
    const city = municipalityFromGoogle(await response.json());
    if (!city) throw new Error("Selecione um município brasileiro, não um bairro ou estabelecimento.");
    return city;
  });

async function checkGoogle(response: Response) {
  if (response.ok) return;
  if (response.status === 403) throw new Error("Google recusou a busca. Verifique se a chave do servidor permite Places API (New) e não tem restrição de websites.");
  throw new Error(`Busca de municípios Google indisponível (${response.status}). Tente novamente.`);
}