import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
};

const db = supabase as any;

export async function listResearchForms(): Promise<ResearchForm[]> {
  const { data, error } = await db.from("research_forms").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResearchForm[];
}

export async function createResearchForm(input: {
  title: string; code: string; nature: string; audience: string; municipality?: string;
}) {
  const { data, error } = await db.from("research_forms").insert({
    title: input.title.trim(),
    code: input.code.trim().toUpperCase(),
    nature: input.nature,
    audience: input.audience,
    municipality: input.municipality?.trim() || null,
    mobility_mode: input.nature === "MOBILIDADE_LOCAL" ? "PROFISSIONAL_SOB_DEMANDA" : "COMPARTILHADA",
    status: "RASCUNHO",
  }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: versionError } = await db.from("research_form_versions").insert({
    form_id: data.id,
    version_number: 1,
    schema_json: { sections: [] },
  });
  if (versionError) throw new Error("Formulário criado, mas sua versão inicial falhou: " + versionError.message);
  return data.id as string;
}

export async function setResearchFormEnabled(form: ResearchForm, enabled: boolean) {
  if (enabled && form.status !== "PUBLICADO") throw new Error("Publique o formulário antes de habilitá-lo.");
  const {error}=await db.from("research_forms").update({is_enabled:enabled}).eq("id",form.id);
  if(error)throw new Error(error.message);
}
export function researchPublicPath(code:string) {
 return "/formulario/"+encodeURIComponent(code.toLowerCase());
}
