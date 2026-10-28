import { ListPagination } from "@/components/admin/ListPagination";

import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listFormSubmissions,
  type FormSubmissionRow,
} from "@/lib/formulario/form-submission-service";

const sources = ["all", "sts-2026"];

export const Route = createFileRoute("/admin/formularios/respostas/")({
  head: () => ({
    meta: [
      { title: "Respostas — Administração CARONAA" },
      { name: "description", content: "Consulte as respostas dos formulários do CARONAA." },
      { property: "og:title", content: "Respostas — Administração CARONAA" },
      { property: "og:description", content: "Consulte as respostas dos formulários do CARONAA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminResponsesPage,
});

function exportCsv(rows: FormSubmissionRow[]) {
  const header = [
    "submission_id",
    "nome",
    "tipo_usuario",
    "origem_trajeto",
    "destino_trajeto",
    "whatsapp",
    "source",
    "campaign_event",
    "created_at",
  ];
  const csv = [header.join(",")]
    .concat(
      rows.map((row) =>
        [
          row.submission_id,
          row.nome,
          row.tipo_usuario,
          row.origem_trajeto ?? "",
          row.destino_trajeto,
          row.whatsapp,
          row.source,
          row.campaign_event,
          row.created_at,
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "caronaa-respostas.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdminResponsesPage() {
  const [view, setView] = useState<"unificado"|"sts">("sts");
  return <div className="space-y-3">
    <nav aria-label="Visões das respostas" className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>setView("unificado")} aria-pressed={view==="unificado"}
        className={"min-h-11 rounded-xl border px-4 text-sm font-semibold " +
          (view==="unificado" ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]" : "border-border")}>
        CRM unificado (acesso centralizado)
      </button>
      <button type="button" onClick={()=>setView("sts")} aria-pressed={view==="sts"}
        className={"min-h-11 rounded-xl border px-4 text-sm font-semibold " +
          (view==="sts" ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]" : "border-border")}>
        Respostas originais STS
      </button>
    </nav>
    {view === "unificado" ? <div className="rounded-xl border p-5">
      <p className="text-sm">O CRM unificado agora tem uma única tela operacional.</p>
      <Link to="/admin/relacionamentos" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline">Abrir CRM de relacionamentos</Link>
    </div> : <LegacyStsResponsesPage/>}
  </div>;
}

function LegacyStsResponsesPage() {
  const [page, setPage] = useState(0);
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<FormSubmissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    void listFormSubmissions()
      .then((data) => {
        if (!active) return;
        setResponses(data);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar respostas.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return responses.filter((response) => {
      const matchesSource = source === "all" || response.source === source;
      const matchesSearch =
        !normalized ||
        [
          response.nome,
          response.email ?? "",
          response.whatsapp,
          response.submission_id,
          response.source,
          response.campaign_event,
          response.origem_trajeto ?? "",
          response.destino_trajeto,
        ].some((field) => field.toLowerCase().includes(normalized));

      return matchesSource && matchesSearch;
    });
  }, [responses, source, query]);

  useEffect(() => setPage(0), [rows]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1));
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Validação</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Respostas</h1>
        </div>
        <Button
          type="button"
          onClick={() => exportCsv(rows)}
          className="inline-flex items-center gap-2"
        >
          <Download size={16} />
          Exportar CSV
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar participante, rota ou origem"
              className="h-11 border-border bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((item) => (
              <Button
                key={item}
                type="button"
                variant={source === item ? "default" : "outline"}
                size="sm"
                onClick={() => setSource(item)}
              >
                {item === "all" ? "Todos" : item}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Participante</th>
                <th className="px-4 py-3 font-semibold">Perfil</th>
                <th className="px-4 py-3 font-semibold">Trajeto</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Evento</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Carregando respostas...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-destructive">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhuma resposta encontrada para estes filtros.
                  </td>
                </tr>
              ) : (
                rows.slice(currentPage * 12, (currentPage + 1) * 12).map((row) => (
                  <tr
                    key={row.submission_id}
                    className="border-t border-border bg-card text-sm text-foreground transition-colors hover:bg-muted/40 focus-within:bg-accent/30 dark:hover:bg-muted/65"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/formularios/respostas/$id"
                        params={{ id: row.submission_id }}
                        className="font-semibold text-[#805900] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#FFD166]"
                      >
                        {row.nome}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.email ? `${row.whatsapp} • ${row.email}` : row.whatsapp}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.tipo_usuario}</td>
                    <td className="px-4 py-3">
                      {row.origem_trajeto ?? "Não informado"} → {row.destino_trajeto}
                    </td>
                    <td className="px-4 py-3"><span className="whitespace-nowrap text-muted-foreground">{row.source}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block max-w-[220px] break-words rounded-md border border-border/70 bg-muted/70 px-2.5 py-1 text-xs font-medium leading-relaxed text-foreground">
                        {row.campaign_event}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ListPagination page={currentPage} total={rows.length} pageSize={12} onChange={setPage} />
    </div>
  );
}
