import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminService } from "@/mockData";

const sources = ["all", "STS2026", "UNIFOR", "Instagram", "QR Code", "Direct"];

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

function exportCsv(rows: ReturnType<typeof adminService.listSurveyResponses>) {
  const header = ["id", "participante", "perfil", "cidade", "contato", "origem", "data", "status"];
  const csv = [header.join(",")]
    .concat(
      rows.map((row) =>
        [
          row.id,
          row.participant,
          row.profile,
          row.city,
          row.contact,
          row.source,
          row.submittedAt,
          row.status,
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
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => adminService.listSurveyResponses({ source, search: query }),
    [source, query],
  );

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
              placeholder="Buscar participante, cidade ou origem"
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
            <thead className="bg-secondary/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Participante</th>
                <th className="px-4 py-3 font-semibold">Perfil</th>
                <th className="px-4 py-3 font-semibold">Cidade</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhuma resposta encontrada para estes filtros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border text-sm text-foreground hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/formularios/respostas/$id"
                        params={{ id: row.id }}
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {row.participant}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{row.contact}</p>
                    </td>
                    <td className="px-4 py-3">{row.profile}</td>
                    <td className="px-4 py-3">{row.city}</td>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(row.submittedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminResponsesPage;
