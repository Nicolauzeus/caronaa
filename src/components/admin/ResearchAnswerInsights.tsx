import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InsightChart } from "@/components/admin/InsightChart";
type Entry = { versionId: string; questionId: string; answer: string; count: number };
type Summary = { total: number; versions: { id: string; total: number }[]; distributions: Entry[] };
type Question = {
  id: string;
  label: string;
  type: string;
  versionId: string;
  versionNumber: number;
  semanticCode?: string;
};
export function ResearchAnswerInsights({ formId }: { formId: string }) {
  const [data, setData] = useState<Summary | null>(null),
    [questions, setQuestions] = useState<Question[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void Promise.all([
      (supabase as any).rpc("get_research_answer_summary", { p_form_id: formId }),
      (supabase as any)
        .from("research_form_versions")
        .select("id,version_number,schema_json")
        .eq("form_id", formId)
        .not("published_at", "is", null),
    ])
      .then(([r, v]: any[]) => {
        if (!alive) return;
        if (r.error || v.error) {
          setError(r.error?.message ?? v.error?.message);
          setData(null);
          return;
        }
        setData(r.data);
        const flat: Question[] = [];
        for (const version of v.data ?? [])
          for (const section of version.schema_json?.sections ?? [])
            for (const question of section.questions ?? [])
              flat.push({
                ...question,
                versionId: version.id,
                versionNumber: version.version_number,
              });
        setQuestions(flat);
      })
      .catch(() => {
        if (alive) setError("Não foi possível consultar os resultados.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [formId]);
  const groups = useMemo(
    () =>
      questions
        .filter((q) => !["short_text", "long_text", "location", "contact", "date"].includes(q.type))
        .map((q) => ({
          ...q,
          key: q.versionId + ":" + q.id,
          entries:
            data?.distributions?.filter(
              (e) => e.versionId === q.versionId && e.questionId === q.id,
            ) ?? [],
        })),
    [data, questions],
  );
  const current = groups.find((g) => g.key === selected) ?? groups[0];
  const openCount = questions.filter((q) => ["short_text", "long_text"].includes(q.type)).length;
  const denominator = current
    ? (data?.versions?.find((x) => x.id === current.versionId)?.total ?? null)
    : null;
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <header>
        <h2 className="text-lg font-bold">Resultados do questionário</h2>
        <p className="text-sm text-muted-foreground">
          Respostas consolidadas por versão; perguntas abertas não são expostas como rótulos de
          gráficos.
        </p>
      </header>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Calculando respostas…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 border-b pb-3 text-sm">
            <span>
              <strong className="text-xl">{data?.total ?? 0}</strong> respostas no total
            </span>
            <span className="text-muted-foreground">
              {data?.versions?.length ?? 0} versões com registros
            </span>
          </div>
          {groups.length > 0 && (
            <>
              <label className="block text-sm font-medium">
                Pergunta para análise
                <select
                  value={current?.key ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                  className="mt-2 w-full rounded-lg border bg-background p-3"
                >
                  {groups.map((g) => (
                    <option value={g.key} key={g.key}>
                      v{g.versionNumber} · {g.label}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <InsightChart
                  title={current.label}
                  description={
                    "Respostas por alternativa · versão " +
                    current.versionNumber +
                    " · base máxima: " +
                    (denominator ?? "N/D") +
                    ". Em múltipla escolha, a soma pode ultrapassar 100%."
                  }
                  rows={current.entries.map((e) => ({
                    name: e.answer.replaceAll("_", " "),
                    value: e.count,
                  }))}
                  metricLabel="Respostas"
                />
              )}
            </>
          )}
          {openCount > 0 && (
            <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              {openCount} pergunta(s) aberta(s) registrada(s). Seu conteúdo deve ser analisado num
              fluxo autorizado, com proteção contra divulgação de informações pessoais.
            </p>
          )}
          {!groups.length && (
            <p className="text-sm text-muted-foreground">
              Não existem perguntas estruturadas com respostas disponíveis para gráficos.
            </p>
          )}
        </>
      )}
    </section>
  );
}
