import { ArrowRight, FileText, Users } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ResearchCatalog } from "@/components/admin/ResearchCatalog";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFormMetrics, type FormMetricsSummary } from "@/lib/formulario/metrics";

export const Route = createFileRoute("/admin/formularios/")({
  head: () => ({
    meta: [
      {
        title: "Formulários — Administração CARONAA",
      },
      {
        name: "description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      {
        property: "og:title",
        content: "Formulários — Administração CARONAA",
      },
      {
        property: "og:description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: AdminFormsPage,
});

type FormsDashboardData = {
  all: FormMetricsSummary | null;
  today: FormMetricsSummary | null;
  last7Days: FormMetricsSummary | null;
};

function startOfTodayIso() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function sevenDaysAgoIso() {
  const date = new Date();

  date.setDate(date.getDate() - 7);

  return date.toISOString();
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/D";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/D";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function profilePercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

function AdminFormsPage() {
  const [data, setData] = useState<FormsDashboardData>({
    all: null,
    today: null,
    last7Days: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void Promise.allSettled([
      getFormMetrics(),
      getFormMetrics({
        periodStart: startOfTodayIso(),
      }),
      getFormMetrics({
        periodStart: sevenDaysAgoIso(),
      }),
    ]).then((results) => {
      if (!active) {
        return;
      }

      const [allResult, todayResult, weekResult] = results;

      setData({
        all: allResult.status === "fulfilled" ? allResult.value : null,
        today: todayResult.status === "fulfilled" ? todayResult.value : null,
        last7Days: weekResult.status === "fulfilled" ? weekResult.value : null,
      });

      const failed = results.filter((result) => result.status === "rejected").length;

      if (failed > 0) {
        setError(
          `${failed} conjunto${failed === 1 ? "" : "s"} de métricas não pôde${
            failed === 1 ? "" : "ram"
          } ser carregado${failed === 1 ? "" : "s"}.`,
        );
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const profiles = useMemo(() => {
    const totals = data.all?.totals;

    if (!totals) {
      return [];
    }

    const total = totals.passageiros + totals.motoristas + totals.ambos;

    return [
      {
        label: "Passageiros",
        value: totals.passageiros,
        percentage: profilePercent(totals.passageiros, total),
        icon: Users,
      },
      {
        label: "Motoristas",
        value: totals.motoristas,
        percentage: profilePercent(totals.motoristas, total),
        icon: Users,
      },
      {
        label: "Os dois",
        value: totals.ambos,
        percentage: profilePercent(totals.ambos, total),
        icon: FileText,
      },
    ];
  }, [data.all]);

  const funnel = useMemo(() => {
    const totals = data.all?.totals;

    if (!totals) {
      return [];
    }

    return [
      {
        label: "Alcançados",
        value: totals.reached,
      },
      {
        label: "Iniciados",
        value: totals.started,
      },
      {
        label: "Concluídos",
        value: totals.completed,
      },
      {
        label: "Leads",
        value: totals.leads,
      },
    ];
  }, [data.all]);

  const funnelBase = Math.max(1, data.all?.totals.reached ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Validação</p>

          <h1 className="mt-2 font-display text-3xl font-extrabold">Formulários</h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Indicadores reais das respostas e do funil de validação do CARONAA.
          </p>
        </div>

        <Link
          to="/admin/formularios/respostas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          Ver respostas
          <ArrowRight size={16} />
        </Link>
      </div>

      <ResearchCatalog />
    </div>
  );
}
