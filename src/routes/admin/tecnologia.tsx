import {createFileRoute} from "@tanstack/react-router";
import {TechnologyRegistry} from "@/components/admin/TechnologyRegistry";
export const Route=createFileRoute("/admin/tecnologia")({component:TechnologyPage});
function TechnologyPage(){return <main className="space-y-6"><header><p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary">CARONAA · Engenharia</p><h1 className="mt-1 text-3xl font-extrabold">Centro de Tecnologia e Produto</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Incidentes, bugs, melhorias e releases acompanhados por registros persistidos, sem números de demonstração.</p></header>
 <details className="rounded-lg border border-border/70 px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Observabilidade e integrações (planejadas)</summary><p className="mt-2 text-muted-foreground">Saúde dos serviços, logs e telemetria ainda não possuem medição validada. Não são exibidas métricas simuladas.</p></details>
 <TechnologyRegistry/>
 </main>}
