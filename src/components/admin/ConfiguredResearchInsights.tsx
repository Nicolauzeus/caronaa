import { useEffect, useState } from "react";
import type { ResearchForm } from "@/lib/formulario/research-catalog";
import {
  getConfiguredResearchSummary,
  type ConfiguredSummaryRow,
} from "@/lib/formulario/research-configuration-service";
import {
  exportResearchSummary,
  RESEARCH_EVIDENCE_STAGES,
  RESEARCH_SEMANTICS,
} from "@/lib/formulario/research-configuration";
import { formatResearchOption } from "@/lib/formulario/research-option-labels";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
const labels: Record<string, string> = {
  ...RESEARCH_SEMANTICS,
  TRANSPORT_MODE: "Transporte atual",
  COST_PER_TRIP: "Custo por trecho (R$)",
  ACADEMIC_ROLE: "Vínculo com a instituição",
  WAIT_TIME: "Tempo de espera declarado (minutos)",
  REGIONAL_SERVICE_PREFERENCE: "Preferência entre carona e mototáxi local",
  REGIONAL_PRIMARY_PAIN: "Principal dificuldade de mobilidade regional",
  REGIONAL_BARRIER: "Principal barreira para utilizar a solução",
  REGIONAL_OFFER_POSSIBLE: "Potencial para oferecer lugares em trajeto habitual",
  REGIONAL_OFFER_VEHICLE: "Veículo potencial do motorista",
  REGIONAL_PROFESSIONAL_ROLE: "Mototaxistas profissionais declarados",
  REGIONAL_PROFESSIONAL_INTEREST: "Interesse declarado em parceria profissional (não habilitado)",
  COMPANY_DRIVES_CAR: "Colaboradores que dirigem carro",
  COMPANY_DRIVING_FREQUENCY: "Frequência de deslocamento de carro",
  COMPANY_MAX_DETOUR: "Desvio máximo aceitável (declarado)",
  CORP_DRIVES_CAR: "Colaboradores que dirigem carro (declarado)",
  WORK_SHIFT: "Turno de trabalho declarado",
  SEATS_AVAILABLE: "Lugares livres declarados, não publicados",
  TRAVEL_FREQUENCY: "Frequência semanal declarada",
  TRAVEL_TIME: "Duração (minutos)",
  MOBILITY_PAINS: "Dificuldades de mobilidade",
  PERCEIVED_SAFETY: "Segurança percebida",
  ADOPTION_INTENT: "Intenção declarada",
  TRUST_FACTORS: "Fatores de confiança",
  JOURNEY_PROFILE: "Perfil do trajeto declarado",
  JOURNEY_MODE: "Modalidade do trajeto declarado",
  JOURNEY_DEPARTURE_TIME: "Horário declarado do trajeto",
  PASSENGER_INTEREST_REGISTERED: "Interesse confirmado em procurar carona",
  DRIVER_AVAILABILITY_REGISTERED: "Disponibilidade confirmada para oferecer carona",
};
export function ConfiguredResearchInsights({ forms }: { forms: ResearchForm[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [rows, setRows] = useState<ConfiguredSummaryRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getConfiguredResearchSummary(filters)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((reason) => {
        if (active) {
          setRows([]);
          setError(reason instanceof Error ? reason.message : "Dados indisponíveis.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, refresh]);
  const set = (key: string, value: string) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const input = (key: string, label: string, type = "text") => (
    <label key={key} className="min-w-0 text-sm">
      {label}
      <input
        type={type}
        value={filters[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
      />
    </label>
  );
  return (
    <section aria-label="Coortes institucionais" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pesquisas institucionais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Respostas novas, separadas por versão e base elegível. O histórico STS e os eventos de
            navegação não compõem esta coorte.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar resultados"
            title="Atualizar resultados"
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            variant="outline"
            disabled={loading || Boolean(error) || !rows.length}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([exportResearchSummary(rows)], { type: "text/csv;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "coorte-pesquisas.csv";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download size={16} />
            Exportar
          </Button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          Pesquisa
          <select
            value={filters.formId ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, formId: event.target.value, versionId: "" }))
            }
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
          >
            <option value="">Todas as novas pesquisas</option>
            {forms
              .filter((form) => form.mobility_configured)
              .map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
          </select>
        </label>
        {input("institutionId", "Identificador institucional")}
        {input("campus", "Campus ou unidade")}
        {input("templateKey", "Identificador do modelo")}
        <label className="text-sm">
          Campanha
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
            value={filters.campaignType ?? ""}
            onChange={(event) => set("campaignType", event.target.value)}
          >
            <option value="">Todas</option>
            <option value="INSTITUCIONAL">Institucional</option>
            <option value="EVENTO">Evento</option>
            <option value="ORGANICO">Orgânico</option>
            <option value="OUTRO">Outra</option>
          </select>
        </label>
        <label className="text-sm">
          Perfil
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
            value={filters.profile ?? ""}
            onChange={(event) => set("profile", event.target.value)}
          >
            <option value="">Todos</option>
            <option value="PASSAGEIRO">Passageiro</option>
            <option value="MOTORISTA">Motorista</option>
            <option value="AMBOS">Ambos</option>
          </select>
        </label>
        <label className="text-sm">
          Modalidade
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
            value={filters.mode ?? ""}
            onChange={(event) => set("mode", event.target.value)}
          >
            <option value="">Todas</option>
            <option value="CARONA">Carona</option>
            <option value="TRANSPORTE_PROFISSIONAL_INTERESSE">Interesse profissional</option>
          </select>
        </label>
        {input("time", "Horário local de saída", "time")}
        {input("region", "Região institucional")}
        {input("nearbyUniversity", "Universidade ou instituto próximo")}
        {input("acquisitionSource", "Origem da campanha")}
        {(["periodStart", "periodEnd"] as const).map((key) => (
          <label key={key} className="text-sm">
            {key === "periodStart" ? "A partir de (UTC)" : "Antes de (UTC)"}
            <input
              type="date"
              value={filters[key]?.slice(0, 10) ?? ""}
              onChange={(event) =>
                set(key, event.target.value ? event.target.value + "T00:00:00Z" : "")
              }
              className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
        ))}
        <label className="text-sm">
          Versão
          <select
            value={filters.versionId ?? ""}
            onChange={(event) => set("versionId", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2"
          >
            <option value="">Todas as versões</option>
            {[...new Map(rows.map((row) => [row.version_id, row])).values()].map((row, index) => (
              <option key={row.version_id} value={row.version_id}>
                Versão {row.version_number ?? index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Calculando a coorte…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma resposta estruturada disponível para estes filtros.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Versão</th>
                <th className="p-2">Indicador</th>
                <th className="p-2">Resposta</th>
                <th className="p-2">Elegíveis</th>
                <th className="p-2">Responderam</th>
                <th className="p-2">Selecionaram</th>
                <th className="p-2">% elegíveis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b">
                  <td className="p-2">{row.version_number ?? "N/D"}</td>
                  <td className="p-2">{labels[row.semantic_code] ?? "Indicador da pesquisa"}</td>
                  <td className="p-2">
                    {row.category ? formatResearchOption(row.category) : "Sem resposta"}
                  </td>
                  <td className="p-2">{row.eligible}</td>
                  <td className="p-2">{row.answered}</td>
                  <td className="p-2">{row.total}</td>
                  <td className="p-2">
                    {Number(row.eligible) > 0
                      ? ((Number(row.total) / Number(row.eligible)) * 100).toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        }) + "%"
                      : "N/D"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Amostra voluntária, sem representatividade populacional presumida. Uma pessoa pode
        selecionar várias alternativas. Endereços, contatos, recibos e coordenadas individuais não
        são expostos nesta análise.
      </p>
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Etapas de evidência</summary>
        <ol className="mt-3 space-y-2 text-sm">
          {RESEARCH_EVIDENCE_STAGES.map((stage, index) => (
            <li key={stage} className="flex justify-between gap-3">
              <span>{stage}</span>
              <span className="text-muted-foreground">
                {index < 3 ? "Declaração na pesquisa" : "N/D · sem vínculo operacional"}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
