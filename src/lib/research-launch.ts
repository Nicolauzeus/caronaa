import { supabase } from "@/integrations/supabase/client";

export type LaunchPreview = {
  kind: "PEDIDO" | "OFERTA" | "AMBOS";
  scheduledDate: string;
  origin: string | null;
  destination: string | null;
  departureTime: string | null;
  status: "VISUALIZACAO";
};

export type ResearchLaunchState = {
  locked: boolean;
  formId?: string;
  formCode?: string;
  institution?: string;
  nature?: string;
  launchAt?: string;
  preview: LaunchPreview | null;
};

/**
 * Database time and controlled account-to-form links are authoritative.
 * A research participation badge demonstrates receipt ownership, not affiliation.
 */
export async function getMyResearchLaunchState(): Promise<ResearchLaunchState> {
  const { data, error } = await (supabase as any).rpc("get_my_research_launch_state");
  if (error || !data || typeof data.locked !== "boolean") {
    throw new Error("Não foi possível verificar o acesso ao CARONAA. Tente novamente.");
  }
  if (!data.locked) return { locked: false, preview: null };
  if (!data.formId || !data.formCode || !data.launchAt || !Number.isFinite(Date.parse(data.launchAt))) {
    throw new Error("Configuração de lançamento incompleta. Entre em contato com o suporte.");
  }
  const preview = data.preview;
  return {
    locked: true,
    formId: String(data.formId),
    formCode: String(data.formCode),
    institution: String(data.institution || "sua instituição"),
    nature: String(data.nature || ""),
    launchAt: String(data.launchAt),
    preview: preview && ["PEDIDO", "OFERTA", "AMBOS"].includes(preview.kind)
      && preview.status === "VISUALIZACAO" ? preview as LaunchPreview : null,
  };
}

export type ResearchLaunchAdminState = {
  launchDate: string | null;
  released: boolean;
  linkedUsers: number;
};

export async function getResearchLaunchAdminState(formId: string): Promise<ResearchLaunchAdminState> {
  const { data, error } = await (supabase as any).rpc("get_research_launch_admin_state", {
    p_form_id: formId,
  });
  if (error || !data) throw new Error("Não foi possível consultar a liberação do lançamento.");
  return {
    launchDate: data.launchDate || null,
    released: Boolean(data.released),
    linkedUsers: Number(data.linkedUsers || 0),
  };
}

export async function setResearchLaunchReleased(formId: string, released: boolean) {
  const { data, error } = await (supabase as any).rpc("set_research_launch_release", {
    p_form_id: formId,
    p_released: released,
  });
  if (error || data?.released !== released) throw new Error(error?.message || "Não foi possível atualizar o lançamento.");
}
