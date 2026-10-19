import { supabase } from "@/integrations/supabase/client";

export type AvailableResearchForm = {
  id: string;
  code: string;
  title: string;
  municipality: string | null;
  nature: string;
};

/**
 * Discover only surveys this visitor can actually open.
 *
 * Supabase RLS is authoritative: unauthenticated visitors cannot enumerate
 * restricted corporate forms. A version must also be published so that the
 * directory never links to a survey with no usable questionnaire.
 */
export async function loadAvailableResearchForms(): Promise<AvailableResearchForm[]> {
  const { data: forms, error: formsError } = await supabase
    .from("research_forms")
    .select("id,code,title,municipality,nature")
    .eq("status", "PUBLICADO")
    .eq("is_enabled", true)
    .is("trashed_at", null)
    .order("created_at", { ascending: false });

  if (formsError) throw new Error("Não foi possível consultar as pesquisas disponíveis.");
  if (!forms?.length) return [];

  const ids = forms.map((form) => form.id);
  const { data: published, error: versionsError } = await supabase
    .from("research_form_versions")
    .select("form_id")
    .in("form_id", ids)
    .not("published_at", "is", null);

  if (versionsError) throw new Error("Não foi possível verificar as pesquisas publicadas.");

  const publishedIds = new Set((published ?? []).map((version) => version.form_id));
  const seen = new Set<string>();

  return forms.filter((form) => {
    if (!publishedIds.has(form.id) || !form.code?.trim() || !form.title?.trim()) return false;
    if (seen.has(form.id)) return false;
    seen.add(form.id);
    return true;
  });
}
