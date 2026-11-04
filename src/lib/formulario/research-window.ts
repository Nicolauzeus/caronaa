import { supabase } from "@/integrations/supabase/client";
import { URBAN_UNIVERSITY_KEY } from "./urban-university";
import { REGIONAL_UNIVERSITY_KEY } from "./regional-university";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validSurveyDate(value: string): boolean {
  if (!dayPattern.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validSurveyTime(value: string): boolean {
  return timePattern.test(value);
}

/**
 * Combine a local calendar day and an HH:MM time into a UTC ISO instant.
 * America/Fortaleza has no daylight saving time, so the UTC-3 offset is fixed.
 */
export function surveyDateTimeToIso(date: string, time: string): string {
  if (!validSurveyDate(date) || !validSurveyTime(time))
    throw new Error("Informe uma data e um horário válidos.");
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

export function validateSurveyWindow(
  startsOn: string,
  endsOn: string,
  startsTime?: string,
  endsTime?: string,
): string | null {
  if (!validSurveyDate(startsOn) || !validSurveyDate(endsOn))
    return "Informe a data de início e a data de encerramento da pesquisa.";
  if (endsOn < startsOn)
    return "O encerramento deve ocorrer na data de início ou depois dela.";
  if (startsTime && !validSurveyTime(startsTime))
    return "Informe um horário de início válido (hora e minutos).";
  if (endsTime && !validSurveyTime(endsTime))
    return "Informe um horário de encerramento válido (hora e minutos).";
  if (startsOn === endsOn && startsTime && endsTime && endsTime <= startsTime)
    return "No mesmo dia, o horário de encerramento deve ser depois do horário de início.";
  return null;
}

export type SurveyWindowState = {
  startsOn: string | null;
  endsOn: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  state: "ABERTO" | "AGENDADO" | "ENCERRADO";
};

export function displaySurveyDate(value: string): string {
  return new Date(value + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Date plus time when an exact instant exists; otherwise the calendar day only. */
export function displaySurveyMoment(day: string | null, instant?: string | null): string {
  if (instant && Number.isFinite(Date.parse(instant))) {
    return new Date(instant).toLocaleString("pt-BR", {
      timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short",
    });
  }
  return day ? displaySurveyDate(day) : "";
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
  return pilot || templateKey === URBAN_UNIVERSITY_KEY || templateKey === REGIONAL_UNIVERSITY_KEY;
}
