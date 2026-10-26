import type { SurveyQuestion, SurveySchema, SurveySection } from "./research-templates";

export type ResearchConditionRule = {
  questionId: string;
  comparison: "EQ" | "NEQ" | "INCLUDES" | "ANSWERED";
  value?: string;
};
export type ResearchConditionGroup = {
  op: "ALL" | "ANY";
  rules: ResearchCondition[];
};
export type ResearchCondition = ResearchConditionRule | ResearchConditionGroup;
export type ResearchAnswers = Record<string, string | string[]>;

export const researchRoleQuestion = (allowProfessional = false): SurveyQuestion => ({
  id: "research_participant_role",
  label: "Como pretende participar?",
  type: "single_choice",
  required: true,
  options: allowProfessional
    ? ["PASSAGEIRO", "MOTORISTA", "AMBOS", "PROFISSIONAL"]
    : ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
  semanticCode: "RESEARCH_PARTICIPANT_ROLE",
});

export const roleCondition = (
  ...roles: Array<"PASSAGEIRO" | "MOTORISTA" | "AMBOS" | "PROFISSIONAL">
): ResearchCondition => ({
  op: "ANY",
  rules: roles.map(value => ({
    questionId: "research_participant_role",
    comparison: "EQ" as const,
    value,
  })),
});

export function remapResearchCondition(
  condition: ResearchCondition,
  ids: Map<string, string>,
): ResearchCondition {
  return "rules" in condition
    ? { ...condition, rules: condition.rules.map(rule => remapResearchCondition(rule, ids)) }
    : { ...condition, questionId: ids.get(condition.questionId) ?? condition.questionId };
}

/** Conditions may only depend on earlier questions, also across previous sections. */
export function inspectResearchCondition(
  condition: ResearchCondition,
  prior: Map<string, SurveyQuestion>,
  subject: string,
  depth = 0,
): string[] {
  if (depth > 6) return [subject + ": profundidade máxima de condições excedida."];
  if ("rules" in condition) {
    if (!["ALL", "ANY"].includes(condition.op) || !Array.isArray(condition.rules)
        || condition.rules.length === 0 || condition.rules.length > 10)
      return [subject + ": grupo de condições inválido (1 a 10 regras)."];
    return condition.rules.flatMap(rule => inspectResearchCondition(rule, prior, subject, depth + 1));
  }
  const q = prior.get(condition.questionId);
  if (!q) return [subject + ": condição deve referenciar pergunta anterior."];
  if (!["EQ", "NEQ", "INCLUDES", "ANSWERED"].includes(condition.comparison))
    return [subject + ": operador de condição inválido."];
  if (condition.comparison === "ANSWERED") return [];
  if (typeof condition.value !== "string" || !condition.value)
    return [subject + ": selecione uma resposta na condição."];
  if (condition.comparison === "INCLUDES") {
    return q.type === "multiple_choice" && q.options.includes(condition.value)
      ? [] : [subject + ": CONTAINS requer uma alternativa de múltipla escolha."];
  }
  return (q.type === "single_choice" || q.type === "yes_no" || q.type === "money_range") &&
      (q.type === "yes_no" ? ["SIM", "NAO"].includes(condition.value) : q.options.includes(condition.value))
    ? [] : [subject + ": condição deve usar resposta válida de escolha única."];
}

/** Semantic role gates apply even to old published versions whose initial role
 * was captured in the journey instead of a RESEARCH_PARTICIPANT_ROLE question.
 * Keep this list aligned with the server-side configured-submission guard. */
export const DRIVER_ONLY_RESEARCH_SEMANTICS = new Set([
  "URBAN_OFFER_POSSIBLE", "URBAN_OFFER_VEHICLE", "URBAN_DRIVER_MOTIVATION",
  "REGIONAL_OFFER_POSSIBLE", "REGIONAL_OFFER_VEHICLE",
  "EVENT_OFFER_POSSIBLE", "EVENT_OFFER_VEHICLE", "EVENT_OFFER_SEATS",
  "SEATS_AVAILABLE", "RIDE_OFFER_INTENT", "COMPANY_DRIVES_CAR",
  "COMPANY_DRIVING_FREQUENCY", "COMPANY_MAX_DETOUR", "CORP_DRIVES_CAR", "DRIVER_MONTHLY_COST",
]);

export function resolveResearchParticipantRole(
  schema: SurveySchema, answers: ResearchAnswers, externalRole?: string | null,
): string | null {
  const explicit = schema.sections.flatMap(section => section.questions)
    .find(q => q.semanticCode === "RESEARCH_PARTICIPANT_ROLE");
  if (explicit) {
    const roleAnswer = answers[explicit.id];
    return typeof roleAnswer === "string" ? roleAnswer : null;
  }
  return externalRole ?? null;
}

export function createResearchVisibility(
  schema: SurveySchema, answers: ResearchAnswers, externalRole?: string | null,
) {
  const role = resolveResearchParticipantRole(schema, answers, externalRole);
  const hasRoleChoice = schema.sections.some(section => section.questions.some(
    question => question.semanticCode === "RESEARCH_PARTICIPANT_ROLE"
  )) || externalRole != null;
  const questionMap = new Map<string, SurveyQuestion>();
  const sectionMap = new Map<string, SurveySection>();
  for (const section of schema.sections)
    for (const q of section.questions) {
      questionMap.set(q.id, q);
      sectionMap.set(q.id, section);
    }
  const visiting = new Set<string>();
  function evaluate(condition: ResearchCondition | undefined, depth = 0): boolean {
    if (!condition) return true;
    if (depth > 12) return false;
    if ("rules" in condition)
      return condition.op === "ALL"
        ? condition.rules.length > 0 && condition.rules.every(rule => evaluate(rule, depth + 1))
        : condition.op === "ANY" && condition.rules.some(rule => evaluate(rule, depth + 1));
    const parent = questionMap.get(condition.questionId);
    if (!parent || !visible(parent)) return false;
    const answer = answers[condition.questionId];
    switch (condition.comparison) {
      case "EQ": return typeof answer === "string" && answer === condition.value;
      case "NEQ": return typeof answer === "string" && answer !== "" && answer !== condition.value;
      case "INCLUDES": return Array.isArray(answer) && answer.includes(condition.value ?? "");
      case "ANSWERED": return answer !== undefined && answer !== "" &&
        (!Array.isArray(answer) || answer.length > 0);
      default: return false;
    }
  }
  function visible(q: SurveyQuestion): boolean {
    if (visiting.has(q.id)) return false;
    visiting.add(q.id);
    const section = sectionMap.get(q.id);
    // Fail closed while a role question has not been answered; passenger-only
    // respondents must never see driver-only fields even in published v1/v2.
    const driverQuestion = DRIVER_ONLY_RESEARCH_SEMANTICS.has(q.semanticCode ?? "");
    const correctRole = !driverQuestion || !hasRoleChoice ||
      role === "MOTORISTA" || role === "AMBOS";
    const result = correctRole && evaluate(section?.condition) && evaluate(q.condition) &&
      (!q.showWhen || (
        questionMap.has(q.showWhen.questionId) &&
        visible(questionMap.get(q.showWhen.questionId)!) &&
        answers[q.showWhen.questionId] === q.showWhen.equals
      ));
    visiting.delete(q.id);
    return result;
  }
  return { questionVisible: visible, sectionVisible: (section: SurveySection) =>
    evaluate(section.condition) && section.questions.some(visible) };
}
