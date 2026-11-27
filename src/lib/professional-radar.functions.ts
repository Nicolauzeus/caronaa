/** F07 authenticated WebView/browser transport. Shared server policy stays unchanged. */
import { createServerFn } from "@tanstack/react-start";
import { professionalRadarPointSchema } from "@/lib/professional-radar-geo";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProfessionalRadarPublication } from "./professional-radar-publication.server";
export type { ProfessionalRadarPublication } from "./professional-radar-publication.server";

export const publishVerifiedProfessionalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => professionalRadarPointSchema.parse(value))
  .handler(async ({ context, data }): Promise<ProfessionalRadarPublication> => {
    const { publishProfessionalPosition } = await import("./professional-radar-publication.server");
    return publishProfessionalPosition(context, data);
  });
