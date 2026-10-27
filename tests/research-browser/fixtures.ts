import { newResearchConfiguration } from "../../src/lib/formulario/research-configuration";
export const useServerFn = <T>(fn: T) => fn;
export const settings = {
  ...newResearchConfiguration("VISUAL_TEST"),
  institutionId: "INST_TEST",
  institutionName: "Instituição de teste",
  publicName: "Mobilidade da comunidade",
  campus: "Unidade de teste",
  region: "Fortaleza",
  launchDate: "2027-01-10",
  usagePolicy: "Participação voluntária. Responder não cria uma reserva ou contratação.",
  profiles: ["AMBOS" as const],
};
const questionSchema = {
  sections: [
    {
      title: "Sua opinião",
      questions: [
        {
          id: "pay",
          label: "Você pagaria por uma carona neste trajeto?",
          type: "yes_no",
          required: true,
          options: [],
          semanticCode: "WILLINGNESS_TO_PAY",
        },
      ],
    },
  ],
};
export const supabase = {
  from: (name: string) => {
    const chain = {
      select: () => chain,
      ilike: () => chain,
      eq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({
        error: null,
        data:
          name === "research_forms"
            ? {
                id: "11111111-1111-4111-8111-111111111111",
                title: "Pesquisa",
                mobility_configured: true,
              }
            : { id: "22222222-2222-4222-8222-222222222222", schema_json: questionSchema },
      }),
    };
    return chain;
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === "get_research_window_state")
      return { error: null, data: { startsOn: null, endsOn: null, state: "ABERTO" } };
    if (name === "get_public_research_configuration")
      return { error: null, data: { revision: 1, settings } };
    if (name === "register_research_interest")
      return {
        error: null,
        data:
          args.p_profile === "MOTORISTA" ? "DISPONIBILIDADE_REGISTRADA" : "INTERESSE_REGISTRADO",
      };
    if (name === "get_configured_research_summary")
      return {
        error: null,
        data: [
          {
            version_id: "22222222-2222-4222-8222-222222222222",
            version_number: 1,
            semantic_code: "WILLINGNESS_TO_PAY",
            category: "SIM",
            eligible: 20,
            answered: 18,
            total: 12,
          },
          {
            version_id: "22222222-2222-4222-8222-222222222222",
            version_number: 1,
            semantic_code: "WILLINGNESS_TO_PAY",
            category: "NAO",
            eligible: 20,
            answered: 18,
            total: 6,
          },
        ],
      };
    return { error: null, data: true };
  },
};
export const searchLocationsServerFn = async () => ({
  isConfigured: false,
  provider: "catalog",
  suggestions: [],
});
export const getLocationDetailsServerFn = async () => ({
  isConfigured: false,
  provider: "catalog",
  details: null,
});

// Explicit GPS use is optional; browser tests do not request real device coordinates.
export const reverseGeocodeServerFn = async () => null;
