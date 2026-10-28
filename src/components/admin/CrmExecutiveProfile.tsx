import { useId, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SavedAnswers } from "./SavedAnswers";
import {
  crmContactHeading, formatCrmAnswerValue, formatCrmRole,
  summarizeCrmParticipation, type ExecutiveField,
} from "@/lib/crm/crm-presentation";
import {
  UNIFIED_CRM_STATUSES, unifiedCrmWhatsappLink,
  type UnifiedCrmContact, type UnifiedCrmParticipation, type UnifiedCrmStatus,
} from "@/lib/crm/unified-crm-service";
import { formatBrazilWhatsapp } from "@/lib/formulario/research-whatsapp";

const statusLabels: Record<UnifiedCrmStatus, string> = {
  NOVO: "Novo", CONTACTADO: "Contactado", EM_ACOMPANHAMENTO: "Em acompanhamento",
  CONVERTIDO: "Convertido", ARQUIVADO: "Arquivado",
};

const showDate = (date: string) =>
  Number.isNaN(Date.parse(date)) ? "Data não informada" : new Date(date).toLocaleDateString("pt-BR");

function Pair({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid min-w-0 gap-x-3 border-b border-white/[.07] py-2 sm:grid-cols-[170px_minmax(0,1fr)]">
      <dt className="text-xs text-white/55">{label}</dt>
      <dd className="min-w-0 break-words text-sm leading-5 text-white/90">
        {value === null || value === undefined || value === "" ? "Não informado" : value}
      </dd>
    </div>
  );
}

function AnswersList({ items, empty }: { items: ExecutiveField[]; empty: string }) {
  if (!items.length) return <p className="text-xs leading-5 text-white/50">{empty}</p>;
  return <dl>{items.map((item, index) =>
    <Pair key={item.label + "-" + index} label={item.label} value={item.value} />)}</dl>;
}

function ExecutiveSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2 border-t border-white/10 pt-3">
      <h4 className="font-['Sora'] text-sm font-semibold text-white/90">{title}</h4>
      {children}
    </section>
  );
}

function Participation({
  participation: p, expanded, onToggle, headingId, panelId,
}: {
  participation: UnifiedCrmParticipation;
  expanded: boolean;
  onToggle: () => void;
  headingId: string;
  panelId: string;
}) {
  const data = summarizeCrmParticipation(p);
  const route = data.routine.find(item => item.label === "Trajeto")?.value ?? null;
  const routineDetails = data.routine.filter(item => item.label !== "Trajeto");
  const extraCount = Object.keys(data.otherAnswers).length;
  const pitch = p.source_type === "PITCH";

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[.025]">
      <h4 className="m-0">
        <button type="button" id={headingId} aria-expanded={expanded}
          aria-controls={panelId} onClick={onToggle}
          className="flex min-h-14 w-full min-w-0 items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFBB00] sm:px-4">
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-['Sora'] text-sm font-semibold text-white">{p.source_label}</span>
              <span className="text-xs text-white/45">{showDate(p.created_at)}</span>
              <span className="rounded-md bg-white/[.07] px-2 py-0.5 text-[11px] text-white/70">
                {formatCrmRole(p.mobility_role)}
              </span>
            </span>
            {route && (
              <span className="block break-words text-xs leading-5 text-white/75">
                <span className="text-white/50">Trajeto: </span>{route}
              </span>
            )}
            {data.primaryPain && (
              <span className="block break-words text-xs leading-5 text-white/75">
                <span className="text-white/50">Dor principal: </span>{data.primaryPain}
              </span>
            )}
            {!route && !data.primaryPain && (
              <span className="block text-xs text-white/50">
                {data.fit[0] ? data.fit[0].label + ": " + data.fit[0].value
                  : "Consultar respostas desta participação"}
              </span>
            )}
          </span>
          <ChevronDown size={18} aria-hidden="true"
            className={"mt-1 shrink-0 text-[#FFBB00] transition-transform " +
              (expanded ? "rotate-180" : "")}/>
        </button>
      </h4>

      {expanded && (
        <div id={panelId} role="region" aria-labelledby={headingId}
          className="space-y-4 border-t border-white/10 px-3 pb-4 pt-3 sm:px-4">
          {!pitch && (
            <ExecutiveSection title="Rotina de deslocamento">
              <AnswersList items={routineDetails} empty={
                route ? "Sem outros detalhes de rotina." : "Nenhum trajeto declarado nesta participação."
              }/>
            </ExecutiveSection>
          )}

          <ExecutiveSection title={pitch ? "Interesse e relacionamento" : "Adesão e disposição a pagar"}>
            <AnswersList items={data.fit}
              empty="Nenhuma informação de adesão ou orçamento registrada nesta participação."/>
          </ExecutiveSection>

          {!pitch && (
            <ExecutiveSection title="Dores e barreiras identificadas">
              {data.barriers.length > 0 && <AnswersList items={data.barriers} empty=""/>}
              {data.pains.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-white/55">
                    {data.primaryPain ? "Outras dificuldades" : "Dificuldades relatadas"}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {data.pains.map((pain, index) => (
                      <li key={pain + index}
                        className="rounded-md border border-[#FFBB00]/25 bg-[#FFBB00]/[.06] px-2 py-1 text-xs leading-5 text-white/85">
                        {pain}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!data.primaryPain && !data.barriers.length && !data.pains.length && (
                <p className="text-xs text-white/50">Nenhuma dificuldade registrada nesta participação.</p>
              )}
            </ExecutiveSection>
          )}

          {extraCount > 0 && (
            <details className="border-t border-white/10 pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-white/75 focus-visible:outline focus-visible:outline-[#FFBB00]">
                Outras respostas ({extraCount})
              </summary>
              <div className="mt-2"><SavedAnswers value={data.otherAnswers}/></div>
            </details>
          )}

          <details className="border-t border-white/10 pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-white/50 focus-visible:outline focus-visible:outline-[#FFBB00]">
              Auditoria técnica — JSON e identificadores
            </summary>
            <p className="mb-2 text-xs leading-5 text-white/45">
              Respostas originais e identificadores. Acesso restrito ao administrador.
            </p>
            <pre className="max-h-80 max-w-full overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-5 text-white/70">
              {JSON.stringify({ participationId: p.id, raw_payload: p.raw_payload }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </article>
  );
}

type Props = {
  contact: UnifiedCrmContact;
  savingStatus: boolean;
  onStatusChange: (status: UnifiedCrmStatus) => void;
  onClose?: () => void;
};

export function CrmExecutiveProfile({ contact, savingStatus, onStatusChange, onClose }: Props) {
  const id = useId();
  const [activeParticipation, setActiveParticipation] = useState<string | null>(
    contact.participations[0]?.id ?? null,
  );
  const whatsapp = contact.whatsapp ? formatBrazilWhatsapp(contact.whatsapp) : null;
  // A number alone or an e-mail linkage never grants WhatsApp outreach permission.
  const waLink = contact.consented_whatsapp
    ? unifiedCrmWhatsappLink(contact.consented_whatsapp) : null;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col font-['Manrope'] text-white">
      <header className="z-10 flex shrink-0 items-start gap-2 border-b border-white/10 bg-[#121212] px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
        <button type="button" onClick={onClose} aria-label="Voltar para contatos"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FFBB00] sm:hidden">
          <ArrowLeft size={19} aria-hidden="true"/>
        </button>
        <div className="min-w-0 flex-1 space-y-1.5 pr-6 sm:pr-8">
          <DialogTitle asChild>
            <h2 className="break-words font-['Sora'] text-base font-semibold leading-snug sm:text-xl">
              {crmContactHeading(contact)}
            </h2>
          </DialogTitle>
          <DialogDescription asChild>
            <p className="text-xs text-white/55">
              {contact.participations.length} {contact.participations.length === 1 ? "participação" : "participações"}
              {" · "}{contact.source_forms.length} {contact.source_forms.length === 1 ? "pesquisa/origem" : "pesquisas/origens"}
            </p>
          </DialogDescription>
          <div className="flex flex-wrap gap-1.5">
            {contact.academic_role && (
              <span className="rounded-md bg-[#FFBB00]/10 px-2 py-0.5 text-[11px] font-semibold text-[#FFBB00]">
                {formatCrmAnswerValue(contact.academic_role)}
              </span>
            )}
            {contact.mobility_roles.map(role => (
              <span key={role} className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/70">
                {formatCrmRole(role)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-4">
        <section aria-label="Contato e status" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-['Sora'] text-sm font-semibold text-white">Contato e status</h3>
            <span className="text-xs text-white/50">{statusLabels[contact.status]}</span>
          </div>
          <dl className="grid gap-x-6 sm:grid-cols-2">
            <Pair label="E-mail" value={contact.email}/>
            <Pair label="WhatsApp" value={whatsapp}/>
            <Pair label="Vínculo" value={contact.academic_role ? formatCrmAnswerValue(contact.academic_role) : null}/>
            <Pair label="Contato por WhatsApp"
              value={waLink ? "Autorizado" : "Sem autorização registrada"}/>
          </dl>
          <label className="block space-y-1.5">
            <span className="block text-xs text-white/55">Status do relacionamento</span>
            <select aria-label="Alterar status do CRM" disabled={savingStatus}
              value={contact.status} onChange={event =>
                onStatusChange(event.target.value as UnifiedCrmStatus)}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3 text-sm text-white outline-none focus:border-[#FFBB00]">
              {UNIFIED_CRM_STATUSES.map(status =>
                <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          {waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-semibold text-[#121212]">
              Conversar pelo WhatsApp <ExternalLink size={15} aria-hidden="true"/>
            </a>
          ) : (
            <p className="text-xs leading-5 text-white/50">
              Responder à pesquisa não autoriza mensagens comerciais automaticamente.
            </p>
          )}
        </section>

        <section aria-label="Histórico de participações" className="space-y-2.5 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-['Sora'] text-sm font-semibold">Participações</h3>
            <p className="text-xs text-white/50">Abra uma pesquisa para ver os detalhes</p>
          </div>
          {contact.participations.map((p, index) => (
            <Participation key={p.id} participation={p}
              expanded={activeParticipation === p.id}
              onToggle={() => setActiveParticipation(current => current === p.id ? null : p.id)}
              headingId={id + "-heading-" + index}
              panelId={id + "-panel-" + index}/>
          ))}
        </section>
      </div>
    </div>
  );
}
