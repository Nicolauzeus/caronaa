import { createFileRoute } from "@tanstack/react-router";
import { TechnologyRegistry } from "@/components/admin/TechnologyRegistry";
export const Route = createFileRoute("/admin/tecnologia")({ component: TechnologyPage });
function TechnologyPage() {
  return (
    <main className="space-y-6">
      <details className="rounded-lg border border-border/70 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Observabilidade e integrações (planejadas)
        </summary>
        <p className="mt-2 text-muted-foreground">
          Saúde dos serviços, logs e telemetria ainda não possuem medição validada. Não são exibidas
          métricas simuladas.
        </p>
      </details>
      <TechnologyRegistry />
    </main>
  );
}
