import type { Answers } from "./research-schema";
import type { ResearchTemplate, SurveyQuestion, SurveySchema } from "./research-templates";

/**
 * F01: new forms only. Published legacy schemas do not have this experience
 * marker and must continue using their original UI and answer semantics.
 */
export const MOBILITY_SIMPLE_EXPERIENCE = "MOBILITY_SIMPLE_V1" as const;
export const F01_UNIVERSITY = "F01_UNIVERSIDADE";
export const F01_STREET = "F01_RUA";
export const F01_COMPANY = "F01_EMPRESA";
export const F01_TEMPLATE_KEYS = [F01_UNIVERSITY, F01_STREET, F01_COMPANY] as const;

export const MOBILITY_PAIN_OPTIONS = [
  "LOTACAO", "PRECO_ALTO", "ESPERA_LONGA", "ATRASOS", "INSEGURANCA",
  "SEM_TRANSPORTE", "DESCONFORTO", "HORARIO_INCOMPATIVEL", "OUTRA", "NENHUMA",
] as const;

const painQuestions: SurveyQuestion[] = [
  {
    id: "f01_pains", label: "O que mais dificulta seu deslocamento?",
    type: "multiple_choice", required: true, options: [...MOBILITY_PAIN_OPTIONS],
    minValue: 1, maxValue: 3, semanticCode: "MOBILITY_PAINS",
    helpText: "Escolha até três dificuldades. Se nenhuma se aplica, marque Nenhuma.",
  },
  {
    id: "f01_primary", label: "Qual dessas é a principal dificuldade?",
    type: "single_choice", required: true, options: [...MOBILITY_PAIN_OPTIONS],
    semanticCode: "MOBILITY_PRIMARY_PAIN",
  },
  {
    id: "f01_other", label: "Qual outra dificuldade?", type: "short_text",
    required: true, options: [], minLength: 3, maxLength: 140,
    semanticCode: "MOBILITY_OTHER_PAIN",
    condition: { questionId: "f01_pains", comparison: "INCLUDES", value: "OUTRA" },
  },
];

function template(key: string, nature: string, label: string, affiliationLabel: string, affiliations: string[]): ResearchTemplate {
  return {
    key, nature, label,
    description: "Pesquisa rápida com dores sociais em tela única, trajeto e CRM integrado.",
    estimatedMinutes: 2,
    schema: {
      experience: MOBILITY_SIMPLE_EXPERIENCE,
      sections: [
        {
          id: "f01_identity", title: "Sua comunidade",
          questions: [
            { id: "f01_name", label: "Como podemos chamar você?", type: "short_text",
              required: true, options: [], minLength: 2, maxLength: 80,
              semanticCode: "MOBILITY_PARTICIPANT_NAME" },
            { id: "f01_affiliation", label: affiliationLabel, type: "single_choice",
              required: true, options: affiliations, semanticCode: "MOBILITY_AFFILIATION" },
            { id: "f01_role", label: "Como pretende usar o CARONAA?", type: "single_choice",
              required: true, options: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
              semanticCode: "RESEARCH_PARTICIPANT_ROLE" },
          ],
        },
        {
          id: "f01_social_pains", title: "Seus desafios no deslocamento",
          description: "Suas respostas ajudam a identificar problemas reais de mobilidade.",
          questions: structuredClone(painQuestions),
        },
        {
          id: "f01_routine", title: "Sua rotina",
          questions: [
            { id: "f01_frequency", label: "Com que frequência você se desloca?",
              type: "single_choice", required: true,
              options: ["DIARIAMENTE", "ALGUNS_DIAS", "EVENTUALMENTE"],
              semanticCode: "TRAVEL_FREQUENCY" },
            { id: "f01_adoption", label: "Você experimentaria o CARONAA?",
              type: "single_choice", required: true,
              options: ["SIM", "TALVEZ", "NAO"], semanticCode: "ADOPTION_INTENT" },
          ],
        },
      ],
    },
  };
}

export const simpleMobilityTemplates: ResearchTemplate[] = [
  template(F01_UNIVERSITY, "EDUCACAO", "Universidade · pesquisa simplificada",
    "Qual é seu vínculo com a universidade?", ["ESTUDANTE", "PROFESSOR", "COLABORADOR", "OUTRO"]),
  template(F01_STREET, "MOBILIDADE_LOCAL", "Rua e comunidade · pesquisa simplificada",
    "Como participa da mobilidade local?", ["MORADOR", "TRABALHADOR", "VISITANTE", "OUTRO"]),
  template(F01_COMPANY, "EMPRESA", "Empresa · pesquisa simplificada",
    "Qual é seu vínculo com a empresa?", ["COLABORADOR", "GESTOR", "PRESTADOR", "OUTRO"]),
];

export function isSimpleMobility(schema?: SurveySchema | null): boolean {
  return schema?.experience === MOBILITY_SIMPLE_EXPERIENCE;
}

export function simplePainFields(schema: SurveySchema) {
  const questions = schema.sections.flatMap(section => section.questions);
  return {
    pains: questions.find(q => q.semanticCode === "MOBILITY_PAINS"),
    primary: questions.find(q => q.semanticCode === "MOBILITY_PRIMARY_PAIN"),
    other: questions.find(q => q.semanticCode === "MOBILITY_OTHER_PAIN"),
  };
}

export function normalizeSimplePains(input: string[]): string[] {
  const allowed = new Set<string>(MOBILITY_PAIN_OPTIONS);
  const values = [...new Set(input.filter(value => allowed.has(value)))];
  return values.includes("NENHUMA") ? ["NENHUMA"] : values.slice(0, 3);
}

/** Atomic reducer: the primary pain remains consistent with the selected pains. */
export function applySimplePainAnswer(
  schema: SurveySchema, previous: Answers, id: string, value: string | string[],
): Answers {
  if (!isSimpleMobility(schema)) return { ...previous, [id]: value };
  const { pains, primary, other } = simplePainFields(schema);
  if (!pains || !primary) return { ...previous, [id]: value };
  if (id === pains.id) {
    const selected = normalizeSimplePains(Array.isArray(value) ? value : []);
    const previousMain = previous[primary.id];
    const main = typeof previousMain === "string" && selected.includes(previousMain)
      ? previousMain : selected[0];
    const result: Answers = { ...previous, [id]: selected };
    if (main) result[primary.id] = main;
    else delete result[primary.id];
    if (other && !selected.includes("OUTRA")) delete result[other.id];
    return result;
  }
  if (id === primary.id) {
    const selected = previous[pains.id];
    if (!Array.isArray(selected) || typeof value !== "string" || !selected.includes(value))
      return previous;
  }
  return { ...previous, [id]: value };
}

export function validateSimpleMobilityPains(schema: SurveySchema, answers: Answers): string[] {
  if (!isSimpleMobility(schema)) return [];
  const { pains, primary, other } = simplePainFields(schema);
  if (!pains || !primary) return ["A seção de dores sociais está incompleta."];
  const selected = answers[pains.id];
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 3 ||
      new Set(selected).size !== selected.length ||
      selected.some(value => !pains.options.includes(value)) ||
      (selected.includes("NENHUMA") && selected.length > 1))
    return ["Escolha até três dificuldades ou apenas Nenhuma dessas dificuldades."];
  if (typeof answers[primary.id] !== "string" || !selected.includes(answers[primary.id] as string))
    return ["Escolha a principal dificuldade entre as opções marcadas."];
  if (other && selected.includes("OUTRA") &&
      (typeof answers[other.id] !== "string" || (answers[other.id] as string).trim().length < 3))
    return ["Descreva brevemente a outra dificuldade."];
  return [];
}
