import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
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
const fieldStyle = "grid gap-x-2 gap-y-0.5 border-b border-white/10 py-2 sm:grid-cols-[140px_minmax(0,1fr)]";
const labelStyle = "text-xs text-white/55";
const valueStyle = "min-w-0 break-words text-sm leading-5 text-white/90";

function Pair({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className={fieldStyle}>
      <dt className={labelStyle}>{label}</dt>
      <dd className={valueStyle}>{value === null || value === undefined || value === "" ? "Não informado" : value}</dd>
    </div>
  );
}

function AnswersList({ items, empty }: { items: ExecutiveField[]; empty: string }) {
  if (!items.length) return <p className="text-xs leading-5 text-white/55">{empty}</p>;
  return <dl>{items.map((item, index) =>
    <Pair key={item.label + "-" + index} label={item.label} value={item.value} />)}</dl>;
}

function ExecutiveSection({
  title, children,
}: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-2 border-t border-white/10 pt-3">
      <h4 className="font-['Sora'] text-sm font-semibold text-white">{title}</h4>
      {children}
    </section>
  );
}

function Participation({ participation: p }: { participation: UnifiedCrmParticipation }) {
  const data = summarizeCrmParticipation(p);
  const remaining = Object.keys(data.otherAnswers).length;
  const isPitch = p.source_type === "PITCH";
  return (
    <article className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold text-white">{p.source_label}</p>
          <p className="mt-0.5 text-xs text-white/55">
            {showDate(p.created_at)} · {formatCrmRole(p.mobility_role)}
          </p>
        </div>
        <span className="max-w-full break-words rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60">
          {p.source_form}
        </span>
      </header>

      {!isPitch && (
        <ExecutiveSection title="Rotina de deslocamento">
          <AnswersList items={data.routine} empty="Nenhum trajeto declarado nesta participação."/>
        </ExecutiveSection>
      )}

      <ExecutiveSection title="Adesão e disposição a pagar">
        <AnswersList items={data.fit} empty="Nenhuma informação de adesão ou orçamento registrada nesta participação."/>
      </ExecutiveSection>

      {!isPitch && <ExecutiveSection title="Dores e barreiras identificadas">
        {data.primaryPain && <dl><Pair label="Dor principal" value={data.primaryPain}/></dl>}
        {data.barriers.length > 0 && <AnswersList items={data.barriers} empty=""/>}
        {data.pains.length > 0 && (
          <div className="space-y-2">
            <p className={labelStyle}>{data.primaryPain ? "Outras dificuldades" : "Dificuldades relatadas"}</p>
            <ul className="flex flex-wrap gap-1.5">
              {data.pains.map((pain, index) => (
                <li key={pain + index} className="rounded-lg border border-[#FFBB00]/25 bg-[#FFBB00]/[.06] px-2.5 py-1 text-xs text-white/85">
                  {pain}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!data.primaryPain && !data.barriers.length && !data.pains.length && (
          <p className="text-xs text-white/55">Nenhuma dificuldade foi registrada nesta participação.</p>
        )}
      </ExecutiveSection>}

      {remaining > 0 && (
        <details className="border-t border-white/10 pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-white/70 focus-visible:outline focus-visible:outline-[#FFBB00]">
            Outras respostas ({remaining})
          </summary>
          <div className="mt-2 text-white/90"><SavedAnswers value={data.otherAnswers}/></div>
        </details>
      )}

      <details className="border-t border-white/10 pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-white/55 focus-visible:outline focus-visible:outline-[#FFBB00]">
          Auditoria técnica — JSON e identificadores
        </summary>
        <p className="mb-2 text-xs text-white/45">
          Dados originais da participação. Consulta administrativa, sem alteração do registro.
        </p>
        <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/35 p-3 font-mono text-xs leading-5 text-white/65">
          {JSON.stringify({participationId:p.id, raw_payload:p.raw_payload}, null, 2)}
        </pre>
      </details>
    </article>
  );
}

type Props = {
  contact: UnifiedCrmContact;
  savingStatus: boolean;
  onStatusChange: (status: UnifiedCrmStatus) => void;
};

export function CrmExecutiveProfile({ contact, savingStatus, onStatusChange }: Props) {
  const whatsapp = contact.whatsapp ? formatBrazilWhatsapp(contact.whatsapp) : null;
  const waLink = contact.consented_whatsapp && unifiedCrmWhatsappLink(contact.consented_whatsapp);
  return (
    <div className="min-w-0 space-y-4 font-['Manrope'] text-white">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {contact.academic_role && (
            <span className="rounded-lg border border-[#FFBB00]/35 bg-[#FFBB00]/10 px-2.5 py-1 text-xs font-semibold text-[#FFBB00]">
              {formatCrmAnswerValue(contact.academic_role)}
            </span>
          )}
          {contact.mobility_roles.map(role => (
            <span key={role} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70">
              {formatCrmRole(role)}
            </span>
          ))}
        </div>
        <DialogTitle asChild>
          <h2 className="break-words font-['Sora'] text-lg font-bold leading-tight sm:text-xl">
            {crmContactHeading(contact)}
          </h2>
        </DialogTitle>
        <DialogDescription asChild>
          <p className="text-xs text-white/55">
            {contact.participations.length} {contact.participations.length === 1 ? "participação registrada" : "participações registradas"}
            {" · "}{contact.source_forms.length} {contact.source_forms.length === 1 ? "origem" : "origens"}
          </p>
        </DialogDescription>
      </header>

      <section aria-label="Contato e status" className="min-w-0 rounded-2xl border border-white/10 bg-white/[.04] p-3 sm:p-4">
        <h3 className="mb-2 font-['Sora'] text-sm font-semibold">Contato e status</h3>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          <Pair label="E-mail" value={contact.email}/>
          <Pair label="WhatsApp" value={whatsapp}/>
          <Pair label="Vínculo" value={contact.academic_role ? formatCrmAnswerValue(contact.academic_role) : null}/>
          <Pair label="Mensagens por WhatsApp"
            value={waLink ? "Autorizadas" : "Sem autorização específica registrada"}/>
        </dl>
        <label className="mt-3 block space-y-1">
          <span className="block text-xs text-white/55">Status do relacionamento</span>
          <select aria-label="Alterar status do CRM"
            className="min-h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3 text-sm text-white outline-none focus:border-[#FFBB00]"
            disabled={savingStatus} value={contact.status}
            onChange={event => onStatusChange(event.target.value as UnifiedCrmStatus)}>
            {UNIFIED_CRM_STATUSES.map(status =>
              <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-semibold text-[#121212]">
            Conversar pelo WhatsApp <ExternalLink size={15} aria-hidden="true"/>
          </a>
        )}
        {!waLink && <p className="mt-2 text-xs leading-5 text-white/55">
          Responder à pesquisa não autoriza mensagens comerciais automaticamente.
        </p>}
      </section>

      <section aria-label="Histórico de participações" className="space-y-3">
        <h3 className="font-['Sora'] text-sm font-semibold">Histórico de participações</h3>
        {contact.participations.map(p => <Participation key={p.id} participation={p}/>)}
      </section>
    </div>
  );
}
