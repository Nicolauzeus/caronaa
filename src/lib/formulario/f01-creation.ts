import { newResearchConfiguration, type ResearchConfiguration } from "./research-configuration";
import { F01_UNIVERSITY, F01_STREET, F01_COMPANY } from "./mobility-simple";

export const F01_CREATION_MODELS = [
  { key: F01_UNIVERSITY, nature: "EDUCACAO", title: "Universidade",
    hint: "Estudantes, professores e comunidade acadêmica.", organization: "Universidade" },
  { key: F01_STREET, nature: "MOBILIDADE_LOCAL", title: "Rua e comunidade",
    hint: "Moradores, trabalhadores e transporte na região.", organization: "Comunidade ou bairro" },
  { key: F01_COMPANY, nature: "EMPRESA", title: "Empresa",
    hint: "Funcionários, unidades e trajetos de trabalho.", organization: "Empresa" },
] as const;

export type F01ModelKey = typeof F01_CREATION_MODELS[number]["key"];
export type F01Region = "FORTALEZA_EDSON_QUEIROZ" | "MACICO_BATURITE";

export const F01_REGIONS = [
  { id: "FORTALEZA_EDSON_QUEIROZ", label: "Fortaleza · Edson Queiroz", municipality: "Fortaleza" },
  { id: "MACICO_BATURITE", label: "Maciço de Baturité", municipality: "Maciço de Baturité" },
] as const;

export type F01DraftInput = {
  modelKey: F01ModelKey;
  name: string;
  title: string;
  code: string;
  region: F01Region;
  campus?: string;
  startsOn: string;
  endsOn: string;
  launchOn?: string | null;
};

export function buildF01Draft(input: F01DraftInput): {
  title: string; code: string; nature: string; audience: string; municipality: string;
  templateKey: F01ModelKey; startsOn: string; endsOn: string;
  caronaaPresenceOn: string | null; configuration: ResearchConfiguration;
} {
  const model = F01_CREATION_MODELS.find(value => value.key === input.modelKey);
  const region = F01_REGIONS.find(value => value.id === input.region);
  if (!model || !region) throw new Error("Escolha um modelo e uma região.");
  const name = input.name.trim();
  const title = input.title.trim();
  if (name.length < 2 || title.length < 2)
    throw new Error("Informe o nome da instituição/comunidade e o título da pesquisa.");
  const config = {
    ...newResearchConfiguration(model.key),
    institutionId: input.code.trim().toUpperCase(),
    institutionName: name,
    publicName: title,
    campus: input.campus?.trim() || "",
    region: region.label,
    campaignName: title,
    campaignType: "INSTITUCIONAL" as const,
    acquisitionSource: "FORMULARIO_F01",
    emailCaptureEnabled: true,
    launchDate: input.launchOn || null,
    // Informational only. Registration and travel are independent of answering.
    usagePolicy: "Pesquisa voluntária sobre mobilidade. As respostas são usadas para analisar dificuldades e interesse em caronas; não representam reserva ou oferta de viagem.",
    priceReference: "Carona compartilhada: referência de R$ 6,00 para 11 km rodoviários. O valor individual depende do trecho contratado; esta pesquisa não realiza cobrança.",
    profiles: ["PASSAGEIRO", "MOTORISTA"] as ResearchConfiguration["profiles"],
    modes: ["CARONA"] as ResearchConfiguration["modes"],
    accessPolicy: "PESQUISA_PUBLICA" as const,
    partnershipConfirmed: false,
    partnershipDescription: "",
  };
  return {
    title, code: input.code.trim().toUpperCase(), nature: model.nature,
    audience: "GERAL", municipality: region.municipality,
    templateKey: model.key, startsOn: input.startsOn, endsOn: input.endsOn,
    caronaaPresenceOn: input.launchOn || null, configuration: config,
  };
}
