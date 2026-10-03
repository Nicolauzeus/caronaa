import { ArrowRight, FileText, Filter, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminLeadSources, adminValidationSummary } from "@/mockData";

export const Route = {
  component: AdminFormsPage,
};

function AdminFormsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Validação</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Formulários</h1>
        </div>
        <Link to="/admin/formularios/respostas" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          Ver respostas <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={String(adminValidationSummary.totalResponses)} detail="Respostas recebidas" />
        <MetricCard label="Hoje" value={String(adminValidationSummary.responsesToday)} detail="Respostas hoje" />
        <MetricCard label="7 dias" value={String(adminValidationSummary.responsesLast7Days)} detail="Últimos 7 dias" />
        <MetricCard label="Conclusão" value={adminValidationSummary.completionRate} detail="Taxa estimada" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-display text-2xl font-extrabold">Origem das respostas</CardTitle>
              <Filter size={16} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminLeadSources.map((item) => (
              <div key={item.source} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-foreground">{item.source}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                    {item.conversions} conversões
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{item.responses} respostas</span>
                  <span>{Math.round((item.conversions / item.responses) * 100)}% de conversão</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminValidationSummary.byProfile.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {item.label === "Motoristas" ? <Users size={14} className="text-primary" /> : item.label === "Passageiros" ? <Users size={14} className="text-primary" /> : <FileText size={14} className="text-primary" />}
                    {item.label}
                  </span>
                  <span className="font-bold text-foreground">{item.value}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminFormsPage;
