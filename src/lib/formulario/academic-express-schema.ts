import { researchRoleQuestion, roleCondition } from "./research-conditions";
import type { ResearchTemplate, SurveySchema, SurveyQuestion } from "./research-templates";
import { URBAN_UNIVERSITY_KEY } from "./urban-university";
import { MOBILITY_PAIN_OPTIONS } from "./mobility-simple";

/**
 * Fast university survey v1. Legacy published versions and their answers remain
 * intact. Journey schedules are saved separately by the existing verified RPC.
 * Email is saved only through the consented, server-side lead-capture flow.
 */
export const ACADEMIC_EXPRESS_EXPERIENCE = "ACADEMIC_EXPRESS_V1" as const;
export const ACADEMIC_EXPRESS_F01_EXPERIENCE = "ACADEMIC_EXPRESS_F01_V2" as const;

const common = [
  {
    id: "academic_full_name",
    label: "Como podemos chamar você?",
    type: "short_text",
    required: true,
    options: [],
    minLength: 2,
    maxLength: 80,
    semanticCode: "ACADEMIC_PARTICIPANT_NAME",
  },
  {
    id: "academic_affiliation",
    label: "Qual é seu vínculo com a universidade?",
    type: "single_choice",
    required: true,
    options: [
      "ESTUDANTE",
      "ESTUDANTE_TRABALHADOR",
      "PROFESSOR",
      "COLABORADOR",
      "TERCEIRIZADO",
      "OUTRO",
    ],
    semanticCode: "ACADEMIC_ROLE",
  },
  researchRoleQuestion(false),
] satisfies SurveyQuestion[];

const passengerOnly = roleCondition("PASSAGEIRO", "AMBOS");
const driverOnly = roleCondition("MOTORISTA", "AMBOS");
const driverPriorityOnly = roleCondition("MOTORISTA", "AMBOS");

export const academicExpressUrbanSchema: SurveySchema = {
  experience: ACADEMIC_EXPRESS_EXPERIENCE,
  sections: [
    { id: "academic_identity", title: "Sua comunidade", questions: common },
    {
      id: "academic_passenger",
      title: "Sua experiência como passageiro",
      questions: [
        {
          id: "academic_transport",
          label: "Como você costuma se deslocar?",
          type: "multiple_choice",
          required: true,
          options: [
            "ONIBUS",
            "APLICATIVO",
            "CARONA",
            "CARRO",
            "MOTO",
            "BICICLETA",
            "A_PE",
            "OUTRO",
          ],
          minValue: 1,
          maxValue: 1,
          semanticCode: "TRANSPORT_MODE",
          condition: passengerOnly,
        },
        {
          id: "academic_passenger_priority",
          label: "O que é indispensável para pegar uma carona?",
          type: "single_choice",
          required: true,
          options: ["PREFERENCIA_MULHERES", "PONTO_NO_CAMPUS", "PERFIL_VERIFICADO", "ECONOMIA"],
          semanticCode: "ACADEMIC_PASSENGER_PRIORITY",
          condition: passengerOnly,
        },
      ],
    },
    {
      id: "academic_driver",
      title: "Sua disponibilidade como motorista",
      questions: [
        {
          id: "academic_vehicle",
          label: "Qual veículo usaria para oferecer carona?",
          type: "single_choice",
          required: true,
          options: ["CARRO", "MOTO"],
          semanticCode: "URBAN_OFFER_VEHICLE",
          condition: driverOnly,
        },
        {
          id: "academic_vehicle_model",
          label: "Marca e modelo do veículo (opcional)",
          type: "short_text",
          required: false,
          options: [],
          maxLength: 80,
          semanticCode: "ACADEMIC_VEHICLE_MODEL",
          condition: driverOnly,
        },
        {
          id: "academic_seats",
          label: "Quantas vagas livres para passageiros?",
          type: "number",
          required: true,
          options: [],
          minValue: 1,
          maxValue: 7,
          integerOnly: true,
          semanticCode: "SEATS_AVAILABLE",
          condition: driverOnly,
        },
        {
          id: "academic_driver_priority",
          label: "O que lhe daria mais tranquilidade ao dirigir?",
          type: "single_choice",
          required: true,
          options: ["SEM_DESVIOS", "PAGAMENTO_VERIFICADO", "MESMA_UNIVERSIDADE"],
          semanticCode: "ACADEMIC_DRIVER_PRIORITY",
          condition: driverPriorityOnly,
        },
      ],
    },
  ],
};

export const academicExpressUrbanTemplate: ResearchTemplate = {
  key: URBAN_UNIVERSITY_KEY,
  nature: "EDUCACAO",
  label: "Universidade urbana · Experiência rápida",
  description: "Pesquisa universitária em cinco telas rápidas, com rota e escolhas por perfil",
  estimatedMinutes: 1,
  schema: academicExpressUrbanSchema,
};

/** F01 v2 adds social pains. Published academic V1 data and schemas remain unchanged. */
const f01Sections = structuredClone(academicExpressUrbanSchema.sections);
// V2 asks only the essential profile questions. Keep V1 intact for historical answers.
for (const section of f01Sections) {
  section.questions = section.questions.filter(question => ![
    "TRANSPORT_MODE", "ACADEMIC_VEHICLE_MODEL", "ACADEMIC_DRIVER_PRIORITY",
  ].includes(question.semanticCode ?? ""));
}
for (const question of f01Sections.flatMap(section => section.questions)) {
  if (question.semanticCode === "ACADEMIC_ROLE")
    question.options = ["ESTUDANTE", "PROFESSOR", "COLABORADOR", "OUTRO"];
  // Asking about bus crowding and fares has no meaning to someone who only offers rides.
  // Only PASSAGEIRO/AMBOS can see and answer pain questions.

  // No transport, spending, vehicle-model or generic driver-motivation questions
  // are required in the express flow. V2 is semantically versioned.
}
export const academicExpressF01Schema: SurveySchema = {
  experience: ACADEMIC_EXPRESS_F01_EXPERIENCE,
  sections: [
    ...f01Sections,
    {
      id: "academic_social_pains",
      title: "Seus desafios no deslocamento",
      description: "Uma única pergunta para entender as dificuldades reais da sua comunidade.",
      questions: [
        {
          id: "academic_pains", label: "O que mais dificulta seu deslocamento?",
          type: "multiple_choice", required: true, options: [...MOBILITY_PAIN_OPTIONS],
          minValue: 1, maxValue: 3, semanticCode: "MOBILITY_PAINS",
          condition: roleCondition("PASSAGEIRO", "AMBOS"),
        },
        {
          id: "academic_primary_pain", label: "Qual dificuldade é a principal?",
          type: "single_choice", required: true, options: [...MOBILITY_PAIN_OPTIONS],
          semanticCode: "MOBILITY_PRIMARY_PAIN",
          condition: roleCondition("PASSAGEIRO", "AMBOS"),
        },
        {
          id: "academic_other_pain", label: "Descreva brevemente a outra dificuldade",
          type: "short_text", required: true, options: [], minLength: 3, maxLength: 140,
          semanticCode: "MOBILITY_OTHER_PAIN",
          condition: { questionId: "academic_pains", comparison: "INCLUDES", value: "OUTRA" },
        },
      ],
    },
  ],
};
export const academicExpressF01Template: ResearchTemplate = {
  key: "F01_UNIVERSIDADE_EXPRESSA",
  nature: "EDUCACAO",
  label: "Universidade · Expressa F01 (5 etapas)",
  description: "Perfil, rotina e dificuldades sociais em cinco etapas, sem repetir perguntas.",
  estimatedMinutes: 1,
  schema: academicExpressF01Schema,
};
export function isAcademicExpressF01(schema?: SurveySchema | null): boolean {
  return schema?.experience === ACADEMIC_EXPRESS_F01_EXPERIENCE;
}
export function isAcademicExpress(schema?: SurveySchema | null): boolean {
  return schema?.experience === ACADEMIC_EXPRESS_EXPERIENCE || isAcademicExpressF01(schema);
}

/** Calendar-day countdown in the configured community timezone, not the device timezone. */
export function daysUntilCommunityLaunch(date: string | null, timezone: string, now = new Date()): number | null {
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(item => item.type === type)?.value);
  const currentDay = Date.UTC(part("year"), part("month") - 1, part("day"));
  const launchDay = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(launchDay) ? Math.max(0, Math.round((launchDay - currentDay) / 86_400_000)) : null;
}

export type AcademicRole = "PASSAGEIRO" | "MOTORISTA" | "AMBOS";

export function academicExpressSteps(
  _role: AcademicRole | null,
): Array<"identity" | "role" | "route" | "specific" | "activation"> {
  return ["identity", "role", "route", "specific", "activation"];
}
