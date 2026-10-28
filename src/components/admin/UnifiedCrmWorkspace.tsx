import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { CrmExecutiveProfile } from "@/components/admin/CrmExecutiveProfile";
import { crmContactHeading, formatCrmRole } from "@/lib/crm/crm-presentation";
import { ListPagination } from "@/components/admin/ListPagination";
import {
  DEFAULT_CRM_FILTERS, UNIFIED_CRM_STATUSES,
  filterUnifiedCrmContacts, getUnifiedCrmContacts, unifiedCrmCsv,
  unifiedCrmMetrics, unifiedCrmWhatsappLink, updateUnifiedCrmStatus,
  type UnifiedCrmContact, type UnifiedCrmFilters, type UnifiedCrmStatus,
} from "@/lib/crm/unified-crm-service";
import { formatResearchOption } from "@/lib/formulario/research-option-labels";
import { formatBrazilWhatsapp } from "@/lib/formulario/research-whatsapp";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { matchBiCrmContact, parseBiCrmFilters } from "@/lib/crm/bi-crm-filters";

const statusLabel: Record<UnifiedCrmStatus,string> = {
  NOVO: "Novo", CONTACTADO: "Contactado", EM_ACOMPANHAMENTO: "Em acompanhamento",
  CONVERTIDO: "Convertido", ARQUIVADO: "Arquivado",
};
const academicOptions = [
  ["ESTUDANTE","Estudantes"],["PROFESSOR","Professores"],["COLABORADOR","Colaboradores / Técnicos"],
  ["TERCEIRIZADO","Terceirizados"],["OUTRO","Outros"],
] as const;
const mobilityOptions = [
  ["PASSAGEIRO","Passageiros"],["MOTORISTA","Motoristas"],["AMBOS","Ambos"],
  ["PARCEIRO","Parceiros"],["INVESTIDOR","Investidores"],
] as const;
const selectClass = "min-h-11 min-w-0 rounded-xl border border-white/10 bg-[#242424] px-3 text-sm text-white outline-none focus:border-[#FFBB00]";
const pill = "rounded-lg border border-white/10 bg-white/[.06] px-2.5 py-1 text-xs text-white/75";

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-[#121212]/90 p-3 backdrop-blur-2xl">
    <p className="text-xs text-white/55">{label}</p>
    <p className="mt-2 font-['Sora'] text-2xl font-semibold text-white">{value}</p>
  </div>;
}

export function UnifiedCrmWorkspace({ mode = "crm" }: { mode?: "crm" | "responses" }) {
  const [contacts, setContacts] = useState<UnifiedCrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UnifiedCrmFilters>(DEFAULT_CRM_FILTERS);
  const [segment, setSegment] = useState(() =>
    parseBiCrmFilters(typeof window === "undefined" ? "" : window.location.search));
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [revision, setRevision] = useState(0);
  const changeFilter = (key: keyof UnifiedCrmFilters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(0);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void getUnifiedCrmContacts()
      .then(rows => { if (alive) setContacts(rows); })
      .catch(reason => { if (alive) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o CRM.");
        setContacts([]); // Never report stale metrics as current.
      }})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [revision]);

  const filtered = useMemo(() => filterUnifiedCrmContacts(contacts, filters)
    .filter(c => !Object.keys(segment).length || matchBiCrmContact(c, segment)),
  [contacts, filters, segment]);
  const metrics = useMemo(() => unifiedCrmMetrics(filtered), [filtered]);
  const sourceOptions = useMemo(() => {
    const sources = new Map<string,string>();
    for (const contact of contacts) for (const item of contact.participations)
      if (!sources.has(item.source_form)) {
        sources.set(item.source_form,
          item.source_type === "PITCH" ? "Pitch / Manual" :
          item.source_type === "STS" ? "STS / " + item.source_label : item.source_label);
      }
    return [...sources.entries()].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
  }, [contacts]);
  const painOptions = useMemo(() => [...new Set(contacts.flatMap(c => c.pains))]
    .sort((a,b)=>formatResearchOption(a).localeCompare(formatResearchOption(b),"pt-BR")), [contacts]);
  const selected = contacts.find(c => c.contact_key === selectedKey) ?? null;
  const PAGE_SIZE = 12;
  const actualPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));

  async function changeStatus(contact: UnifiedCrmContact, status: UnifiedCrmStatus) {
    if (savingStatus || contact.status === status) return;
    setSavingStatus(true);
    try {
      await updateUnifiedCrmStatus(contact, status);
      setContacts(previous => previous.map(c => c.contact_key === contact.contact_key ? { ...c, status } : c));
      toast.success("Status de relacionamento atualizado.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível alterar o status.");
    } finally { setSavingStatus(false); }
  }
  function exportCsv() {
    if (!filtered.length) return;
    const blob = new Blob([unifiedCrmCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "caronaa-crm-unificado.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const hasFilters = Object.entries(filters).some(([key,value]) =>
    value !== (key === "search" ? "" : "TODOS"));

  return <main className="min-w-0 space-y-4 rounded-3xl bg-[#121212] p-3 font-['Manrope'] text-white sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFBB00]">
          Relacionamento e inteligência institucional
        </p>
        <h1 className="mt-1 font-['Sora'] text-xl font-bold sm:text-2xl">
          {mode === "crm" ? "CRM & Relacionamentos CARONAA" : "Respostas de todos os formulários"}
        </h1>
        <p className="mt-1 text-xs leading-5 text-white/55">
          Fontes reais: pesquisas públicas, STS e Pitch. Participações históricas preservadas,
          sem misturar respostas de campanhas diferentes.
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" aria-label="Atualizar contatos" onClick={() => setRevision(v => v+1)}
          disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm disabled:opacity-40">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
        <button type="button" onClick={exportCsv} disabled={!filtered.length||loading||Boolean(error)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFBB00] px-3 text-sm font-bold text-[#121212] disabled:opacity-40">
          <Download size={15}/> Exportar CSV ({filtered.length})
        </button>
      </div>
    </header>

    <section aria-label="Indicadores CRM" className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <Metric label="Total de leads" value={metrics.total}/>
      <Metric label="Motoristas potenciais" value={metrics.drivers}/>
      <Metric label="Passageiros" value={metrics.passengers}/>
      <Metric label="E-mails institucionais" value={metrics.institutionalPercent + "%"}/>
      <Metric label="Contatos novos" value={metrics.newContacts}/>
    </section>
    <p className="text-xs text-white/45">Indicadores do filtro atual. Percentual institucional entre os e-mails com domínio reconhecido. {metrics.anonymousParticipations > 0 && metrics.anonymousParticipations + " participação(ões) sem contato permanecem na lista, mas não são contadas como lead."}</p>

    {Object.keys(segment).length > 0 && <aside className="rounded-xl border border-[#FFBB00]/40 p-3 text-xs">
      <strong>Recorte encaminhado pelo BI</strong>
      <p>{Object.entries(segment).map(([k,v]) => k + ": " + v).join(" · ")}</p>
      <p>{filtered.length} contatos no recorte. O contato exige consentimento específico.</p>
      <button type="button" onClick={() => setSegment({})} className="mt-2 min-h-11 underline">Limpar recorte</button>
    </aside>}
    <section aria-label="Segmentação territorial e horários" className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-4">
      {([
        ["origin", "Bairro de origem"],
        ["destination", "Bairro de destino"],
        ["time", "Horário de saída (HH:mm)"],
        ["fare", "Orçamento declarado"],
      ] as const).map(([key,label]) => (
        <label key={key} className="min-w-0">
          <span className="mb-1 block text-xs text-white/60">{label}</span>
          <input className={selectClass + " w-full"} value={segment[key] ?? ""}
            placeholder={label}
            onChange={event => { setSegment(previous => ({...previous, [key]:event.target.value.slice(0,120)}));setPage(0); }}
          />
        </label>
      ))}
    </section>
    <section aria-label="Filtros combinados CRM" className="grid gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="relative sm:col-span-2 lg:col-span-1">
        <span className="mb-1 block text-xs text-white/60">Pesquisar</span>
        <Search size={15} className="pointer-events-none absolute bottom-3.5 left-3 text-white/45"/>
        <input aria-label="Pesquisar contato" placeholder="Nome, e-mail, rota..."
          className={selectClass+" w-full pl-9"}
          value={filters.search} onChange={e => changeFilter("search",e.target.value)}/>
      </label>
      <label><span className="mb-1 block text-xs text-white/60">Origem</span>
        <select aria-label="Filtrar origem" className={selectClass+" w-full"} value={filters.source}
          onChange={e=>changeFilter("source",e.target.value)}>
          <option value="TODOS">Todas as origens</option>
          {sourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label><span className="mb-1 block text-xs text-white/60">Vínculo</span>
        <select aria-label="Filtrar vínculo" className={selectClass+" w-full"} value={filters.academic}
          onChange={e=>changeFilter("academic",e.target.value)}>
          <option value="TODOS">Todos os vínculos</option>
          {academicOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label><span className="mb-1 block text-xs text-white/60">Perfil</span>
        <select aria-label="Filtrar perfil" className={selectClass+" w-full"} value={filters.mobility}
          onChange={e=>changeFilter("mobility",e.target.value)}>
          <option value="TODOS">Todos os perfis</option>
          {mobilityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label><span className="mb-1 block text-xs text-white/60">Dificuldade</span>
        <select aria-label="Filtrar dores" className={selectClass+" w-full"} value={filters.pain}
          onChange={e=>changeFilter("pain",e.target.value)}>
          <option value="TODOS">Todas as dores</option>
          {painOptions.map(code=><option key={code} value={code}>{formatResearchOption(code)}</option>)}
        </select>
      </label>
      <label><span className="mb-1 block text-xs text-white/60">Status</span>
        <select aria-label="Filtrar status" className={selectClass+" w-full"} value={filters.status}
          onChange={e=>changeFilter("status",e.target.value)}>
          <option value="TODOS">Todos os status</option>
          {UNIFIED_CRM_STATUSES.map(code=><option key={code} value={code}>{statusLabel[code]}</option>)}
        </select>
      </label>
      {hasFilters && <button type="button" onClick={()=>setFilters({...DEFAULT_CRM_FILTERS})}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/70 sm:col-span-2 lg:col-span-6">
        <X size={13}/> Limpar filtros
      </button>}
    </section>

    {loading ? <p role="status" className="rounded-2xl border border-white/10 p-6 text-sm text-white/70">
      Carregando todas as fontes autorizadas...
    </p> : error ? <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
      {error} Confira as permissões administrativas e a migration 0120.
    </div> : filtered.length === 0 ?
      <p className="rounded-2xl border border-white/10 px-4 py-8 text-center text-sm text-white/60">
        Nenhum registro encontrado para os filtros escolhidos.
      </p> : <section aria-label="Contatos unificados" className="space-y-2">
      {filtered.slice(actualPage*PAGE_SIZE,(actualPage+1)*PAGE_SIZE).map(contact => (
        <article key={contact.contact_key}
          className="rounded-2xl border border-white/10 bg-[#121212]/90 p-3 backdrop-blur-2xl sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full break-words font-['Sora'] font-semibold">{crmContactHeading(contact)}</h2>
                <span className={pill}>{statusLabel[contact.status]}</span>
                <span className={pill}>{contact.participations.length} participação(ões)</span>
              </div>
              <p className="text-xs text-white/65">
                {contact.email && contact.email !== crmContactHeading(contact) ? contact.email + " · " : ""}{contact.whatsapp ? formatBrazilWhatsapp(contact.whatsapp) : "WhatsApp não informado"}
              </p>
              <div className="flex flex-wrap gap-1">
                {[...new Set(contact.participations.map(p=>p.source_label))].map(source => (
                  <span className={pill} key={source}>{source}</span>
                ))}
                {contact.mobility_roles.map(role=><span key={role} className="rounded-lg border border-[#FFBB00]/30 bg-[#FFBB00]/10 px-2 py-1 text-xs text-[#FFBB00]">{formatCrmRole(role)}</span>)}
              </div>
              {contact.route_origin && <p className="text-xs text-white/60">
                {contact.route_origin} → {contact.route_destination ?? "Destino não informado"}
              </p>}
            </div>
            <button type="button" onClick={()=>setSelectedKey(contact.contact_key)}
              className="min-h-11 rounded-xl border border-white/20 px-3 text-sm font-semibold hover:border-[#FFBB00]">
              Ver ficha
            </button>
          </div>
        </article>
      ))}
    </section>}
    {!loading && !error && <ListPagination page={actualPage} total={filtered.length}
      pageSize={PAGE_SIZE} onChange={setPage}/>}

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedKey(null); }}>
      {selected && (
        <DialogContent
          aria-label="Ficha executiva do contato"
          className="!left-0 !top-0 !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-hidden !rounded-none !border-0 !bg-[#121212] !p-0 font-['Manrope'] text-white [&>button]:hidden sm:!left-1/2 sm:!top-1/2 sm:!h-[min(90dvh,900px)] sm:!w-[min(94vw,940px)] sm:!max-w-5xl sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-2xl sm:!border sm:!border-white/10 sm:[&>button]:inline-flex"
        >
          <CrmExecutiveProfile key={selected.contact_key}
            contact={selected} savingStatus={savingStatus}
            onClose={() => setSelectedKey(null)}
            onStatusChange={status => { void changeStatus(selected, status); }} />
        </DialogContent>
      )}
    </Dialog>
  </main>;
}
