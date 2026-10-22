import { supabase } from "@/integrations/supabase/client";

const dayPattern = /^\\d{4}-\\d{2}-\\d{2}$/;

export function validSurveyDate(value: string): boolean {
  if (!dayPattern.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateSurveyWindow(startsOn: string, endsOn: string): string | null {
  if (!validSurveyDate(startsOn) || !validSurveyDate(endsOn))
    return "Informe a data de início e a data de encerramento da pesquisa.";
  if (endsOn < startsOn)
    return "O encerramento deve ocorrer na data de início ou depois dela.";
  return null;
}

export type SurveyWindowState = {
  startsOn: string | null;
  endsOn: string | null;
  state: "ABERTO" | "AGENDADO" | "ENCERRADO";
};

export function displaySurveyDate(value: string): string {
  return new Date(value + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export async function getResearchWindowState(code: string): Promise<SurveyWindowState | null> {
  const { data, error } = await (supabase as any).rpc("get_research_window_state", { p_code: code });
  if (error) throw new Error("Não foi possível verificar o período da pesquisa.");
  if (!data) return null;
  if (!["ABERTO", "AGENDADO", "ENCERRADO"].includes(data.state))
    throw new Error("Período de pesquisa indisponível.");
  return data as SurveyWindowState;
}

/** A schedule never implies launch, access release or an authorized partnership. */
export function academicResearchTemplate(templateKey?: string | null, pilot = false): boolean {
  return pilot || templateKey === "URBAN_UNIVERSITY" || templateKey === "REGIONAL_UNIVERSITY";
}
