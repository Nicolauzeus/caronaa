import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity, FileText, ShieldCheck } from "lucide-react";
import { loadAdminOperations, type OperationData } from "@/lib/admin-operations";
import { adminErrorMessage } from "@/lib/admin/error-message";
import { Button } from "@/components/ui/button";

export function AttentionQueue() {
  const query = useQuery<OperationData>({
    queryKey: ["admin", "attention"],
    queryFn: loadAdminOperations,
    staleTime: 60000,
  });
  const data = query.isError ? undefined : query.data;
  const items = [
    {
      label: "Pedidos em busca",
      value: data?.requests.filter((request) => request.status === "open").length,
      to: "/admin/solicitacoes",
      icon: FileText,
    },
    {
      label: "Combinações aguardando aceite",
      value: data?.rides.filter((ride) => ride.status === "MATCHED").length,
      to: "/admin/matching",
      icon: Activity,
    },
    {
      label: "Motoristas com revisão pendente",
      value: data
        ? new Set(
            data.offers
              .map((offer) => offer.user_id)
              .filter(
                (id) =>
                  !data.reviews.some(
                    (review) =>
                      review.user_id === id && review.document_verified && review.vehicle_verified,
                  ),
              ),
          ).size
        : undefined,
      to: "/admin/motoristas",
      icon: ShieldCheck,
    },
  ] as const;
  return (
    <section aria-label="Prioridades da operação" className="border-b border-border pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Atenção necessária</h2>
        <span className="text-xs text-muted-foreground">
          Situação atual · não limitada a 30 dias
        </span>
      </div>
      {query.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            {adminErrorMessage(
              query.error,
              "Não foi possível carregar as pendências operacionais.",
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void query.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : query.isPending ? (
        <p role="status" className="min-h-16 py-4 text-sm text-muted-foreground">
          Carregando pendências…
        </p>
      ) : items.every((item) => item.value === 0) ? (
        <p className="py-4 text-sm text-muted-foreground">
          Nenhuma pendência nas filas operacionais consultadas.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items
            .filter((item) => (item.value ?? 0) > 0)
            .map(({ label, value, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-16 items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon size={20} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                </div>
                <span className="font-semibold tabular-nums">{value}</span>
                <ArrowUpRight
                  size={17}
                  className="shrink-0 text-muted-foreground group-hover:text-foreground"
                />
              </Link>
            ))}
        </div>
      )}
    </section>
  );
}
