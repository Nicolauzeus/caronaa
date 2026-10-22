import { researchRoleQuestion, roleCondition } from "./research-conditions";
import type { ResearchTemplate, SurveySchema, SurveyQuestion } from "./research-templates";
import { URBAN_UNIVERSITY_KEY } from "./urban-university";

/**
 * Fast university survey v1. Legacy published versions and their answers remain
 * intact. Journey schedules are saved separately by the existing verified RPC.
 * Email is saved only through the consented, server-side lead-capture flow.
 */
export const ACADEMIC_EXPRESS_EXPERIENCE = "ACADEMIC_EXPRESS_V1" as const;

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

const passengerOnly = roleCondition("PASSAGEIRO");
const driverOnly = roleCondition("MOTORISTA", "AMBOS");
const driverPriorityOnly = roleCondition("MOTORISTA");

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

export function isAcademicExpress(schema?: SurveySchema | null): boolean {
  return schema?.experience === ACADEMIC_EXPRESS_EXPERIENCE;
}

export type AcademicRole = "PASSAGEIRO" | "MOTORISTA" | "AMBOS";

export function academicExpressSteps(
  _role: AcademicRole | null,
): Array<"identity" | "role" | "route" | "specific" | "activation"> {
  return ["identity", "role", "route", "specific", "activation"];
}
