import { supabase } from "@/integrations/supabase/client";
import {
  PitchContact,
  PitchContactFormData,
  PitchContactStatus,
  PitchFilterOptions,
  PitchSuggestionStatus,
} from "./types";

const LOCAL_STORAGE_KEY = "caronaa_pitch_contacts_backup_v1";

function getLocalBackup(): PitchContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBackup(contact: PitchContact) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBackup();
    const updated = [contact, ...list.filter((c) => c.id !== contact.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not write pitch backup to local storage", err);
  }
}

function updateLocalBackup(id: string, updates: Partial<PitchContact>) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBackup();
    const updated = list.map((c) => (c.id === id ? { ...c, ...updates } : c));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not update local storage backup", err);
  }
}

/**
 * Normaliza número de telefone/WhatsApp para formato limpo
 */
export function normalizePhoneNumber(val: string): string {
  return val.replace(/\D/g, "");
}

interface SupabaseUntypedTable {
  insert: (record: Record<string, unknown>) => {
    select: () => {
      maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
  };
  update: (record: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
  };
}

function getPitchTable() {
  return (
    supabase as unknown as {
      from: (table: string) => SupabaseUntypedTable;
    }
  ).from("pitch_contacts");
}

/**
 * Salva um contato enviado para a equipe de relacionamento da CARONAA.
 */
export async function savePitchContact(
  formData: PitchContactFormData,
): Promise<{ success: boolean; data?: PitchContact; error?: string }> {
  const finalPhone = formData.same_phone_whatsapp
    ? formData.whatsapp
    : formData.phone || formData.whatsapp;

  const newContact: PitchContact = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    interest: formData.interest,
    name: formData.name.trim(),
    whatsapp: formData.whatsapp.trim(),
    phone: finalPhone.trim(),
    same_phone_whatsapp: formData.same_phone_whatsapp,
    email: formData.email?.trim() || null,
    investor_update_preference: formData.investor_update_preference || null,
    institution_name: formData.institution_name?.trim() || null,
    institution_type: formData.institution_type || null,
    institution_address: formData.institution_address?.trim() || null,
    partnership_type: formData.partnership_type || null,
    partnership_type_custom: formData.partnership_type_custom?.trim() || null,
    message: formData.message.trim(),
    consent_contact: formData.consent_contact,
    consent_newsletter: formData.consent_newsletter,
    status: "NOVO",
    suggestion_status: "NOVA",
    notes: null,
    source: formData.source || "admin_manual",
    raw_payload: { ...formData },
  };

  try {
    const { data, error } = await getPitchTable()
      .insert({
        id: newContact.id,
        interest: newContact.interest,
        name: newContact.name,
        whatsapp: newContact.whatsapp,
        phone: newContact.phone,
        same_phone_whatsapp: newContact.same_phone_whatsapp,
        email: newContact.email,
        investor_update_preference: newContact.investor_update_preference,
        institution_name: newContact.institution_name,
        institution_type: newContact.institution_type,
        institution_address: newContact.institution_address,
        partnership_type: newContact.partnership_type,
        partnership_type_custom: newContact.partnership_type_custom,
        message: newContact.message,
        consent_contact: newContact.consent_contact,
        consent_newsletter: newContact.consent_newsletter,
        status: newContact.status,
        suggestion_status: newContact.suggestion_status,
        notes: newContact.notes,
        source: newContact.source,
        raw_payload: newContact.raw_payload,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Supabase insert on pitch_contacts failed:", error);
      return { success: false, error: error.message || "Não foi possível salvar no servidor." };
    }

    return { success: true, data: (data as PitchContact) || newContact };
  } catch (err: unknown) {
    console.warn("Exception during savePitchContact:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Não foi possível salvar no servidor.",
    };
  }
}

/**
 * Busca a lista de contatos do Pitch para o painel administrativo
 */
export async function getPitchContacts(
  filters?: PitchFilterOptions,
): Promise<{ data: PitchContact[]; error?: string }> {
  let contacts: PitchContact[] = [];
  let remoteError: string | undefined;

  try {
    const { data, error } = await getPitchTable()
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      contacts = data as PitchContact[];
    } else {
      remoteError = error?.message || "Não foi possível carregar os contatos do servidor.";
      contacts = getLocalBackup();
    }
  } catch (error) {
    remoteError =
      error instanceof Error ? error.message : "Falha ao carregar contatos do servidor.";
    contacts = getLocalBackup();
  }

  // Merge any local contacts that might not be in the remote list yet
  const localList = getLocalBackup();
  const remoteIds = new Set(contacts.map((c) => c.id));
  for (const local of localList) {
    if (!remoteIds.has(local.id)) {
      contacts.push(local);
    }
  }

  // Sort descending by created_at
  contacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Apply filters
  if (filters) {
    if (filters.interest && filters.interest !== "TODOS") {
      contacts = contacts.filter((c) => c.interest === filters.interest);
    }
    if (filters.status && filters.status !== "TODOS") {
      contacts = contacts.filter((c) => c.status === filters.status);
    }
    if (filters.suggestion_status && filters.suggestion_status !== "TODOS") {
      contacts = contacts.filter((c) => c.suggestion_status === filters.suggestion_status);
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.whatsapp.includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.institution_name && c.institution_name.toLowerCase().includes(q)) ||
          (c.message && c.message.toLowerCase().includes(q)),
      );
    }
  }

  return { data: contacts, error: remoteError };
}

/**
 * Atualiza o status do relacionamento
 */
export async function updatePitchContactStatus(
  id: string,
  status: PitchContactStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getPitchTable().update({ status }).eq("id", id);

    if (error) {
      console.warn("Could not update remote pitch contact status:", error);
      return { success: false, error: error.message || "Não foi possível atualizar o status." };
    }
    updateLocalBackup(id, { status });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao atualizar status.",
    };
  }
}

/**
 * Atualiza o status da sugestão
 */
export async function updatePitchSuggestionStatus(
  id: string,
  suggestion_status: PitchSuggestionStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getPitchTable().update({ suggestion_status }).eq("id", id);

    if (error) {
      console.warn("Could not update remote pitch suggestion status:", error);
      return { success: false, error: error.message || "Não foi possível atualizar o status." };
    }
    updateLocalBackup(id, { suggestion_status });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao atualizar status.",
    };
  }
}

/**
 * Atualiza anotações internas da equipe
 */
export async function updatePitchContactNotes(
  id: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getPitchTable().update({ notes }).eq("id", id);

    if (error) {
      console.warn("Could not update remote pitch contact notes:", error);
      return { success: false, error: error.message || "Não foi possível salvar as anotações." };
    }
    updateLocalBackup(id, { notes });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao salvar anotações.",
    };
  }
}

/**
 * Exporta contatos do pitch para formato CSV
 */
export function exportPitchContactsToCsv(contacts: PitchContact[]): void {
  const headers = [
    "ID",
    "Data de Cadastro",
    "Interesse",
    "Nome",
    "WhatsApp",
    "Telefone",
    "E-mail",
    "Pref. Atualização Investidor",
    "Nome da Instituição",
    "Tipo da Instituição",
    "Endereço da Instituição",
    "Tipo de Parceria",
    "Outro Tipo de Parceria",
    "Mensagem / Sugestão",
    "Status Contato",
    "Status Sugestão",
    "Notas Internas",
  ];

  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = contacts.map((c) => [
    escapeCell(c.id),
    escapeCell(new Date(c.created_at).toLocaleString("pt-BR")),
    escapeCell(c.interest),
    escapeCell(c.name),
    escapeCell(c.whatsapp),
    escapeCell(c.phone),
    escapeCell(c.email),
    escapeCell(c.investor_update_preference),
    escapeCell(c.institution_name),
    escapeCell(c.institution_type),
    escapeCell(c.institution_address),
    escapeCell(c.partnership_type),
    escapeCell(c.partnership_type_custom),
    escapeCell(c.message),
    escapeCell(c.status),
    escapeCell(c.suggestion_status),
    escapeCell(c.notes),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `caronaa_pitch_relacionamentos_${new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
