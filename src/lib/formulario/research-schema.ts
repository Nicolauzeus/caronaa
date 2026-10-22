import type { SurveyQuestion, SurveySchema, SurveySection } from "./research-templates";
import { RESEARCH_SEMANTIC_TYPES } from "./research-configuration";
import { createResearchVisibility, inspectResearchCondition } from "./research-conditions";
export const newSurveyQuestion = (): SurveyQuestion => ({
  id: crypto.randomUUID(),
  label: "Nova pergunta",
  type: "short_text",
  required: false,
  options: [],
});
export const emptySurveySchema = (): SurveySchema => ({
  sections: [{ id: crypto.randomUUID(), title: "Primeira seção", questions: [] }],
});
export const reorder = <T>(items: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to)
    return [...items];
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};
export const cloneQuestion = (q: SurveyQuestion): SurveyQuestion => ({
  ...structuredClone(q),
  id: crypto.randomUUID(),
  semanticCode: undefined,
  showWhen: undefined,
});
export function inspectSchema(schema: SurveySchema): string[] {
  const errors: string[] = [];
  if (schema.sections.length === 0) errors.push("Adicione pelo menos uma seção.");
  if (schema.sections.length > 30) errors.push("Limite de 30 seções.");
  const ids = new Set<string>();
  const questionLabels = new Set<string>();
  const prior = new Map<string, SurveyQuestion>();
  let total = 0;
  schema.sections.forEach((s, si) => {
    if (s.condition) errors.push(...inspectResearchCondition(s.condition, prior, "Seção " + (si + 1)));
    if (s.title.trim().length < 2) errors.push("A seção " + (si + 1) + " precisa de título.");
    if (!s.questions.length) errors.push("A seção " + (si + 1) + " está vazia.");
    s.questions.forEach((q, qi) => {
      total++;
      const name = "Seção " + (si + 1) + ", pergunta " + (qi + 1);
      if (ids.has(q.id)) errors.push(name + ": identificador duplicado.");
      ids.add(q.id);
      if (q.label.trim().length < 3) errors.push(name + ": enunciado muito curto.");
      const normalizedLabel = q.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
      if (questionLabels.has(normalizedLabel))
        errors.push(name + ": pergunta repetida. Una as perguntas ou use um enunciado diferente.");
      questionLabels.add(normalizedLabel);
      if (
        q.semanticCode &&
        RESEARCH_SEMANTIC_TYPES[q.semanticCode] &&
        RESEARCH_SEMANTIC_TYPES[q.semanticCode] !== q.type
      )
        errors.push(name + ": a classificação analítica não corresponde ao tipo da pergunta.");
      if (["short_text", "long_text", "location"].includes(q.type)) {
        const limit = q.type === "long_text" ? 2000 : 240;
        const min = q.minLength ?? 0;
        const max = q.maxLength ?? limit;
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 ||
            max < 1 || min > max || max > limit)
          errors.push(name + ": limite de caracteres inválido.");
      }
      if (q.type === "multiple_choice") {
        const min = q.minValue ?? 0;
        const max = q.maxValue ?? q.options.length;
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 ||
            max < 1 || min > max || max > q.options.length)
          errors.push(name + ": limite de alternativas inválido.");
      }
      if (q.type === "number") {
        const bounds = getNumberBounds(q);
        if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.min > bounds.max)
          errors.push(name + ": limites numéricos inválidos.");
      }
      if (
        ["single_choice", "multiple_choice", "ranking", "money_range", "matrix"].includes(q.type)
      ) {
        const options = q.options.map((x) => x.trim()).filter(Boolean);
        if (options.length < 2 || new Set(options).size !== options.length)
          errors.push(name + ": alternativas insuficientes ou duplicadas.");
      }
      if (q.type === "matrix" && (!q.rows || q.rows.length < 1))
        errors.push(name + ": inclua pelo menos uma linha na matriz.");
      if (q.condition) errors.push(...inspectResearchCondition(q.condition, prior, name));
      if (q.showWhen) {
        const parent = prior.get(q.showWhen.questionId);
        if (
          !parent ||
          parent.type !== "single_choice" ||
          !parent.options.includes(q.showWhen.equals)
        )
          errors.push(name + ": a condição deve depender de pergunta anterior de escolha única.");
      }
      prior.set(q.id, q);
    });
  });
  if (total > 200) errors.push("Limite de 200 perguntas.");
  if (total === 0) errors.push("Adicione perguntas antes de publicar.");
  return errors;
}
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;
/** Evaluate the whole dependency chain, not just the last parent.
 * This prevents hidden nested questions from reappearing through stale answers.
 * When allQuestions is omitted, the caller must pass already cleaned answers.
 */
export function isVisible(q: SurveyQuestion, answers: Answers, allQuestions?: SurveyQuestion[]): boolean {
  if (!allQuestions) return !q.showWhen || answers[q.showWhen.questionId] === q.showWhen.equals;
  return createResearchVisibility({sections:[{title:"Condicional",questions:allQuestions}]},answers).questionVisible(q);
}
export function cleanAnswers(schema: SurveySchema, answers: Answers, externalRole?: string | null): Answers {
  const result: Answers = {};
  const visibility = createResearchVisibility(schema, answers, externalRole);
  for (const section of schema.sections)
    for (const q of section.questions)
      if (visibility.questionVisible(q) && answers[q.id] !== undefined &&
        answers[q.id] !== "" && (!Array.isArray(answers[q.id]) || answers[q.id].length))
        result[q.id] = answers[q.id];
  return result;
}
/** Limits are semantic, not based on the translated question label.
 * Fallbacks support previously published schema versions with no min/max metadata.
 */
export function getNumberBounds(q: SurveyQuestion): {
  min: number;
  max: number;
  integerOnly: boolean;
} {
  const id = q.id.toLowerCase();
  const semantic = q.semanticCode?.toUpperCase() ?? "";
  let min = 0,
    max = 1000000,
    integerOnly = false;
  if (
    ["days", "work_days", "frequency"].includes(id) ||
    ["CAMPUS_DAYS", "WORK_DAYS"].includes(semantic)
  ) {
    max = 7;
    integerOnly = true;
  } else if (
    ["time", "wait", "wait_minutes"].includes(id) ||
    ["TRAVEL_TIME", "WAIT_TIME"].includes(semantic)
  ) {
    max = 1440;
    integerOnly = true;
  } else if (id === "cost" || semantic === "COST_PER_TRIP") {
    max = 10000;
  } else if (id === "seats" || semantic === "SEATS_AVAILABLE" || semantic === "EVENT_OFFER_SEATS") {
    max = 7;
    integerOnly = true;
  } else if (id === "group") {
    min = 1;
    max = 50;
    integerOnly = true;
  } else if (id === "population") {
    max = 100000000;
    integerOnly = true;
  }
  return {
    min: q.minValue ?? min,
    max: semantic === "SEATS_AVAILABLE" || semantic === "EVENT_OFFER_SEATS" ? 7 : q.maxValue ?? max,
    integerOnly: q.integerOnly ?? integerOnly,
  };
}
/** Inform without assuming that every arrival/departure happens on the same day. */
export function scheduleWarning(section: SurveySection, answers: Answers): string | null {
  const ids = new Set(section.questions.map((q) => q.id));
  const start = ["arrival", "arrive"].find((id) => ids.has(id));
  const end = ["departure"].find((id) => ids.has(id));
  if (!start || !end) return null;
  const from = answers[start],
    to = answers[end];
  if (typeof from !== "string" || typeof to !== "string") return null;
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!valid.test(from) || !valid.test(to)) return null;
  return to < from
    ? "O horário de saída é anterior ao de chegada. Confirme se a saída é no dia seguinte; caso contrário, revise os horários."
    : null;
}
export function validatePage(section: SurveySection, answers: Answers, allQuestions?: SurveyQuestion[], schema?: SurveySchema, externalRole?: string | null): string[] {
  const visible = createResearchVisibility(schema ?? {sections:[{...section,questions:allQuestions ?? section.questions}]},answers,externalRole);
  return section.questions
    .filter(q => visible.questionVisible(q))
    .flatMap((q) => {
      const value = answers[q.id];
      if (q.required && (!value || (Array.isArray(value) && !value.length)))
        return ["Responda: " + q.label];
      if (value === undefined || value === "") return [];
      if (q.type === "short_text" || q.type === "long_text" || q.type === "location") {
        const length = Array.from(String(value).trim()).length;
        const minLength = q.minLength ?? 0;
        const maxLength = q.maxLength ?? (q.type === "long_text" ? 2000 : 240);
        if (length < minLength)
          return [q.label + ": faltam " + (minLength - length) + " caracteres."];
        if (length > maxLength)
          return [q.label + ": máximo de " + maxLength + " caracteres."];
      }
      if (q.type === "multiple_choice" && Array.isArray(value)) {
        if (q.maxValue !== undefined && value.length > q.maxValue)
          return [q.label + ": escolha no máximo " + q.maxValue + " opções."];
        if (q.minValue !== undefined && value.length < q.minValue)
          return [q.label + ": escolha pelo menos " + q.minValue + " opções."];
      }
      if (q.type === "number") {
        const bounds = getNumberBounds(q);
        const number = Number(value);
        if (Array.isArray(value) || !Number.isFinite(number) || String(value).trim() === "")
          return ["Informe um número válido: " + q.label];
        if (number < bounds.min || number > bounds.max)
          return [q.label + ": informe um valor entre " + bounds.min + " e " + bounds.max + "."];
        if (bounds.integerOnly && !Number.isInteger(number))
          return [q.label + ": informe um número inteiro."];
      }
      if ((q.type === "rating_1_5" || q.type === "rating_stars") && !/^[1-5]$/.test(String(value)))
        return ["Escolha uma nota entre 1 e 5: " + q.label];
      if (q.type === "rating_0_10" && !/^(10|[0-9])$/.test(String(value)))
        return ["Escolha uma nota entre 0 e 10: " + q.label];
      if (q.type === "yes_no" && !["SIM", "NAO"].includes(String(value)))
        return ["Escolha sim ou não: " + q.label];
      if (q.type === "single_choice" && !q.options.includes(String(value)))
        return ["Alternativa inválida: " + q.label];
      if (
        q.type === "multiple_choice" &&
        (!Array.isArray(value) || value.some((x) => !q.options.includes(x)))
      )
        return ["Alternativas inválidas: " + q.label];
      if (q.type === "money_range" && !q.options.includes(String(value)))
        return ["Escolha uma faixa válida: " + q.label];
      if (
        q.type === "ranking" &&
        (!Array.isArray(value) ||
          value.length !== q.options.length ||
          new Set(value).size !== value.length ||
          value.some((x) => !q.options.includes(x)))
      )
        return ["Ordenação incompleta: " + q.label];
      if (
        q.type === "matrix" &&
        (!Array.isArray(value) ||
          value.length !== (q.rows?.length ?? 0) ||
          value.some((x) => {
            const parts = x.split("::");
            return (
              parts.length !== 2 || !q.rows?.includes(parts[0]) || !q.options.includes(parts[1])
            );
          }))
      )
        return ["Complete a matriz: " + q.label];
      if (
        q.type === "contact" &&
        (Array.isArray(value) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ||
          String(value).length > 180)
      )
        return ["E-mail inválido: " + q.label];
      if (q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
        return ["Data inválida: " + q.label];
      if (q.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))
        return ["Horário inválido: " + q.label];
      return [];
    });
}
