import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizeUnifiedCrmRows, consolidateCrmContacts, filterUnifiedCrmContacts,
  unifiedCrmMetrics, unifiedCrmCsv, unifiedCrmWhatsappLink,
  DEFAULT_CRM_FILTERS,
} from "./unified-crm-service";

const records = normalizeUnifiedCrmRows({
  research: [
    { source_type: "RESEARCH", source_id: "r1", source_form: "0K9K09K",
      source_label: "UNIFOR", name: "Ana Silva", email: "ANA@EXEMPLO.EDU.BR",
      academic_role: "ESTUDANTE", mobility_role: "PASSAGEIRO",
      route_origin: "Messejana", route_destination: "Campus UNIFOR",
      outbound_time: "07:30", pains: ["LOTACAO", "PRECO_ALTO"],
      contact_consent: true, institutional_email: true,
      created_at: "2026-10-26T13:00:00Z",
      raw_payload: { answers: { Dificuldades: ["LOTACAO"] } } },
    { source_type: "RESEARCH", source_id: "r2", source_form: "UNILAB-1",
      source_label: "UNILAB", name: "Ana Silva", email: "ana@exemplo.edu.br",
      academic_role: "ESTUDANTE", mobility_role: "AMBOS",
      route_origin: "Redenção", route_destination: "Campus UNILAB",
      vehicle_type: "CARRO", seats: "3", pains: ["ESPERA_LONGA"],
      contact_consent: true, institutional_email: false,
      created_at: "2026-10-25T11:00:00Z",
      raw_payload: { answers: { "Veículo": "CARRO" } } },
  ],
  sts: [
    { submission_id: "sts1", nome: "Ana Silva", email: "ana@exemplo.edu.br",
      whatsapp: "85988887777", source: "sts-2026", campaign_event: "STS 2026",
      tipo_usuario: "PASSAGEIRO", ocupacao: "ESTUDANTE_UNIVERSITARIO",
      consentimento: true, origem_trajeto: "Aldeota", destino_trajeto: "Centro de Eventos",
      created_at: "2026-10-24T14:00:00Z",
      pain_points: [{codigo_dor: "DOR_02", selecionada: true, principal: true}],
      raw_payload: { researchAccepted: true } },
  ],
  pitch: [
    { id: "pitch1", name: "Investidor B", whatsapp: "85999990000",
      email: "investidor@example.org", interest: "INVESTIDOR", consent_contact: true,
      status: "CONTACTADO", source: "admin_manual", created_at: "2026-10-25T12:00:00Z",
      raw_payload: { message: "Solicitou demonstração" } },
  ],
});

describe("CRM unificado — preservação de origens e participações", () => {
  it("consolida UNIFOR, UNILAB e STS por e-mail consentido, mantendo respostas distintas", () => {
    const contacts = consolidateCrmContacts(records);
    expect(contacts).toHaveLength(2);
    const person = contacts.find(c => c.name === "Ana Silva")!;
    expect(person.participations).toHaveLength(3);
    expect(person.source_forms).toEqual(expect.arrayContaining(["0K9K09K", "UNILAB-1", "sts-2026"]));
    expect(person.participations.map(p => p.source_label))
      .toEqual(expect.arrayContaining(["UNIFOR", "UNILAB", "STS 2026"]));
    expect(person.pains).toEqual(expect.arrayContaining(["LOTACAO", "ESPERA_LONGA", "DOR_02"]));
    expect(person.mobility_roles).toEqual(expect.arrayContaining(["PASSAGEIRO", "AMBOS"]));
    expect(person.participations.every(p => Boolean(p.raw_payload))).toBe(true);
    expect(contacts.find(c => c.name === "Investidor B")?.mobility_roles).toContain("INVESTIDOR");
  });

  it("aplica filtros combinados de instituição, vínculo, perfil e dor sem ocultar histórico", () => {
    const contacts = consolidateCrmContacts(records);
    const filtered = filterUnifiedCrmContacts(contacts, {
      ...DEFAULT_CRM_FILTERS, source: "UNILAB-1", academic: "ESTUDANTE",
      mobility: "MOTORISTA", pain: "LOTACAO",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].participations).toHaveLength(3);
    expect(filterUnifiedCrmContacts(contacts, { ...DEFAULT_CRM_FILTERS, source: "PITCH" }))
      .toHaveLength(1);
  });

  it("calcula indicadores reais sobre a listagem e persiste status de grupo", () => {
    const key = "email:ana@exemplo.edu.br";
    const contacts = consolidateCrmContacts(records, [{contact_key:key,status:"EM_ACOMPANHAMENTO"}]);
    expect(contacts.find(c => c.name==="Ana Silva")?.status).toBe("EM_ACOMPANHAMENTO");
    expect(unifiedCrmMetrics(contacts)).toEqual({
      total: 2, anonymousParticipations: 0, drivers: 1, passengers: 1, institutionalPercent: 50, newContacts: 0,
    });
  });

  it("não inventa contatos para respostas anônimas nem funde duas identidades", () => {
    const anonymous = normalizeUnifiedCrmRows({research:[
      {source_id:"anonymous1",source_form:"TESTE-A",source_label:"Comunidade A", name:"Participante sem identificação",
       contact_consent:false, created_at:"2026-10-26T10:00:00Z"},
      {source_id:"anonymous2",source_form:"TESTE-B",source_label:"Comunidade B", name:"Participante sem identificação",
       contact_consent:false, created_at:"2026-10-26T10:00:00Z"},
    ],sts:[],pitch:[]});
    expect(consolidateCrmContacts(anonymous)).toHaveLength(2);
    expect(anonymous.every(r=>r.email===null && r.whatsapp===null)).toBe(true);
    const metrics = unifiedCrmMetrics(consolidateCrmContacts(anonymous));
    expect(metrics.total).toBe(0);
    expect(metrics.anonymousParticipations).toBe(2);
  });

  it("não autoriza mensagens de WhatsApp pelo consentimento do e-mail", () => {
    const rows = normalizeUnifiedCrmRows({research:[{source_id:"w1",source_form:"UNILAB-1",name:"Pessoa",email:"pessoa@test.com",whatsapp:"+5585999990000",whatsapp_contact_consent:false,created_at:"2026-10-27T10:00:00Z"}],sts:[],pitch:[]});
    expect(consolidateCrmContacts(rows)[0].consented_whatsapp).toBeNull();
  });

  it("trata exportações potencialmente perigosas e formata WhatsApp brasileiro", () => {
    const contacts = consolidateCrmContacts(records);
    const spreadsheet = unifiedCrmCsv(contacts.map(c => ({...c,name:"=HYPERLINK('evil')"})));
    expect(spreadsheet).toContain("'=HYPERLINK");
    expect(unifiedCrmWhatsappLink("(85) 99999-0000")).toBe("https://wa.me/5585999990000");
    expect(unifiedCrmWhatsappLink("123")).toBeNull();
  });

  it("exige RPC admin e mantém status sob RLS sem copiar respostas", () => {
    const migration = readFileSync("drizzle/migrations/0120_unified_multiform_crm.sql","utf8");
    expect(migration).toContain("get_admin_research_crm_rows");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(migration).toContain("linkage_consent IS TRUE");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/DELETE FROM public.research_answers|UPDATE public.research_answers/);
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { filterUnifiedCrmContacts as f2, DEFAULT_CRM_FILTERS as D2, type UnifiedCrmContact as C2 } from "./unified-crm-service";
d2("source filter for legacy STS codes", () => {
  i2("STS-2026 catalog code matches sts-2026 and sts2026 rows", () => {
    const mk = (form: string) => ({ contact_key: form, name: "x", email: null, whatsapp: null, source_forms: [form],
      mobility_roles: [], pains: [], status: "NOVO", participations: [{ source_form: form, source_label: "Siará" }] }) as unknown as C2;
    const rows = [mk("sts-2026"), mk("sts2026"), mk("0K9K09K")];
    e2(f2(rows, { ...D2, source: "STS-2026" }).length).toBe(2);
  });
});
