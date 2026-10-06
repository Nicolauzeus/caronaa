// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { supabase } from "@/integrations/supabase/client";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export const validationExportKinds = [
  "raw_analytics",
  "pain_ranking",
  "profile",
  "transport",
  "costs",
  "intent",
  "funnel",
  "match",
  "leads",
] as const;
export type ValidationExportKind = (typeof validationExportKinds)[number];

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    keys.map(csvValue).join(";"),
    ...rows.map((row) => keys.map((key) => csvValue(row[key])).join(";")),
  ].join("\r\n");
}

export async function downloadValidationExport(
  kind: ValidationExportKind,
  filters: FormMetricsFilters,
) {
  const { data, error } = await supabase.rpc("get_validation_export", {
    p_kind: kind,
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_tipo_usuario: filters.tipoUsuario ?? null,
  });
  if (error) throw new Error(`Não foi possível exportar os dados: ${error.message}`);
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  const blob = new Blob(["\uFEFF", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `caronaa-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
