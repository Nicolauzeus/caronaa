import { supabase } from "@/integrations/supabase/client";

type RpcResponse = { data: unknown; error: { message: string } | null };
const launchRpc = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResponse>;
};
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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
  launches: ResearchLaunchCampaign[];
};

export type ResearchLaunchCampaign = {
  formId: string;
  formCode: string;
  institution: string;
  nature: string;
  launchAt: string;
  preview: LaunchPreview | null;
};

/**
 * Database time and controlled account-to-form links are authoritative.
 * A research participation badge demonstrates receipt ownership, not affiliation.
 */
export async function getMyResearchLaunchState(): Promise<ResearchLaunchState> {
  const { data: response, error } = await launchRpc.rpc("get_my_research_launch_state");
  const data = asRecord(response);
  if (error || !data || typeof data.locked !== "boolean") {
    throw new Error("Não foi possível verificar o acesso ao CARONAA. Tente novamente.");
  }
  if (!data.locked) return { locked: false, preview: null, launches: [] };
  if (
    typeof data.formId !== "string" ||
    typeof data.formCode !== "string" ||
    typeof data.launchAt !== "string" ||
    !Number.isFinite(Date.parse(data.launchAt))
  ) {
    throw new Error("Configuração de lançamento incompleta. Entre em contato com o suporte.");
  }
  const parsePreview = (value: unknown): LaunchPreview | null => {
    const preview = value as LaunchPreview | null;
    return preview &&
      ["PEDIDO", "OFERTA", "AMBOS"].includes(preview.kind) &&
      preview.status === "VISUALIZACAO"
      ? preview
      : null;
  };
  const launches: ResearchLaunchCampaign[] = Array.isArray(data.launches)
    ? data.launches.flatMap((value): ResearchLaunchCampaign[] => {
        const campaign = asRecord(value);
        if (
          !campaign ||
          typeof campaign.formId !== "string" ||
          typeof campaign.formCode !== "string" ||
          typeof campaign.launchAt !== "string" ||
          !Number.isFinite(Date.parse(campaign.launchAt))
        )
          return [];
        return [
          {
            formId: String(campaign.formId),
            formCode: String(campaign.formCode),
            institution: String(campaign.institution || "sua instituição"),
            nature: String(campaign.nature || ""),
            launchAt: campaign.launchAt,
            preview: parsePreview(campaign.preview),
          },
        ];
      })
    : [];
  const preview = parsePreview(data.preview);
  if (!launches.length) {
    launches.push({
      formId: String(data.formId),
      formCode: String(data.formCode),
      institution: String(data.institution || "sua instituição"),
      nature: String(data.nature || ""),
      launchAt: String(data.launchAt),
      preview,
    });
  }
  return {
    locked: true,
    formId: String(data.formId),
    formCode: String(data.formCode),
    institution: String(data.institution || "sua instituição"),
    nature: String(data.nature || ""),
    launchAt: String(data.launchAt),
    preview,
    launches,
  };
}

export type ResearchLaunchAdminState = {
  launchDate: string | null;
  released: boolean;
  linkedUsers: number;
};

export async function getResearchLaunchAdminState(
  formId: string,
): Promise<ResearchLaunchAdminState> {
  const { data: response, error } = await launchRpc.rpc("get_research_launch_admin_state", {
    p_form_id: formId,
  });
  const data = asRecord(response);
  if (error || !data) throw new Error("Não foi possível consultar a liberação do lançamento.");
  return {
    launchDate: typeof data.launchDate === "string" ? data.launchDate : null,
    released: Boolean(data.released),
    linkedUsers: Number(data.linkedUsers || 0),
  };
}

export async function setResearchLaunchReleased(formId: string, released: boolean) {
  const { data: response, error } = await launchRpc.rpc("set_research_launch_release", {
    p_form_id: formId,
    p_released: released,
  });
  const data = asRecord(response);
  if (error || data?.released !== released)
    throw new Error(error?.message || "Não foi possível atualizar o lançamento.");
}
