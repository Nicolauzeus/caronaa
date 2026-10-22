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
  title?: string;
  institution?: string;
  nature?: string;
  launchAt?: string;
  preview: LaunchPreview | null;
  launches: ResearchLaunchCampaign[];
};

export type ResearchLaunchCampaign = {
  formId: string;
  formCode: string;
  title: string;
  institution: string;
  nature: string;
  launchAt: string;
  preview: LaunchPreview | null;
};

/**
 * Database time and controlled account-to-form links are authoritative.
 * A research participation badge demonstrates receipt ownership, not affiliation.
 */

/** Return every verified, pending campaign even when app access is unrestricted. */
export async function getMyResearchLaunchState(): Promise<ResearchLaunchState> {
  const { data: response, error } = await launchRpc.rpc("get_my_research_launch_state");
  const data = asRecord(response);
  if (error || !data || typeof data.locked !== "boolean") {
    throw new Error("Não foi possível verificar o acesso ao CARONAA. Tente novamente.");
  }
  const parsePreview = (value: unknown): LaunchPreview | null => {
    const preview = asRecord(value);
    if (
      !preview ||
      !["PEDIDO", "OFERTA", "AMBOS"].includes(String(preview.kind)) ||
      preview.status !== "VISUALIZACAO"
    ) return null;
    return {
      kind: preview.kind as LaunchPreview["kind"],
      scheduledDate: typeof preview.scheduledDate === "string" ? preview.scheduledDate : "",
      origin: typeof preview.origin === "string" ? preview.origin : null,
      destination: typeof preview.destination === "string" ? preview.destination : null,
      departureTime: typeof preview.departureTime === "string" ? preview.departureTime : null,
      status: "VISUALIZACAO",
    };
  };
  const parseCampaign = (value: unknown): ResearchLaunchCampaign | null => {
    const campaign = asRecord(value);
    if (
      !campaign ||
      typeof campaign.formId !== "string" || !campaign.formId.trim() ||
      typeof campaign.formCode !== "string" ||
      typeof campaign.launchAt !== "string" ||
      !Number.isFinite(Date.parse(campaign.launchAt))
    ) return null;
    const institution = typeof campaign.institution === "string" && campaign.institution.trim()
      ? campaign.institution : "sua instituição";
    return {
      formId: campaign.formId,
      formCode: campaign.formCode,
      title: typeof campaign.title === "string" && campaign.title.trim()
        ? campaign.title : institution,
      institution,
      nature: typeof campaign.nature === "string" ? campaign.nature : "",
      launchAt: campaign.launchAt,
      preview: parsePreview(campaign.preview),
    };
  };
  const parsed = Array.isArray(data.launches)
    ? data.launches.flatMap((value): ResearchLaunchCampaign[] => {
        const campaign = parseCampaign(value);
        return campaign ? [campaign] : [];
      }) : [];
  // A pre-0114 database returns one campaign through the legacy aliases.
  if (!parsed.length) {
    const legacy = parseCampaign(data);
    if (legacy) parsed.push(legacy);
  }
  const unique = new Map<string, ResearchLaunchCampaign>();
  for (const campaign of parsed) {
    if (!unique.has(campaign.formId)) unique.set(campaign.formId, campaign);
  }
  const launches = [...unique.values()].sort(
    (a, b) => Date.parse(a.launchAt) - Date.parse(b.launchAt) ||
      a.formCode.localeCompare(b.formCode),
  );
  if (data.locked && !launches.length) {
    throw new Error("Configuração de lançamento incompleta. Entre em contato com o suporte.");
  }
  const primary = launches[0];
  return {
    locked: data.locked,
    ...(primary && {
      formId: primary.formId,
      formCode: primary.formCode,
      title: primary.title,
      institution: primary.institution,
      nature: primary.nature,
      launchAt: primary.launchAt,
    }),
    preview: primary?.preview ?? null,
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
