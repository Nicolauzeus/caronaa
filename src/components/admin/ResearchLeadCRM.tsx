import { useEffect, useState } from "react";
import { Mail, ShieldCheck, UsersRound, UserRoundPlus } from "lucide-react";
import {
  getAdminResearchLeadMetrics, getAdminResearchLeads, getAdminResearchLeadSources,
  type ResearchLeadRow, type ResearchLeadMetrics, type ResearchLeadSource,
  type ResearchLeadStatus,
} from "@/lib/formulario/research-lead";

const STATUS_OPTIONS: { value: ResearchLeadStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas as situações" },
  { value: "SEM_CADASTRO", label: "Ainda sem cadastro" },
  { value: "CADASTRO_NAO_CONFIRMADO", label: "Cadastro não confirmado" },
  { value: "CONTA_CONFIRMADA", label: "Conta confirmada" },
];
const STATUS_NAMES = Object.fromEntries(STATUS_OPTIONS.map((x) => [x.value, x.label]));
const date = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
const PAGE_SIZE = 20;

export function ResearchLeadCRM() {
  const [metrics, setMetrics] = useState<ResearchLeadMetrics | null>(null);
  const [sources, setSources] = useState<ResearchLeadSource[]>([]);
  const [rows, setRows] = useState<ResearchLeadRow[]>([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<ResearchLeadStatus | "ALL">("SEM_CADASTRO");
  const [formId, setFormId] = useState("");
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([getAdminResearchLeadMetrics(formId), getAdminResearchLeadSources()])
      .then(([summary, forms]) => {
        if (!active) return;
        setMetrics(summary); setSources(forms); setError("");
      })
      .catch((reason) => {
        if (active) { setMetrics(null); setError(reason instanceof Error ? reason.message : "Dados indisponíveis"); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [formId, refresh]);

  useEffect(() => {
    let active = true;
    setListLoading(true);
    void getAdminResearchLeads({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, status, formId, marketingOnly })
      .then((result) => {
        if (!active) return;
        setRows(result.rows); setCount(result.total); setListError("");
      })
      .catch((reason) => {
        if (active) { setRows([]); setCount(0); setListError(reason instanceof Error ? reason.message : "Listagem indisponível"); }
      })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [status, formId, marketingOnly, page, refresh]);

  function filterChanged(action: () => void) { setPage(0); action(); }
  const selectClass = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
  const cards = metrics ? [
    { label: "E-mails captados", value: metrics.contacts, icon: Mail },
    { label: "Ainda sem cadastro", value: metrics.withoutAccount, icon: UsersRound },
    { label: "Cadastro não confirmado", value: metrics.pendingConfirmation, icon: UserRoundPlus },
    { label: "Conta confirmada", value: metrics.confirmedAccounts, icon: ShieldCheck },
  ] : [];

  return (
    <section aria-label="Leads captados pelas pesquisas" className="space-y-4 rounded-2xl border border-border bg-card/40 p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">Leads captados pelas pesquisas</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            Pessoas únicas com contato registrado. Cadastro identificado por consulta protegida ao Supabase.
            Responder uma pesquisa não autoriza campanhas comerciais.
          </p>
        </div>
        <button type="button" onClick={() => setRefresh((n) => n + 1)}
          className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">
          Atualizar dados
        </button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-amber-500/30 p-3 text-sm text-muted-foreground">
          {error} Os formulários existentes permanecem disponíveis.
        </p>
      ) : loading && !metrics ? (
        <p role="status" className="text-sm text-muted-foreground">Consultando a captação…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs leading-snug text-muted-foreground">{label}</p>
                <Icon size={16} aria-hidden="true" className="shrink-0 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
      {metrics && <p className="text-xs text-muted-foreground">
        {metrics.marketingOptIn.toLocaleString("pt-BR")} contato(s) com autorização de marketing.
        Esta contagem não autoriza disparos sem verificar a finalidade e eventuais revogações.
      </p>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_auto]">
        <label className="space-y-1 text-xs font-semibold">
          Pesquisa de origem
          <select className={selectClass} value={formId} onChange={(e) => filterChanged(() => setFormId(e.target.value))}>
            <option value="">Todas as pesquisas</option>
            {sources.map((source) =>
              <option key={source.form_id} value={source.form_id}>{source.form_title} ({source.source_code})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Situação da conta
          <select className={selectClass} value={status}
            onChange={(e) => filterChanged(() => setStatus(e.target.value as ResearchLeadStatus | "ALL"))}>
            {STATUS_OPTIONS.map((option) =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-border px-3 text-xs font-semibold">
          <input type="checkbox" checked={marketingOnly}
            onChange={(e) => filterChanged(() => setMarketingOnly(e.target.checked))}/>
          Só com autorização comercial
        </label>
      </div>
      {listError && <p role="alert" className="text-sm text-destructive">{listError}</p>}
      {listLoading ? <p role="status" className="py-4 text-sm text-muted-foreground">Carregando contatos…</p> :
        rows.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">Nenhum contato encontrado neste recorte.</p> : (
          <>
            <div className="space-y-2 md:hidden">
              {rows.map((lead) => (
                <article key={lead.email} className="min-w-0 rounded-xl border border-border bg-card p-3">
                  <p className="break-all text-sm font-semibold">{lead.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{lead.form_title} · {date(lead.captured_at)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-lg bg-muted px-2 py-1">{STATUS_NAMES[lead.registration_status]}</span>
                    <span className="text-muted-foreground">{lead.marketing_consent ? "Contato comercial autorizado" : "Sem autorização comercial"}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr><th className="p-3">E-mail</th><th className="p-3">Pesquisa</th>
                    <th className="p-3">Captação</th><th className="p-3">Conta</th>
                    <th className="p-3">Marketing</th></tr>
                </thead>
                <tbody>{rows.map((lead) => (
                  <tr key={lead.email} className="border-t border-border">
                    <td className="max-w-[230px] break-all p-3 font-medium">{lead.email}</td>
                    <td className="p-3">{lead.form_title}</td>
                    <td className="whitespace-nowrap p-3 tabular-nums">{date(lead.captured_at)}</td>
                    <td className="p-3">{STATUS_NAMES[lead.registration_status]}</td>
                    <td className="p-3">{lead.marketing_consent ? "Autorizado" : "Não autorizado"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Página {page+1} · {count.toLocaleString("pt-BR")} contato(s) no filtro</span>
              <div className="flex gap-2">
                <button type="button" disabled={page===0} onClick={() => setPage(page-1)}
                  className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-40">Anterior</button>
                <button type="button" disabled={(page+1)*PAGE_SIZE>=count} onClick={() => setPage(page+1)}
                  className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-40">Próxima</button>
              </div>
            </div>
          </>
        )}
    </section>
  );
}
