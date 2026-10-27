import { supabase } from "@/integrations/supabase/client";
import { formatResearchOption } from "@/lib/formulario/research-option-labels";

/**
 * One admin-only CRM projection. No source tables are copied or rewritten.
 * RLS protects Pitch/STS; research data comes only from an admin-gated RPC.
 */
type RecordValue = Record<string, unknown>;
type DbError = { message: string } | null;
const db = supabase as unknown as {
  from(name: string): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): {
        range(start: number, end: number): Promise<{ data: unknown[] | null; error: DbError }>;
      };
    };
    upsert(value: RecordValue, options: { onConflict: string }): Promise<{ error: DbError }>;
  };
  rpc(name: string, args: RecordValue): Promise<{ data: unknown[] | null; error: DbError }>;
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: DbError }> };
};

export type UnifiedCrmStatus = "NOVO" | "CONTACTADO" | "EM_ACOMPANHAMENTO" | "CONVERTIDO" | "ARQUIVADO";
export const UNIFIED_CRM_STATUSES: UnifiedCrmStatus[] = [
  "NOVO", "CONTACTADO", "EM_ACOMPANHAMENTO", "CONVERTIDO", "ARQUIVADO",
];
export type CrmSourceType = "RESEARCH" | "STS" | "PITCH";
export type UnifiedCrmParticipation = {
  id: string;
  source_type: CrmSourceType;
  source_form: string;
  source_label: string;
  created_at: string;
  academic_role: string | null;
  mobility_role: string | null;
  route_origin: string | null;
  route_destination: string | null;
  outbound_time: string | null;
  vehicle_type: string | null;
  seats: number | null;
  pains: string[];
  raw_payload: RecordValue;
};
export type UnifiedCrmEntry = UnifiedCrmParticipation & {
  name: string;
  email: string | null;
  whatsapp: string | null;
  contact_consent: boolean;
  institutional_email: boolean;
  status: UnifiedCrmStatus;
};
export type UnifiedCrmContact = {
  id: string;
  contact_key: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  /** Only an explicitly approved messaging number may generate a WhatsApp action. */
  consented_whatsapp: string | null;
  can_contact: boolean;
  institutional_email: boolean;
  source_form: string;
  source_forms: string[];
  academic_role: string | null;
  mobility_role: string | null;
  mobility_roles: string[];
  route_origin: string | null;
  route_destination: string | null;
  outbound_time: string | null;
  vehicle_type: string | null;
  seats: number | null;
  pains: string[];
  created_at: string;
  status: UnifiedCrmStatus;
  raw_payload: RecordValue;
  participations: UnifiedCrmParticipation[];
};

const asRecord = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const entries = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(asRecord) : [];
const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter((v): v is string => Boolean(v)) : [];
const stamp = (value: unknown) => text(value) ?? new Date(0).toISOString();
const phoneDigits = (value: string | null): string => (value ?? "").replace(/[^0-9]/g, "");
const statusOrNew = (value: unknown): UnifiedCrmStatus =>
  UNIFIED_CRM_STATUSES.includes(value as UnifiedCrmStatus) ? value as UnifiedCrmStatus : "NOVO";

export function normalizeAcademicAffiliation(value: unknown): string | null {
  const role = text(value)?.toUpperCase();
  if (!role) return null;
  if (role.includes("ESTUDANTE") || role.includes("ALUNO")) return "ESTUDANTE";
  if (role.includes("PROFESSOR") || role.includes("DOCENTE")) return "PROFESSOR";
  if (role.includes("TERCEIR") || role.includes("PRESTADOR")) return "TERCEIRIZADO";
  if (role.includes("COLABORADOR") || role.includes("TECNICO") ||
      role.includes("TÉCNICO") || role.includes("TRABALHADOR"))
    return "COLABORADOR";
  return "OUTRO";
}
export function normalizeMobilityRole(value: unknown): string | null {
  const role = text(value)?.toUpperCase();
  if (!role) return null;
  if (role === "AMBOS" || role.includes("PASSAGEIRO_MOTORISTA")) return "AMBOS";
  if (role.includes("MOTORISTA") || role.includes("CONDUTOR")) return "MOTORISTA";
  if (role.includes("PASSAGEIRO")) return "PASSAGEIRO";
  if (role === "INVESTIDOR") return "INVESTIDOR";
  if (role === "PARCEIRO") return "PARCEIRO";
  return null;
}

/** Pure normalization, used for both live PostgREST data and Vitest fixtures. */
export function normalizeUnifiedCrmRows(input: {
  research: unknown[]; sts: unknown[]; pitch: unknown[];
}): UnifiedCrmEntry[] {
  const research = input.research.map(value => {
    const row = asRecord(value);
    const raw = asRecord(row.raw_payload);
    return {
      source_type: "RESEARCH" as const,
      id: "research:" + String(row.source_id ?? ""),
      source_form: text(row.source_form) ?? "PESQUISA",
      source_label: text(row.source_label) ?? text(row.source_form) ?? "Pesquisa",
      name: text(row.name) ?? "Participante sem identificação",
      email: text(row.email)?.toLowerCase() ?? null,
      whatsapp: text(row.whatsapp),
      academic_role: normalizeAcademicAffiliation(row.academic_role),
      mobility_role: normalizeMobilityRole(row.mobility_role),
      route_origin: text(row.route_origin),
      route_destination: text(row.route_destination),
      outbound_time: text(row.outbound_time),
      vehicle_type: text(row.vehicle_type),
      seats: Number(row.seats) >= 1 ? Number(row.seats) : null,
      pains: stringArray(row.pains),
      created_at: stamp(row.created_at),
      // Linkage consent means associating a research answer to an email,
      // NOT permission to initiate unsolicited outreach.
      contact_consent: false,
      institutional_email: row.institutional_email === true,
      status: statusOrNew(row.status),
      raw_payload: raw,
    };
  });
  const sts = input.sts.map(value => {
    const row = asRecord(value);
    const raw = asRecord(row.raw_payload);
    const consent = row.consentimento === true;
    const selected = entries(row.pain_points).filter(p => p.selecionada === true);
    const pains = selected.map(p => text(p.codigo_dor)).filter((v): v is string => Boolean(v));
    return {
      source_type: "STS" as const,
      id: "sts:" + String(row.submission_id ?? ""),
      source_form: text(row.source) ?? "STS",
      source_label: text(row.campaign_event) ?? text(row.campaign) ?? "STS",
      name: text(row.nome) ?? text(raw.name) ?? "Participante STS",
      email: consent ? text(row.email)?.toLowerCase() ?? null : null,
      whatsapp: consent ? text(row.whatsapp) : null,
      academic_role: normalizeAcademicAffiliation(row.ocupacao ?? raw.occupation),
      mobility_role: normalizeMobilityRole(row.tipo_usuario ?? raw.intent),
      route_origin: text(row.origem_trajeto) ?? text(raw.originNeighborhood),
      route_destination: text(row.destino_trajeto) ?? text(raw.destinationNeighborhood),
      outbound_time: text(row.faixa_horario) ?? text(raw.departureWindow),
      vehicle_type: text(raw.vehicleType),
      seats: Number(raw.availableSeats) >= 1 ? Number(raw.availableSeats) : null,
      pains: pains.length ? pains : stringArray(raw.painPoints),
      created_at: stamp(row.created_at),
      contact_consent: consent && (raw.contactConsent === true || raw.linkageConsent === true),
      institutional_email: false,
      status: "NOVO" as const,
      raw_payload: { ...raw, pain_points: row.pain_points ?? [] },
    };
  });
  const pitch = input.pitch.map(value => {
    const row = asRecord(value);
    const interest = text(row.interest)?.toUpperCase();
    const role = interest === "AMBOS" ? "PARCEIRO_INVESTIDOR" : normalizeMobilityRole(interest);
    const consent = row.consent_contact === true;
    return {
      source_type: "PITCH" as const,
      id: "pitch:" + String(row.id ?? ""),
      source_form: "PITCH",
      source_label: text(row.source)?.includes("admin") ? "Pitch / Manual" : "STS / Pitch",
      name: text(row.name) ?? "Contato de parceria",
      email: consent ? text(row.email)?.toLowerCase() ?? null : null,
      whatsapp: consent ? text(row.whatsapp) : null,
      academic_role: null,
      mobility_role: role,
      route_origin: null,
      route_destination: null,
      outbound_time: null,
      vehicle_type: null,
      seats: null,
      pains: [],
      created_at: stamp(row.created_at),
      contact_consent: consent,
      institutional_email: false,
      status: statusOrNew(row.status),
      raw_payload: { ...asRecord(row.raw_payload), institution: row.institution_name ?? null,
        interest: row.interest ?? null, message: row.message ?? null, notes: row.notes ?? null },
    };
  });
  return [...research, ...sts, ...pitch].sort(
    (a,b) => b.created_at.localeCompare(a.created_at),
  );
}

function contactIdentity(entry: UnifiedCrmEntry): string {
  if (entry.email) return "email:" + entry.email.toLowerCase();
  const digits = phoneDigits(entry.whatsapp);
  if (digits.length >= 10 && digits.length <= 13) return "whatsapp:" + digits;
  return entry.id;
}

export function consolidateCrmContacts(
  rows: UnifiedCrmEntry[], statuses: Array<{ contact_key: string; status: UnifiedCrmStatus }> = [],
): UnifiedCrmContact[] {
  const mapped = new Map<string, UnifiedCrmContact>();
  const overrides = new Map(statuses.map(x => [x.contact_key, statusOrNew(x.status)]));
  for (const row of [...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at))) {
    const key = contactIdentity(row);
    const participation: UnifiedCrmParticipation = {
      id: row.id, source_type: row.source_type, source_form: row.source_form,
      source_label: row.source_label, created_at: row.created_at,
      academic_role: row.academic_role, mobility_role: row.mobility_role,
      route_origin: row.route_origin, route_destination: row.route_destination,
      outbound_time: row.outbound_time, vehicle_type: row.vehicle_type,
      seats: row.seats, pains: [...row.pains], raw_payload: row.raw_payload,
    };
    const current = mapped.get(key);
    if (!current) {
      mapped.set(key, {
        id: row.id, contact_key: key, name: row.name, email: row.email,
        whatsapp: row.whatsapp, consented_whatsapp: row.contact_consent ? row.whatsapp : null,
        can_contact: row.contact_consent,
        institutional_email: row.institutional_email, source_form: row.source_form,
        source_forms: [row.source_form],
        academic_role: row.academic_role, mobility_role: row.mobility_role,
        mobility_roles: row.mobility_role ? [row.mobility_role] : [],
        route_origin: row.route_origin, route_destination: row.route_destination,
        outbound_time: row.outbound_time, vehicle_type: row.vehicle_type,
        seats: row.seats, pains: [...new Set(row.pains)],
        created_at: row.created_at, status: overrides.get(key) ?? row.status,
        raw_payload: row.raw_payload, participations: [participation],
      });
      continue;
    }
    current.participations.push(participation);
    if (!current.source_forms.includes(row.source_form)) current.source_forms.push(row.source_form);
    if (row.mobility_role && !current.mobility_roles.includes(row.mobility_role))
      current.mobility_roles.push(row.mobility_role);
    if (row.academic_role && !current.academic_role) current.academic_role = row.academic_role;
    if (row.email && !current.email) current.email = row.email;
    if (row.whatsapp && !current.whatsapp) current.whatsapp = row.whatsapp;
    if (row.whatsapp && row.contact_consent && !current.consented_whatsapp)
      current.consented_whatsapp = row.whatsapp;
    current.can_contact ||= row.contact_consent;
    if (!overrides.has(key) && current.status === "NOVO" && row.status !== "NOVO")
      current.status = row.status;
    current.institutional_email ||= row.institutional_email;
    if (current.name.startsWith("Participante") && !row.name.startsWith("Participante"))
      current.name = row.name;
    current.pains = [...new Set([...current.pains, ...row.pains])];
    for (const field of ["route_origin","route_destination","outbound_time","vehicle_type","seats"] as const)
      if (current[field] == null) Object.assign(current, { [field]: row[field] });
  }
  return [...mapped.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));
}

const PAGE_SIZE = 250;
const MAX_ROWS_PER_SOURCE = 20000;
type QueryResult = { data: unknown[] | null; error: DbError };
async function collectPages(label: string, query: (offset: number) => Promise<QueryResult>): Promise<unknown[]> {
  const result: unknown[] = [];
  for (let offset = 0; offset <= MAX_ROWS_PER_SOURCE; offset += PAGE_SIZE) {
    const { data, error } = await query(offset);
    if (error || !Array.isArray(data))
      throw new Error("Não foi possível carregar " + label + ": " + (error?.message ?? "resposta inválida"));
    result.push(...data);
    if (data.length < PAGE_SIZE) return result;
  }
  // Avoid presenting deceptively incomplete CRM metrics as production totals.
  throw new Error("A consulta de " + label + " atingiu o limite operacional. Use paginação no servidor.");
}

export async function getUnifiedCrmContacts(): Promise<UnifiedCrmContact[]> {
  const [research,sts,pitch,statusRows] = await Promise.all([
    collectPages("pesquisas", async offset => db.rpc("get_admin_research_crm_rows", {
      p_limit: PAGE_SIZE, p_offset: offset,
    })),
    collectPages("STS", async offset => db.from("form_submissions")
      .select("*,pain_points:form_submission_pain_points(*)")
      .order("created_at", { ascending: false })
      .range(offset,offset + PAGE_SIZE - 1)),
    collectPages("Pitch", async offset => db.from("pitch_contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset,offset + PAGE_SIZE - 1)),
    collectPages("status do CRM", async offset => db.from("unified_crm_contact_statuses")
      .select("contact_key,status")
      .order("contact_key", { ascending: true })
      .range(offset,offset + PAGE_SIZE - 1)),
  ]);
  const normalized = normalizeUnifiedCrmRows({ research, sts, pitch });
  return consolidateCrmContacts(normalized, statusRows.map(asRecord).map(row => ({
    contact_key: text(row.contact_key) ?? "",
    status: statusOrNew(row.status),
  })));
}

/** Status writes are subject to the new table's strict admin-only RLS. */
export async function updateUnifiedCrmStatus(contact: UnifiedCrmContact, status: UnifiedCrmStatus): Promise<void> {
  if (!UNIFIED_CRM_STATUSES.includes(status)) throw new Error("Status inválido.");
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error("Autenticação necessária para alterar o CRM.");
  const result = await db.from("unified_crm_contact_statuses").upsert({
    contact_key: contact.contact_key,
    status,
    updated_by: data.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "contact_key" });
  if (result.error) throw new Error("Status não atualizado: " + result.error.message);
}

export type UnifiedCrmFilters = {
  search: string; source: string; academic: string; mobility: string; pain: string; status: string;
};
export const DEFAULT_CRM_FILTERS: UnifiedCrmFilters = {
  search: "", source: "TODOS", academic: "TODOS", mobility: "TODOS", pain: "TODOS", status: "TODOS",
};

export function filterUnifiedCrmContacts(contacts: UnifiedCrmContact[], filters: UnifiedCrmFilters) {
  const q = filters.search.trim().toLocaleLowerCase("pt-BR");
  return contacts.filter(contact => {
    if (filters.source !== "TODOS" &&
      !contact.participations.some(p => p.source_form === filters.source || p.source_label === filters.source))
      return false;
    if (filters.academic !== "TODOS" && !contact.participations.some(p => p.academic_role === filters.academic))
      return false;
    if (filters.mobility !== "TODOS" && !contact.mobility_roles.some(role =>
      role === filters.mobility || (role === "AMBOS" && ["PASSAGEIRO","MOTORISTA"].includes(filters.mobility)) ||
      (role === "PARCEIRO_INVESTIDOR" && ["PARCEIRO","INVESTIDOR"].includes(filters.mobility))))
      return false;
    if (filters.pain !== "TODOS" && !contact.pains.includes(filters.pain)) return false;
    if (filters.status !== "TODOS" && contact.status !== filters.status) return false;
    return !q || [contact.name,contact.email,contact.whatsapp,...contact.source_forms,
      ...contact.participations.map(p=>p.source_label),contact.route_origin,contact.route_destination]
      .some(value => value?.toLocaleLowerCase("pt-BR").includes(q));
  });
}

export function unifiedCrmMetrics(contacts: UnifiedCrmContact[]) {
  // Anonymous research participation remains in dossiers, but is not invented
  // as a contactable lead or an actionable "new" contact.
  const withContact = contacts.filter(c => Boolean(c.email || c.whatsapp));
  const withEmail = withContact.filter(contact => Boolean(contact.email));
  const institutional = withEmail.filter(contact => contact.institutional_email).length;
  return {
    total: withContact.length,
    anonymousParticipations: contacts.length - withContact.length,
    drivers: contacts.filter(c => c.mobility_roles.some(r => r==="MOTORISTA"||r==="AMBOS")).length,
    passengers: contacts.filter(c => c.mobility_roles.some(r => r==="PASSAGEIRO"||r==="AMBOS")).length,
    institutionalPercent: withEmail.length ? Math.round(100 * institutional / withEmail.length) : 0,
    newContacts: withContact.filter(c => c.status==="NOVO").length,
  };
}

export function unifiedCrmWhatsappLink(number: string | null): string | null {
  let digits = phoneDigits(number);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits.length >= 12 && digits.length <= 15 ? "https://wa.me/" + digits : null;
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  const escaped = /^[ \t\r\n]*[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + escaped.replace(/"/g,'""') + '"';
}
export function unifiedCrmCsv(contacts: UnifiedCrmContact[]): string {
  const headers = ["Nome","Email","WhatsApp","Origens","Vinculo","Perfil","Origem trajeto",
    "Destino trajeto","Horario","Veiculo","Vagas","Dores","Participacoes","Status","Data"];
  const rows = contacts.map(c => [
    c.name,c.email,c.whatsapp,c.participations.map(p=>p.source_label).join(" | "),
    c.academic_role,c.mobility_roles.join(" / "),c.route_origin,c.route_destination,
    c.outbound_time,c.vehicle_type,c.seats,c.pains.map(formatResearchOption).join(" | "),
    c.participations.length,c.status,c.created_at,
  ]);
  return "\uFEFF" + [headers.map(csvCell).join(","),...rows.map(row=>row.map(csvCell).join(","))].join("\r\n");
}
