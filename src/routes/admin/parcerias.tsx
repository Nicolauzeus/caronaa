import { AdminDataError } from "@/components/admin/AdminDataError";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminModuleSection } from "@/lib/admin/use-admin-module-section";
import { InsightChart } from "@/components/admin/InsightChart";
export const Route = createFileRoute("/admin/parcerias")({ component: PartnershipsPage });
type Partner = {
  id: string;
  name: string;
  kind: string;
  municipality: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
};
type Pilot = {
  id: string;
  partner_id: string;
  title: string;
  municipality: string;
  status: string;
  objective: string;
  success_criteria: string;
  outcomes: string;
};
const db = supabase as any;
const kinds = ["UNIVERSIDADE", "PREFEITURA", "EMPRESA", "ASSOCIACAO", "COOPERATIVA", "OUTRO"];
const partnerStatuses = ["PROSPECCAO", "CONTATO", "NEGOCIACAO", "ATIVA", "SUSPENSA", "ENCERRADA"];
const pilotStatuses = ["PLANEJAMENTO", "VALIDACAO", "ATIVO", "PAUSADO", "CONCLUIDO", "CANCELADO"];
function PartnershipsPage() {
  const [tab] = useAdminModuleSection<"partners" | "pilots" | "territory">(
    { partners: "partners", pilots: "pilots", expansion: "territory" },
    "partners",
  );
  const [partners, setPartners] = useState<Partner[]>([]),
    [pilots, setPilots] = useState<Pilot[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [kind, setKind] = useState("UNIVERSIDADE"),
    [municipality, setMunicipality] = useState(""),
    [contactName, setContactName] = useState(""),
    [contactEmail, setContactEmail] = useState("");
  const [pilotPartner, setPilotPartner] = useState(""),
    [pilotTitle, setPilotTitle] = useState(""),
    [objective, setObjective] = useState(""),
    [criteria, setCriteria] = useState("");
  const [query, setQuery] = useState("");
  async function reload() {
    setLoading(true);
    const [a, b] = await Promise.all([
      db
        .from("partner_organizations")
        .select("id,name,kind,municipality,status,contact_name,contact_email")
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("partner_pilots")
        .select("id,partner_id,title,municipality,status,objective,success_criteria,outcomes")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (a.error || b.error) {
      setError(
        "Não foi possível carregar parcerias. Confirme migração 0085: " +
          (a.error?.message ?? b.error?.message),
      );
      setPartners([]);
      setPilots([]);
    } else {
      setError("");
      setPartners(a.data ?? []);
      setPilots(b.data ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    void reload();
  }, []);
  async function addPartner(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await db
      .from("partner_organizations")
      .insert({
        name: name.trim(),
        kind,
        municipality: municipality.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) setError(error?.message ?? "Cadastro não confirmado");
    else {
      setName("");
      setMunicipality("");
      setContactName("");
      setContactEmail("");
      await reload();
    }
    setBusy(false);
  }
  async function addPilot(e: FormEvent) {
    e.preventDefault();
    if (!pilotPartner) return;
    setBusy(true);
    const partner = partners.find((p) => p.id === pilotPartner);
    const { data, error } = await db
      .from("partner_pilots")
      .insert({
        partner_id: pilotPartner,
        title: pilotTitle.trim(),
        municipality: partner?.municipality ?? "",
        objective: objective.trim(),
        success_criteria: criteria.trim(),
      })
      .select("id")
      .maybeSingle();
    if (error || !data) setError(error?.message ?? "Piloto não confirmado");
    else {
      setPilotTitle("");
      setObjective("");
      setCriteria("");
      await reload();
    }
    setBusy(false);
  }
  async function update(table: string, id: string, patch: Record<string, unknown>) {
    setBusy(true);
    const { data, error } = await db
      .from(table)
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !data) setError(error?.message ?? "Alteração não confirmada");
    else await reload();
    setBusy(false);
  }
  const result = useMemo(
    () =>
      partners.filter((x) =>
        [x.name, x.municipality, x.kind]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [partners, query],
  );
  const municipalities = useMemo(
    () =>
      [...new Set(partners.map((p) => p.municipality))].sort().map((place) => ({
        place,
        partners: partners.filter((p) => p.municipality === place).length,
        pilots: pilots.filter((p) => p.municipality === place).length,
      })),
    [partners, pilots],
  );
  return (
    <main className="space-y-6">
      <AdminDataError error={error} />
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Instituições", partners.length],
          ["Parcerias ativas", partners.filter((x) => x.status === "ATIVA").length],
          ["Pilotos ativos", pilots.filter((x) => x.status === "ATIVO").length],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "Carregando…" : error ? "Indisponível" : value}
            </p>
          </article>
        ))}
      </section>

      {tab === "partners" && (
        <>
          <details className="rounded-xl border border-border/70 bg-card/30 p-3">
            <summary className="cursor-pointer py-1 text-sm font-semibold text-primary">
              + Nova instituição
            </summary>
            <div className="pt-3">
              <form
                onSubmit={addPartner}
                className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2"
              >
                <h2 className="font-bold md:col-span-2">Nova instituição</h2>
                <label className="text-sm">
                  Nome
                  <input
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <label className="text-sm">
                  Natureza
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  >
                    {kinds.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Município
                  <input
                    required
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <label className="text-sm">
                  Responsável
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  E-mail do contato
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <button
                  disabled={busy || Boolean(error)}
                  className="rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground md:col-span-2"
                >
                  Cadastrar instituição
                </button>
              </form>
            </div>
          </details>
          <input
            aria-label="Pesquisar instituições"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por instituição, município ou natureza"
            className="w-full rounded-lg border bg-background p-3"
          />
          <div className="divide-y overflow-hidden rounded-xl border border-border/70">
            {result.map((p) => (
              <article
                key={p.id}
                className="space-y-2 bg-card/30 p-4 transition-colors hover:bg-accent/20"
              >
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {p.kind} · {p.municipality}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.contact_name ?? "Sem responsável"}
                </p>
                <label className="block text-xs">
                  Situação
                  <select
                    disabled={busy}
                    value={p.status}
                    onChange={(e) =>
                      void update("partner_organizations", p.id, { status: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border bg-background p-2"
                  >
                    {partnerStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
          {!loading && !result.length && (
            <p className="text-sm text-muted-foreground">Nenhuma instituição encontrada.</p>
          )}
        </>
      )}
      {tab === "pilots" && (
        <>
          {!loading && !error && (
            <InsightChart
              title="Situação dos pilotos"
              rows={pilotStatuses.map((status) => ({
                name: status,
                value: pilots.filter((p) => p.status === status).length,
              }))}
            />
          )}
          <details className="rounded-xl border border-border/70 bg-card/30 p-3">
            <summary className="cursor-pointer py-1 text-sm font-semibold text-primary">
              + Novo piloto
            </summary>
            <div className="pt-3">
              <form
                onSubmit={addPilot}
                className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2"
              >
                <h2 className="font-bold md:col-span-2">Novo piloto</h2>
                <label className="text-sm">
                  Instituição
                  <select
                    required
                    value={pilotPartner}
                    onChange={(e) => setPilotPartner(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  >
                    <option value="">Selecionar</option>
                    {partners.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Título
                  <input
                    required
                    minLength={3}
                    value={pilotTitle}
                    onChange={(e) => setPilotTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Objetivo
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Critérios de sucesso
                  <textarea
                    value={criteria}
                    onChange={(e) => setCriteria(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <button
                  disabled={busy || Boolean(error) || !pilotPartner}
                  className="rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground md:col-span-2"
                >
                  Criar piloto
                </button>
              </form>
            </div>
          </details>
          <div className="divide-y overflow-hidden rounded-xl border border-border/70">
            {pilots.map((p) => (
              <article
                key={p.id}
                className="space-y-2 bg-card/30 p-4 transition-colors hover:bg-accent/20"
              >
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {partners.find((x) => x.id === p.partner_id)?.name ?? "Instituição indisponível"}{" "}
                  · {p.municipality}
                </p>
                <p className="text-sm text-muted-foreground">{p.objective}</p>
                <label className="block text-xs">
                  Situação
                  <select
                    disabled={busy}
                    value={p.status}
                    onChange={(e) =>
                      void update("partner_pilots", p.id, { status: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border bg-background p-2"
                  >
                    {pilotStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "territory" && (
        <section className="space-y-3">
          {!loading && !error && (
            <InsightChart
              title="Ranking territorial de instituições"
              description="Quantidade de instituições cadastradas; não equivale a cobertura de transporte."
              rows={municipalities.map((m) => ({ name: m.place, value: m.partners }))}
            />
          )}
          <p className="text-sm text-muted-foreground">
            Distribuição de instituições e pilotos cadastrados por município. Não representa
            cobertura de transporte ou validação de viabilidade operacional.
          </p>
          <div className="divide-y overflow-hidden rounded-xl border border-border/70">
            {municipalities.map((m) => (
              <article key={m.place} className="bg-card/30 p-4">
                <h3 className="font-bold">{m.place}</h3>
                <p className="mt-2 text-sm">
                  {m.partners} instituições · {m.pilots} pilotos cadastrados
                </p>
              </article>
            ))}
          </div>
          {!municipalities.length && (
            <p className="text-sm text-muted-foreground">
              Ainda não existem municípios com instituições cadastradas.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
