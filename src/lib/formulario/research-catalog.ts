import { RESEARCH_TEMPLATES, freshTemplate } from "@/lib/formulario/research-templates";
import { supabase } from "@/integrations/supabase/client";
import { parseResearchConfiguration, type ResearchConfiguration } from "./research-configuration";

export const RESEARCH_NATURES = [
  { value: "EVENTO", label: "Evento" },
  { value: "EDUCACAO", label: "Escola / Educação" },
  { value: "EMPRESA", label: "Empresa" },
  { value: "MOBILIDADE_LOCAL", label: "Mobilidade Local" },
  { value: "OUTRA", label: "Outra" },
] as const;

export type ResearchForm = {
  id: string;
  code: string;
  title: string;
  nature: string;
  audience: string;
  mobility_mode: string;
  status: string;
  is_enabled: boolean;
  municipality: string | null;
  brand_image_path?: string | null;
  brand_image_alt?: string | null;
  brand_display_name?: string | null;
  created_at: string;
  mobility_configured?: boolean;
  trashed_at?: string | null;
  trashed_by?: string | null;
  trash_previous_status?: string | null;
};

const db = supabase as any;
/** Minimum required SQL version by model. Unrelated public and event surveys
 * continue operating even while later model migrations await approval.
 */
const MODEL_SQL_VERSION: Record<string,number> = {
  UNIVERSIDADE_MOBILIDADE_REGIONAL: 97,
  EMPRESA_CARONA_CAMPUS: 98,
  EMPRESA_CARONA_INTERNA: 99,
};
export function requiredResearchSchemaVersion(templateKey?:string):number {
  return MODEL_SQL_VERSION[templateKey??""]??95;
}
export async function getResearchSchemaVersion():Promise<number>{
  const {data,error}=await db.rpc("get_research_schema_version");
  if (error){
    if (error.code==="PGRST202" || /function.*get_research_schema_version.*not found/i.test(error.message??"")) return 95;
    throw new Error("Não foi possível confirmar as migrations de pesquisa: "+error.message);
  }
  const n=Number(data);
  if(!Number.isInteger(n)||n<95||n>99)throw new Error("Versão de infraestrutura de pesquisa inválida.");
  return n;
}
export async function requireResearchSchemaVersion(templateKey?:string){
  const needed=requiredResearchSchemaVersion(templateKey);
  if(needed<=95)return;
  const current=await getResearchSchemaVersion();
  if(current<needed) throw new Error("Modelo aguardando migration "+String(needed)+". O banco está na versão "+String(current)+". Nenhum formulário foi criado.");
}


export async function listResearchForms(options: { includeTrashed?: boolean } = {}): Promise<ResearchForm[]> {
  const { data, error } = await db
    .from("research_forms")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const forms = (data ?? []) as ResearchForm[];
  return options.includeTrashed ? forms : forms.filter(form => !form.trashed_at);
}

export async function createResearchForm(input: {
  title: string;
  code: string;
  nature: string;
  audience: string;
  municipality?: string;
  templateKey?: string;
  configuration?: ResearchConfiguration;
}) {
  await requireResearchSchemaVersion(input.templateKey);
  const selected = RESEARCH_TEMPLATES.find(
    (t) => t.key === input.templateKey && t.nature === input.nature,
  );
  const schema = selected
    ? freshTemplate(selected)
    : { sections: [{ id: crypto.randomUUID(), title: "Primeira seção", questions: [] }] };
  if (input.configuration) {
    const settings = parseResearchConfiguration(input.configuration);
    const { data, error } = await db.rpc("create_configured_research_form", {
      p_metadata: {
        title: input.title.trim(),
        code: input.code.trim().toUpperCase(),
        nature: input.nature,
        audience: input.audience,
        municipality: input.municipality?.trim() ?? "",
      },
      p_schema: schema,
      p_settings: settings,
    });
    if (error) throw new Error(error.message);
    return data as string;
  }
  const { data, error } = await db.rpc("create_research_form_draft", {
    p_title: input.title.trim(),
    p_code: input.code.trim().toUpperCase(),
    p_nature: input.nature,
    p_audience: input.audience,
    p_municipality: input.municipality?.trim() ?? "",
    p_schema: schema,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setResearchFormEnabled(form: ResearchForm, enabled: boolean) {
  if (enabled && form.status !== "PUBLICADO")
    throw new Error("Publique o formulário antes de habilitá-lo.");
  const { error } = await db
    .from("research_forms")
    .update({ is_enabled: enabled })
    .eq("id", form.id);
  if (error) throw new Error(error.message);
}
export function researchPublicPath(code: string) {
  return "/formulario/" + encodeURIComponent(code.toLowerCase());
}

export async function renameResearchForm(formId: string, title: string) {
  const clean = title.trim();
  if (clean.length < 2 || clean.length > 180)
    throw new Error("O título deve ter entre 2 e 180 caracteres.");
  const { error } = await db.from("research_forms").update({ title: clean }).eq("id", formId);
  if (error) throw new Error(error.message);
}
export async function deleteEmptyDraft(form: ResearchForm) {
  if (form.status !== "RASCUNHO" || form.is_enabled)
    throw new Error("Somente rascunhos desabilitados e sem respostas podem ser excluídos.");
  const { data, error } = await db.rpc("delete_empty_research_draft", { p_form_id: form.id });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Não foi possível excluir o rascunho.");
}

export type ResearchRemovalEligibility = {
  code: string;
  status: string;
  answers: number;
  legacy_submissions: number;
  crm_leads: number;
  partner_pilots: number;
  participation_badges: number;
  brand_assets: number;
  in_trash: boolean;
  can_trash: boolean;
  can_restore: boolean;
  can_delete: boolean;
};

export async function getResearchFormRemovalEligibility(id: string): Promise<ResearchRemovalEligibility> {
  const { data, error } = await db.rpc("get_research_form_removal_eligibility", { p_form_id: id });
  if (error) throw new Error("Não foi possível consultar os vínculos da pesquisa: " + error.message);
  if (!data || typeof data.can_delete !== "boolean" || typeof data.in_trash !== "boolean")
    throw new Error("Verificação de exclusão indisponível. Confirme a migração da lixeira 0096.");
  return data as ResearchRemovalEligibility;
}

async function requireConfirmedRpc(name: string, payload: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, payload);
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("A operação não foi confirmada pelo servidor.");
}

export async function trashResearchForm(form: ResearchForm) {
  return requireConfirmedRpc("trash_research_form", { p_form_id: form.id });
}
export async function restoreTrashedResearchForm(form: ResearchForm) {
  return requireConfirmedRpc("restore_trashed_research_form", { p_form_id: form.id });
}
export async function permanentlyDeleteTrashedResearchForm(
  form: ResearchForm,
  code: string,
  phrase: string,
  expectedAnswers: number,
) {
  if (code !== form.code || phrase !== "EXCLUIR DEFINITIVAMENTE")
    throw new Error("Preencha as duas confirmações exatamente como solicitado.");
  return requireConfirmedRpc("permanently_delete_trashed_research_form", {
    p_form_id: form.id,
    p_confirm_code: code,
    p_confirm_phrase: phrase,
    p_expected_answers: expectedAnswers,
  });
}

/** Storage assets need deletion through the Storage API, never by deleting storage.objects. */
export async function removeTrashedResearchBrandAssets(form: ResearchForm): Promise<number> {
  if (!form.trashed_at) throw new Error("Somente imagens de pesquisas na lixeira podem ser removidas.");
  const folder = supabase.storage.from("research-branding");
  const { data, error } = await folder.list(form.id, { limit: 1000 });
  if (error) throw new Error("Não foi possível listar as imagens: " + error.message);
  if (!data) throw new Error("Não foi possível validar as imagens da pesquisa.");
  if (data.length >= 1000) throw new Error("Existem muitas imagens. Solicite revisão técnica.");
  const paths = data.filter((item) => item.id && item.name).map((item) => form.id + "/" + item.name);
  if (!paths.length) return 0;
  const result = await folder.remove(paths);
  if (result.error) throw new Error("Não foi possível remover as imagens: " + result.error.message);
  return paths.length;
}

export async function archiveResearchForm(form: ResearchForm) {
  if (form.status === "ENCERRADO")
    throw new Error("Pesquisa histórica encerrada deve permanecer protegida.");
  const { data, error } = await db
    .from("research_forms")
    .update({ status: "ARQUIVADO", is_enabled: false })
    .eq("id", form.id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(error?.message ?? "O arquivamento não foi confirmado pelo banco.");
}
export async function restoreResearchForm(form: ResearchForm) {
  if (form.status !== "ARQUIVADO")
    throw new Error("Somente formulários arquivados podem ser restaurados.");
  const { data, error } = await db
    .from("research_form_versions")
    .select("id")
    .eq("form_id", form.id)
    .not("published_at", "is", null)
    .limit(1);
  if (error) throw new Error(error.message);
  const { error: err } = await db
    .from("research_forms")
    .update({ status: data?.length ? "PUBLICADO" : "RASCUNHO", is_enabled: false })
    .eq("id", form.id);
  if (err) throw new Error(err.message);
}
export async function duplicateResearchForm(form: ResearchForm) {
  const { data, error } = await db.rpc("duplicate_research_form", { p_form_id: form.id });
  if (error) throw new Error(error.message);
  return data as string;
}

export function researchPublicUrl(code: string) {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const current = typeof window === "undefined" ? "" : window.location.origin;
  const base = configured || (current.includes("lovable") ? "https://caronaa.com" : current);
  return base + researchPublicPath(code);
}
