import { ArrowRight, Activity, BellRing, FileText, Gauge, ShieldCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminOverview } from "@/mockData";

export const Route = {
  component: DashboardPage,
};

function DashboardPage() {
  const { metrics, funnel, activity, pending, quickActions } = adminOverview;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">CARONAA admin</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Visão geral da operação
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Últimos 30 dias
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-display text-2xl font-extrabold">Funil CARONAA</CardTitle>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Dados demonstrativos
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.map((step, index) => (
                <div key={step.stage}>
                  <div className="flex items-center gap-3">
                    <div className="flex w-32 items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>{step.stage}</span>
                    </div>
                    <div className="flex-1 rounded-full bg-secondary px-2 py-1.5">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(22, (Number(step.value.replace(/\D/g, "")) / 1284) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-semibold text-foreground">{step.value}</span>
                  </div>
                  {index < funnel.length - 1 ? <div className="ml-[8.5rem] mt-1 text-xs text-muted-foreground">↓</div> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <span>{action.label}</span>
                <ArrowRight size={16} className="text-primary" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {index % 2 === 0 ? <Users size={14} /> : <Activity size={14} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.title}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <BellRing size={16} className="text-primary" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold"><Gauge size={16} className="text-primary" /> Oferta x demanda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between"><span>Motoristas ativos</span><span className="font-semibold text-foreground">184</span></div>
              <div className="flex items-center justify-between"><span>Demandas abertas</span><span className="font-semibold text-foreground">96</span></div>
              <div className="flex items-center justify-between"><span>Taxa de conversão</span><span className="font-semibold text-foreground">67%</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold"><FileText size={16} className="text-primary" /> Validação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between"><span>Respostas hoje</span><span className="font-semibold text-foreground">37</span></div>
              <div className="flex items-center justify-between"><span>STS2026</span><span className="font-semibold text-foreground">137</span></div>
              <div className="flex items-center justify-between"><span>UNIFOR</span><span className="font-semibold text-foreground">109</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={16} className="text-primary" /> Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between"><span>Incidentes abertos</span><span className="font-semibold text-foreground">3</span></div>
              <div className="flex items-center justify-between"><span>Usuários bloqueados</span><span className="font-semibold text-foreground">11</span></div>
              <div className="flex items-center justify-between"><span>Denúncias pendentes</span><span className="font-semibold text-foreground">8</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
