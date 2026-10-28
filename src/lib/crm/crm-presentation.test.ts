import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  crmContactHeading, formatCrmAnswerValue, formatCrmFieldLabel,
  formatCrmRole, formatCrmWeekdays, summarizeCrmParticipation,
} from "./crm-presentation";
import type { UnifiedCrmParticipation } from "./unified-crm-service";

function sample(overrides: Partial<UnifiedCrmParticipation> = {}): UnifiedCrmParticipation {
  return {
    id: "research:123", source_type: "RESEARCH", source_form: "UNILAB-1",
    source_label: "UNILAB", created_at: "2026-10-23T12:00:00Z",
    academic_role: "ESTUDANTE", mobility_role: "PASSAGEIRO",
    route_origin: "Redenção", route_destination: "Liberdade",
    outbound_time: "07:00", vehicle_type: null, seats: null,
    pains: ["DOR_04", "DOR_03"],
    raw_payload: {
      journey: {
        originArea: "Redenção", destinationArea: "Liberdade",
        direction: "IDA_E_VOLTA", days: [1, 2, 3, 4, 5],
        outboundTime: "07:00", returnTime: "22:00", flexibilityMinutes: 10,
        originLat: -4.2, destinationLng: -38.8, marketingConsent: false,
      },
      answers: {
        "Qual é seu vínculo com a universidade?": "ESTUDANTE",
        "Como você se desloca hoje até o campus?": ["ONIBUS", "MOTOTAXI", "CARONA"],
        "Qual dessas dificuldades é a principal?": "DOR_04",
        "Quais dificuldades mais afetam seu deslocamento?": ["DOR_04", "DOR_03"],
        "O que mais faria você hesitar em pegar carona?": "PRECO",
        "Qual alternativa faria mais sentido para você?": "CARONA_COMPARTILHADA",
        "Com horário, trajeto e preço claros, consideraria pegar carona?": "CERTEZA",
        "Qual faixa de valor caberia no seu orçamento por trecho?": "DE_5_A_10",
        "Gostaria de saber quando o CARONAA começar na universidade?": true,
        "Comentários adicionais": "Preciso chegar sem atrasos.",
      },
      answers_raw: { "37c53fa3-2587-4466-8664-c074f21342b1": "DOR_04" },
      version: 4, form: "UNILAB-1",
    },
    ...overrides,
  };
}

describe("CRM executive presentation, with immutable original data", () => {
  it("documents the additive admin-only semantic projection for old published versions", () => {
    const source = readFileSync("drizzle/migrations/0123_crm_semantic_answer_details.sql","utf8");
    expect(source).toContain("SECURITY DEFINER SET search_path = ''");
    expect(source).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(source).toContain("'answers_structured',coalesce(meta.structured");
    expect(source).toContain("'semanticCode',nullif(q.value->>'semanticCode','')");
    expect(source).toContain("jsonb_array_elements(v.schema_json->'sections')");
    expect(source).toContain("REVOKE ALL ON FUNCTION public.get_admin_research_crm_rows");
    expect(source).not.toMatch(/(?:UPDATE|DELETE FROM)\s+public\.research_answers/i);
  });


  it("uses consented contact identity instead of generic name", () => {
    const base = { name: "Participante sem identificação", email: "pessoa@exemplo.edu.br", whatsapp: "+5585999990000" };
    expect(crmContactHeading(base)).toBe("pessoa@exemplo.edu.br");
    expect(crmContactHeading({ ...base, email: null })).toBe("(85) 99999-0000");
    expect(crmContactHeading({ ...base, email: null, whatsapp: null })).toBe("Participante sem contato informado");
    expect(crmContactHeading({ ...base, name: "Ana Silva" })).toBe("Ana Silva");
  });

  it("translates weekday arrays, money ranges and legacy enums", () => {
    expect(formatCrmWeekdays([1, 2, 3, 4, 5])).toBe("Segunda a sexta-feira");
    expect(formatCrmWeekdays([7, 6])).toBe("Sábado e domingo");
    expect(formatCrmWeekdays([1, 4])).toBe("Segunda-feira, Quinta-feira");
    expect(formatCrmWeekdays([1, 9])).toBeNull();
    expect(formatCrmAnswerValue("DE_5_A_10")).toBe("De R$ 5,00 a R$ 10,00");
    expect(formatCrmAnswerValue("DOR_04")).toBe("Muito tempo gasto no deslocamento");
    expect(formatCrmAnswerValue("CARONA_COMPARTILHADA")).toBe("Carona compartilhada no mesmo trajeto");
    expect(formatCrmAnswerValue("CERTEZA")).toBe("Com certeza");
    expect(formatCrmAnswerValue("PRECO")).toBe("Preço");
    expect(formatCrmAnswerValue("IDA_E_VOLTA")).toBe("Ida e volta");
    expect(formatCrmRole("PASSAGEIRO")).toBe("Passageiro");
    expect(formatCrmRole("AMBOS")).toBe("Passageiro e motorista");
    expect(formatCrmFieldLabel("flexibilityMinutes")).toBe("Tolerância de horário");
  });

  it("groups journey, actual transport, adoption and pains without repeating raw fields", () => {
    const p = sample();
    const before = JSON.stringify(p);
    const result = summarizeCrmParticipation(p);
    expect(result.routine).toContainEqual({ label: "Trajeto", value: "Redenção → Liberdade" });
    expect(result.routine).toContainEqual({ label: "Sentido", value: "Ida e volta" });
    expect(result.routine).toContainEqual({ label: "Horários", value: "Ida 07:00 · Volta 22:00" });
    expect(result.routine).toContainEqual({ label: "Dias da semana", value: "Segunda a sexta-feira" });
    expect(result.routine).toContainEqual({ label: "Tolerância", value: "±10 min" });
    expect(result.routine).toContainEqual({ label: "Transporte atual", value: "Ônibus, Mototáxi, Carona" });
    expect(result.fit).toContainEqual({ label: "Orçamento por trecho", value: "De R$ 5,00 a R$ 10,00" });
    expect(result.fit).toContainEqual({ label: "Alerta de lançamento", value: "Sim" });
    expect(result.fit).toContainEqual({ label: "Interesse", value: "Carona compartilhada no mesmo trajeto" });
    expect(result.fit).toContainEqual({ label: "Disposição de uso", value: "Com certeza" });
    expect(result.primaryPain).toBe("Muito tempo gasto no deslocamento");
    expect(result.barriers).toContainEqual({ label: "Maior receio/barreira", value: "Preço" });
    expect(result.pains).toEqual(["Preço alto das opções de transporte"]);
    expect(result.otherAnswers).toEqual({ "Comentários adicionais": "Preciso chegar sem atrasos." });
    expect(JSON.stringify(p)).toBe(before);
  });

  it("formats declared expenses in reais and respects the return direction", () => {
    const p = sample({
      outbound_time: "18:00",
      raw_payload: {
        journey: { direction: "VOLTA", outboundTime: "18:00", days: [2, 4] },
        answers: { "Quanto gasta, em média, por trecho (em R$)?": 6 },
      },
    });
    const result = summarizeCrmParticipation(p);
    expect(result.routine).toContainEqual({ label: "Horários", value: "Volta 18:00" });
    expect(result.routine).toContainEqual({ label: "Gasto habitual por trecho", value: "R$ 6,00" });
    expect(result.routine).toContainEqual({ label: "Dias da semana", value: "Terça-feira, Quinta-feira" });
  });

  it("classifies by immutable semanticCode even if published labels are renamed", () => {
    const p = sample({
      raw_payload: {
        journey: { direction: "IDA_E_VOLTA", days: [1, 2, 3, 4, 5] },
        answers: {
          "Campo A": ["ONIBUS", "CARONA"],
          "Campo B": "DE_5_A_10",
          "Campo C": "CERTEZA",
          "Campo D": "DOR_04",
          "Campo E": "SIM",
          "Comentário livre": "O ônibus atrasa",
        },
        answers_structured: [
          {semanticCode:"TRANSPORT_MODE",label:"Campo A",value:["ONIBUS","CARONA"]},
          {semanticCode:"ACCEPTABLE_FARE_RANGE",label:"Campo B",value:"DE_5_A_10"},
          {semanticCode:"ADOPTION_INTENT",label:"Campo C",value:"CERTEZA"},
          {semanticCode:"MOBILITY_PRIMARY_PAIN",label:"Campo D",value:"DOR_04"},
          {semanticCode:"LAUNCH_PARTICIPATION_INTENT",label:"Campo E",value:"SIM"},
          {semanticCode:null,label:"Comentário livre",value:"O ônibus atrasa"},
        ],
        answers_raw: { "37c53fa3-2587-4466-8664-c074f21342b1": "DOR_04" },
      },
    });
    const original = JSON.stringify(p);
    const result = summarizeCrmParticipation(p);
    expect(result.routine).toContainEqual({label:"Transporte atual",value:"Ônibus, Carona"});
    expect(result.fit).toContainEqual({label:"Orçamento por trecho",value:"De R$ 5,00 a R$ 10,00"});
    expect(result.fit).toContainEqual({label:"Disposição de uso",value:"Com certeza"});
    expect(result.fit).toContainEqual({label:"Alerta de lançamento",value:"Sim"});
    expect(result.primaryPain).toBe("Muito tempo gasto no deslocamento");
    expect(result.otherAnswers).toEqual({"Comentário livre":"O ônibus atrasa"});
    expect(JSON.stringify(p)).toBe(original);
  });

  it("preserves equal-value custom questions and duplicate-label responses", () => {
    const result = summarizeCrmParticipation(sample({
      raw_payload: {
        answers: { "Outros campos": "Sim" },
        answers_structured: [
          {semanticCode:"BOOKING_INTENT",label:"Prepararia a rota?",value:true},
          {semanticCode:"LAUNCH_PARTICIPATION_INTENT",label:"Receber novidades?",value:true},
          {semanticCode:null,label:"Outros campos",value:"Sim"},
          {semanticCode:null,label:"Outros campos",value:"Não"},
        ],
      },
    }));
    expect(result.fit).toContainEqual({label:"Interesse em preparar trajeto",value:"Sim"});
    expect(result.fit).toContainEqual({label:"Alerta de lançamento",value:"Sim"});
    expect(result.otherAnswers).toEqual({"Outros campos":"Sim","Outros campos (2)":"Não"});
  });

  it("keeps unknown custom labels visible and internal UUIDs hidden from normal sections", () => {
    const result = summarizeCrmParticipation(sample({
      raw_payload: {
        answers: {"37c53fa3-2587-4466-8664-c074f21342b1":"DOR_04", "Comentário":"Preciso voltar cedo"},
        answers_structured: [
          {semanticCode:"UNLISTED_CUSTOM_CODE",label:"37c53fa3-2587-4466-8664-c074f21342b1",value:"DOR_04"},
          {semanticCode:"UNLISTED_CUSTOM_CODE",label:"Comentário",value:"Preciso voltar cedo"},
        ],
      },
    }));
    expect(result.otherAnswers).toEqual({"Comentário":"Preciso voltar cedo"});
  });

  it("keeps historic STS primary pains and Pitch notes separate", () => {
    const sts = summarizeCrmParticipation(sample({
      source_type: "STS", pains: ["DOR_04"],
      raw_payload: {
        pain_points: [{codigo_dor:"DOR_04",principal:true}],
        passengerFairPrice:"DE_5_A_10", researchAccepted:true,
      },
    }));
    expect(sts.primaryPain).toBe("Muito tempo gasto no deslocamento");
    expect(sts.fit).toContainEqual({label:"Orçamento por trecho",value:"De R$ 5,00 a R$ 10,00"});
    expect(sts.pains).toHaveLength(0);
    const pitch = summarizeCrmParticipation(sample({
      source_type: "PITCH", route_origin: null, route_destination: null,
      outbound_time: null, pains: [],
      raw_payload: {interest:"INVESTIDOR",message:"Pediu uma reunião"},
    }));
    expect(pitch.routine).toHaveLength(0);
    expect(pitch.fit).toContainEqual({ label:"Interesse", value:"Investidor" });
    expect(pitch.otherAnswers).toEqual({message:"Pediu uma reunião"});
  });

  it("does not infer uncollected details, consent, or the main difficulty", () => {
    const result = summarizeCrmParticipation(sample({
      pains: ["DOR_03"], route_origin: null, route_destination: null,
      outbound_time: null, raw_payload: { answers: { "Observação":"Retorno variado" } },
    }));
    expect(result.primaryPain).toBeNull();
    expect(result.routine).toHaveLength(0);
    expect(result.pains).toEqual(["Preço alto das opções de transporte"]);
    expect(result.otherAnswers).toEqual({ "Observação":"Retorno variado" });
  });
});
