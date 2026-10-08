import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity, FileText, ShieldCheck } from "lucide-react";
import { loadAdminOperations, type OperationData } from "@/lib/admin-operations";

export function AttentionQueue() {
  const [data, setData] = useState<OperationData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void loadAdminOperations().then((result) => { if (active) setData(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const items = [
    { label: "Pedidos em busca", value: data?.requests.filter((request) => request.status === "open").length, to: "/admin/solicitacoes", icon: FileText },
    { label: "Combinações aguardando aceite", value: data?.rides.filter((ride) => ride.status === "MATCHED").length, to: "/admin/matching", icon: Activity },
    { label: "Motoristas com revisão pendente", value: data ? new Set(data.offers.map((offer) => offer.user_id).filter((id) => !data.reviews.some((review) => review.user_id === id && review.document_verified && review.vehicle_verified))).size : undefined, to: "/admin/motoristas", icon: ShieldCheck },
  ] as const;
  return (
    <section aria-label="Prioridades da operação" className="border-y border-border py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Sua atenção agora</h2>
        <span className="text-xs text-muted-foreground">Situação atual · não limitada a 30 dias</span>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">As pendências não puderam ser carregadas. Consulte as páginas da operação.</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(({ label, value, to, icon: Icon }) => (
          <Link key={to} to={to} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
            <Icon size={20} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><p className="font-display text-2xl font-bold">{value ?? (error ? "N/D" : "…")}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            <ArrowUpRight size={17} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}