import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Item = { rideId: string; status: string; gross: number; fee: number; createdAt: string; claimReference: string | null };
type Driver = {
  driverId: string; name: string; email: string | null; vehicle: string | null; plate: string | null;
  pendingCount: number; openCount: number; claimedCount: number; pendingAmount: number; blocked: boolean; oldestAt: string; items: Item[];
};
const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
type Filter = "all" | "high" | "pending" | "claimed";

export function driverDebtTag(d: Pick<Driver, "pendingCount" | "claimedCount">) {
  if (d.pendingCount >= 3) return { label: "3+ pendências · sem bloqueio", cls: "bg-amber-500/15 text-amber-700" };
  if (d.claimedCount > 0) return { label: "Comprovante declarado", cls: "bg-secondary text-secondary-foreground" };
  return { label: "Pendente", cls: "bg-primary/20 text-foreground" };
}

export function DriverDebtsPanel({ refresh }: { refresh: number }) {
  const [rows, setRows] = useState<Driver[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    void (supabase as any).rpc("get_admin_driver_debts_overview").then(({ data, error }: any) => {
      if (!live) return;
      if (error) setError(error.message); else { setError(""); setRows(data ?? []); }
    });
    return () => { live = false; };
  }, [refresh]);
  if (error) return <p role="alert" className="text-sm text-destructive">Pendências indisponíveis: {error}</p>;
  if (!rows) return <p className="text-sm text-muted-foreground">Carregando pendências dos motoristas…</p>;

  const high = rows.filter((r) => r.pendingCount >= 3);
  const claimed = rows.filter((r) => r.claimedCount > 0);
  const total = rows.reduce((s, r) => s + Number(r.pendingAmount), 0);
  const term = q.trim().toLowerCase();
  const list = rows
    .filter((r) => filter === "all" || (filter === "high" ? r.pendingCount >= 3 : filter === "claimed" ? r.claimedCount > 0 : r.pendingCount < 3))
    .filter((r) => !term || [r.name, r.email, r.plate].some((v) => v?.toLowerCase().includes(term)));
  const cards: [string, string, Filter][] = [
    ["3+ pendências (sem bloqueio)", String(high.length), "high"],
    ["Com 1–2 pendências", String(rows.length - high.length), "pending"],
    ["Aguardando conferência", String(claimed.length), "claimed"],
    ["Total a receber", brl(total), "all"],
  ];

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-bold">Pendências dos motoristas</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([t, v, f]) => (
          <button key={t} onClick={() => setFilter(f)} className={`rounded-lg border p-3 text-left ${filter === f ? "border-primary" : ""}`}>
            <p className="text-xs text-muted-foreground">{t}</p>
            <p className="mt-1 text-lg font-bold">{v}</p>
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou placa" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum motorista com pendência neste filtro.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((d) => {
            const tag = driverDebtTag(d);
            return (
              <li key={d.driverId} className="rounded-lg border">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                    <span>
                      <span className="font-semibold">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.email ?? "sem e-mail"} · {[d.vehicle, d.plate].filter(Boolean).join(" · ") || "veículo não informado"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tag.cls}`}>{tag.label}</span>
                      <b>{d.pendingCount} · {brl(d.pendingAmount)}</b>
                    </span>
                  </summary>
                  <div className="border-t p-3 text-sm">
                    <p className="mb-2 text-xs text-muted-foreground">Débito mais antigo: {date(d.oldestAt)}{d.email ? <> · <a className="underline" href={`mailto:${d.email}`}>Enviar e-mail</a></> : null}</p>
                    <ul className="space-y-1">
                      {d.items.map((i) => (
                        <li key={i.rideId} className="flex flex-wrap justify-between gap-2">
                          <span>{date(i.createdAt)} · viagem {brl(i.gross)}</span>
                          <span>comissão {brl(i.fee)} · {i.status === "CLAIMED" ? `declarado${i.claimReference ? ` (${i.claimReference})` : ""}` : "em aberto"}</span>
                        </li>
                      ))}
                    </ul>
                    {d.claimedCount > 0 && <p className="mt-2 text-xs text-muted-foreground">Confirme os repasses declarados na seção de conferência Pix deste painel.</p>}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
