import { supabase } from "@/integrations/supabase/client";

export const UNIFOR_FORM_ID = "8eaec446-057b-430a-9ccf-3b3652cb9618";
export const UNIFOR_LAUNCH_ISO = "2026-11-04T00:00:00-03:00";
export const UNIFOR_LAUNCH_DAY = "4 de novembro de 2026";

export type UniforIntentPreview = {
  kind: "PEDIDO" | "OFERTA" | "AMBOS";
  scheduledDate: string;
  origin: string | null;
  destination: string | null;
  departureTime: string | null;
  status: "VISUALIZACAO";
};

export type UniforLaunchState = {
  locked: boolean;
  launchAt: string;
  preview: UniforIntentPreview | null;
};

export function isUniforPilotForm(id: string): boolean {
  return id === UNIFOR_FORM_ID;
}

/** Server checks the date with PostgreSQL time and the immutable survey UUID.
 * This read-only call never qualifies as enrollment verification. */
export async function getMyUniforLaunchState(): Promise<UniforLaunchState> {
  const { data, error } = await (supabase as any).rpc("get_my_unifor_launch_state");
  if (error || !data || typeof data.locked !== "boolean")
    throw new Error("Não foi possível verificar a abertura da CARONAA para sua conta.");
  const preview = data.preview;
  return {
    locked: data.locked,
    launchAt: String(data.launchAt || UNIFOR_LAUNCH_ISO),
    preview: preview && ["PEDIDO","OFERTA","AMBOS"].includes(preview.kind) &&
      preview.status === "VISUALIZACAO" ? preview as UniforIntentPreview : null,
  };
}
