import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/mockData";

export const Route = createFileRoute("/admin/formularios/respostas/$id")({
  component: SurveyDetailPage,
});

function SurveyDetailPage() {
  const { id } = Route.useParams();
  const response = adminService.getSurveyResponse(id);

  if (!response) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Resposta não encontrada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          # {response.id}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{response.participant}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
            {response.profile}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1">{response.city}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1">{response.source}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Participante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-semibold">{response.participant}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Perfil</span>
              <span className="font-semibold">{response.profile}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Contato</span>
              <span className="font-semibold">{response.contact}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Cidade</span>
              <span className="font-semibold">{response.city}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Metadados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Origem</span>
              <span className="font-semibold">{response.source}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Enviada em</span>
              <span className="font-semibold">
                {new Date(response.submittedAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold">{response.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(response.answers).map(([label, value]) => (
          <Card key={label} className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-xl font-extrabold">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(value) ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                  {value.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-foreground">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default SurveyDetailPage;
