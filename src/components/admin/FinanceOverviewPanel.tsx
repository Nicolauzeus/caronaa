import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Overview = {
  quotes: { count: number; booked: number; customer_cents: number; driver_cents: number; commission_cents: number; processing_cents: number };
  fees: { status: string; count: number; gross: number; fee: number }[];
};
const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const feeLabel: Record<string, string> = { PENDING: "Em aberto", CLAIMED: "Declarado", VERIFIED: "Recebido", REJECTED: "Rejeitado" };

export function FinanceOverviewPanel({ since, refresh }: { since: string; refresh: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (supabase as any).rpc("get_admin_finance_overview", { p_since: since }).then(({ data, error }: any) => {
      if (!live) return;
      if (error) setError(error.message); else { setError(""); setData(data); }
    });
    return () => { live = false; };
  }, [since, refresh]);
  if (error) return <p role="alert" className="text-sm text-destructive">Resumo financeiro indisponível: {error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Carregando resumo financeiro…</p>;
  const q = data.quotes;
  const cards = [
    ["Corridas rápidas solicitadas", `${q.booked} de ${q.count} cotações`],
    ["Pago pelos passageiros", brl(q.customer_cents / 100)],
    ["Repasse previsto aos motoristas", brl(q.driver_cents / 100)],
    ["Comissão CARONAA prevista", brl(q.commission_cents / 100)],
    ["Taxas de processamento", brl(q.processing_cents / 100)],
  ];
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-bold">Resumo financeiro do período</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([t, v]) => (
          <article key={t} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t}</p>
            <p className="mt-1 text-lg font-bold">{v}</p>
          </article>
        ))}
      </div>
      <div>
        <h3 className="font-semibold">Comissões das caronas compartilhadas</h3>
        {data.fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada no período.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {data.fees.map((f) => (
              <article key={f.status} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{feeLabel[f.status] ?? f.status} · {f.count}</p>
                <p className="text-muted-foreground">Comissão {brl(f.fee)} · viagens {brl(f.gross)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Valores previstos registrados no sistema; não representam saldo bancário conciliado.</p>
    </section>
  );
}
