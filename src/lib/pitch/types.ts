export type PitchInterest = "INVESTIDOR" | "PARCEIRO" | "AMBOS";

export type InvestorUpdatePreference =
  "DURANTE_VALIDACAO" | "AVISO_TERMINO" | "PRINCIPAIS_RESULTADOS" | "CONVERSAR_DIRETO";

export type InstitutionType = "UNIVERSIDADE" | "EMPRESA" | "INSTITUICAO" | "COMUNIDADE" | "OUTRO";

export type PartnershipType = "TESTAR_INSTITUICAO" | "APRESENTAR_SOLUCAO" | "PILOTO" | "OUTRO";

export type PitchContactStatus =
  "NOVO" | "CONTACTADO" | "EM_ACOMPANHAMENTO" | "CONVERTIDO" | "ARQUIVADO";

export type PitchSuggestionStatus = "NOVA" | "EM_ANALISE" | "RESPONDIDA" | "ARQUIVADA";

export interface PitchContact {
  id: string;
  created_at: string;
  updated_at?: string;
  interest: PitchInterest;
  name: string;
  whatsapp: string;
  phone: string | null;
  same_phone_whatsapp: boolean;
  email: string | null;
  investor_update_preference: InvestorUpdatePreference | null;
  institution_name: string | null;
  institution_type: InstitutionType | null;
  institution_address: string | null;
  partnership_type: PartnershipType | null;
  partnership_type_custom: string | null;
  message: string;
  consent_contact: boolean;
  consent_newsletter: boolean;
  status: PitchContactStatus;
  suggestion_status: PitchSuggestionStatus;
  notes: string | null;
  source: string;
  raw_payload?: Record<string, unknown> | null;
}

export interface PitchContactFormData {
  source?: string;
  interest: PitchInterest;
  name: string;
  whatsapp: string;
  phone?: string;
  same_phone_whatsapp: boolean;
  email?: string;
  investor_update_preference?: InvestorUpdatePreference;
  institution_name?: string;
  institution_type?: InstitutionType;
  institution_address?: string;
  partnership_type?: PartnershipType;
  partnership_type_custom?: string;
  message: string;
  consent_contact: boolean;
  consent_newsletter: boolean;
}

export interface PitchFilterOptions {
  interest?: PitchInterest | "TODOS";
  status?: PitchContactStatus | "TODOS";
  suggestion_status?: PitchSuggestionStatus | "TODOS";
  search?: string;
}

export const INVESTOR_UPDATE_LABELS: Record<InvestorUpdatePreference, string> = {
  DURANTE_VALIDACAO: "Quero acompanhar durante a validação",
  AVISO_TERMINO: "Quero ser avisado quando esta etapa terminar",
  PRINCIPAIS_RESULTADOS: "Quero receber apenas os principais resultados",
  CONVERSAR_DIRETO: "Quero conversar diretamente com a equipe",
};

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  UNIVERSIDADE: "Universidade / Faculdade",
  EMPRESA: "Empresa privada",
  INSTITUICAO: "Instituição pública / Governamental",
  COMUNIDADE: "Comunidade / Associação",
  OUTRO: "Outro formato",
};

export const PARTNERSHIP_TYPE_LABELS: Record<PartnershipType, string> = {
  TESTAR_INSTITUICAO: "Quero testar a CARONAA na instituição e que outros se beneficiem",
  APRESENTAR_SOLUCAO: "Quero apresentar a solução à instituição",
  PILOTO: "Quero conversar sobre um piloto",
  OUTRO: "Outro formato de parceria",
};

export const CONTACT_STATUS_LABELS: Record<PitchContactStatus, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  EM_ACOMPANHAMENTO: "Em acompanhamento",
  CONVERTIDO: "Convertido / Parceria iniciada",
  ARQUIVADO: "Arquivado",
};

export const SUGGESTION_STATUS_LABELS: Record<PitchSuggestionStatus, string> = {
  NOVA: "Nova",
  EM_ANALISE: "Em análise",
  RESPONDIDA: "Respondida",
  ARQUIVADA: "Arquivada",
};
