import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getFormSubmission,
  type FormSubmissionRow,
} from "@/lib/formulario/form-submission-service";

export const Route = createFileRoute("/admin/formularios/respostas/$id")({
  head: () => ({ meta: [{ title: "Resposta do formulário — CARONAA" },{ name: "description", content: "Informações e acompanhamento de resposta do formulário." },{ property: "og:title", content: "Resposta do formulário — CARONAA" },
{ property: "og:description", content: "Informações e acompanhamento de resposta do formulário." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" }] }),
  component: SurveyDetailPage,
});

function SurveyDetailPage() {
  const { id } = Route.useParams();
  const [response, setResponse] = useState<FormSubmissionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    void getFormSubmission(id)
      .then((data) => {
        if (!active) return;
        setResponse(data);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Não foi possível carregar a resposta.",
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Carregando resposta
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold text-destructive">{error}</p>
      </div>
    );
  }

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
          # {response.submission_id}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{response.nome}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
            {response.tipo_usuario}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1">
            {response.origem_trajeto ?? "Origem não informada"} → {response.destino_trajeto}
          </span>
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
              <span className="font-semibold">{response.nome}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Perfil</span>
              <span className="font-semibold">{response.tipo_usuario}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">WhatsApp</span>
              <span className="font-semibold">{response.whatsapp}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-semibold">{response.email ?? "Não informado"}</span>
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
              <span className="text-muted-foreground">Evento</span>
              <span className="font-semibold">{response.campaign_event}</span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Enviada em</span>
              <span className="font-semibold">
                {new Date(response.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-muted-foreground">Usuário</span>
              <span className="font-semibold">{response.user_id ?? "Anônimo"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold">Perfil e Trajeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <p>Ocupação: {response.ocupacao ?? "Não informado"}</p>
            <p>Horário: {response.faixa_horario ?? "Não informado"}</p>
            <p>Frequência: {response.frequencia_semanal ?? "Não informado"}</p>
            <p>Transporte atual: {response.transporte_atual ?? "Não informado"}</p>
            <p>Custo: {response.custo_atual_faixa ?? "Não informado"}</p>
            <p>Referência: {response.custo_referencia ?? "Não informado"}</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold">Interesse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <p>Passageiro: {response.intencao_passageiro ?? "Não informado"}</p>
            <p>Motorista: {response.intencao_motorista ?? "Não informado"}</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold">Dores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {response.pain_points.map((painPoint) => (
                <div
                  key={painPoint.codigo_dor}
                  className="rounded-xl border border-border bg-secondary/30 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{painPoint.codigo_dor}</span>
                    <span>{painPoint.selecionada ? "Selecionada" : "Não selecionada"}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {painPoint.principal ? "Principal" : "Secundária"} · intensidade{" "}
                    {painPoint.intensidade ?? "não informada"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
