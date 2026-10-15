import type { LocationSuggestion } from "./types";

export interface CatalogLocationEntry {
  id: string;
  aliases: string[];
  mainText: string;
  formattedAddress: string;
  neighborhood?: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  types: string[];
}

export const CEARA_LOCATION_CATALOG: CatalogLocationEntry[] = [
  {
    id: "loc_unifor",
    aliases: [
      "unifor",
      "universidade de fortaleza",
      "campus unifor",
      "unifor hub",
      "edson queiroz unifor",
    ],
    mainText: "Universidade de Fortaleza (UNIFOR)",
    formattedAddress: "Av. Washington Soares, 1321 - Edson Queiroz, Fortaleza - CE, 60811-905",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7698,
    lng: -38.4788,
    types: ["university", "point_of_interest", "establishment"],
  },
  {
    id: "loc_cec",
    aliases: [
      "centro de eventos",
      "centro de eventos do ceará",
      "siara tech summit",
      "sts 2026",
      "evento sts",
    ],
    mainText: "Centro de Eventos do Ceará",
    formattedAddress: "Av. Washington Soares, 999 - Edson Queiroz, Fortaleza - CE, 60811-341",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7638,
    lng: -38.4815,
    types: ["event_venue", "point_of_interest", "establishment"],
  },
  {
    id: "loc_av_washington_soares",
    aliases: [
      "av washington soares",
      "avenida washington soares",
      "washington soares",
      "ce-040 washington soares",
    ],
    mainText: "Avenida Washington Soares",
    formattedAddress: "Av. Washington Soares - Edson Queiroz, Fortaleza - CE",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7745,
    lng: -38.481,
    types: ["route", "transit_station"],
  },
  {
    id: "loc_aldeota",
    aliases: ["aldeota", "bairro aldeota", "praca das flores"],
    mainText: "Aldeota",
    formattedAddress: "Aldeota, Fortaleza - CE",
    neighborhood: "Aldeota",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7383,
    lng: -38.5028,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_meireles",
    aliases: ["meireles", "bairro meireles", "beira mar meireles"],
    mainText: "Meireles",
    formattedAddress: "Meireles, Fortaleza - CE",
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7289,
    lng: -38.4967,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_centro_fortaleza",
    aliases: ["centro", "centro fortaleza", "bairro centro"],
    mainText: "Centro",
    formattedAddress: "Centro, Fortaleza - CE",
    neighborhood: "Centro",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7275,
    lng: -38.5284,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_parangaba",
    aliases: ["parangaba", "terminal parangaba", "lagoa da parangaba"],
    mainText: "Parangaba",
    formattedAddress: "Parangaba, Fortaleza - CE",
    neighborhood: "Parangaba",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7758,
    lng: -38.5639,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_benfica",
    aliases: ["benfica", "ufc benfica", "praca da gentilandia"],
    mainText: "Benfica",
    formattedAddress: "Benfica, Fortaleza - CE",
    neighborhood: "Benfica",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7431,
    lng: -38.5375,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_papicu",
    aliases: ["papicu", "terminal papicu", "shopping riomar papicu"],
    mainText: "Papicu",
    formattedAddress: "Papicu, Fortaleza - CE",
    neighborhood: "Papicu",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7428,
    lng: -38.4784,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_messejana",
    aliases: ["messejana", "terminal messejana", "lagoa de messejana"],
    mainText: "Messejana",
    formattedAddress: "Messejana, Fortaleza - CE",
    neighborhood: "Messejana",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.8306,
    lng: -38.4981,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_maracanau_centro",
    aliases: ["maracanau", "maracanaú", "centro maracanau", "municipio maracanau"],
    mainText: "Maracanaú",
    formattedAddress: "Centro, Maracanaú - CE",
    neighborhood: "Centro",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8767,
    lng: -38.6256,
    types: ["locality", "political"],
  },
  {
    id: "loc_maracanau_pajucara",
    aliases: ["pajucara", "pajuçara", "pajucara maracanau", "bairro pajucara"],
    mainText: "Pajuçara (Maracanaú)",
    formattedAddress: "Pajuçara, Maracanaú - CE",
    neighborhood: "Pajuçara",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8569,
    lng: -38.5997,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_caucaia",
    aliases: ["caucaia", "municipio caucaia", "centro caucaia"],
    mainText: "Caucaia",
    formattedAddress: "Centro, Caucaia - CE",
    neighborhood: "Centro",
    city: "Caucaia",
    state: "CE",
    country: "Brasil",
    lat: -3.7364,
    lng: -38.6531,
    types: ["locality", "political"],
  },
  {
    id: "loc_eusebio",
    aliases: ["eusebio", "eusébio", "municipio eusebio"],
    mainText: "Eusébio",
    formattedAddress: "Centro, Eusébio - CE",
    neighborhood: "Centro",
    city: "Eusébio",
    state: "CE",
    country: "Brasil",
    lat: -3.8911,
    lng: -38.4556,
    types: ["locality", "political"],
  },
  {
    id: "loc_rodovia_ce_040",
    aliases: ["rodovia ce-040", "ce-040", "estrada ce-040"],
    mainText: "Rodovia CE-040",
    formattedAddress: "Rodovia CE-040, Ceará - Brasil",
    // Intencionalmente sem bairro para casos de rodovias isoladas
    city: "Aquiraz",
    state: "CE",
    country: "Brasil",
    lat: -3.9056,
    lng: -38.3842,
    types: ["route"],
  },
  {
    id: "loc_parque_manibura",
    aliases: ["parque manibura", "manibura", "bairro parque manibura"],
    mainText: "Parque Manibura",
    formattedAddress: "Parque Manibura, Fortaleza - CE",
    neighborhood: "Parque Manibura",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7915,
    lng: -38.4882,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_parquelandia",
    aliases: ["parquelandia", "parquelândia", "bairro parquelandia"],
    mainText: "Parquelândia",
    formattedAddress: "Parquelândia, Fortaleza - CE",
    neighborhood: "Parquelândia",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7369,
    lng: -38.5574,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_parque_iracema",
    aliases: ["parque iracema", "bairro parque iracema"],
    mainText: "Parque Iracema",
    formattedAddress: "Parque Iracema, Fortaleza - CE",
    neighborhood: "Parque Iracema",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7995,
    lng: -38.4984,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_cidade_dos_funcionarios",
    aliases: [
      "cidade dos funcionarios",
      "cidade dos funcionários",
      "bairro cidade dos funcionarios",
    ],
    mainText: "Cidade dos Funcionários",
    formattedAddress: "Cidade dos Funcionários, Fortaleza - CE",
    neighborhood: "Cidade dos Funcionários",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7954,
    lng: -38.4989,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_cambeba",
    aliases: ["cambeba", "centro administrativo cambeba", "bairro cambeba"],
    mainText: "Cambeba",
    formattedAddress: "Cambeba, Fortaleza - CE",
    neighborhood: "Cambeba",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.8078,
    lng: -38.4847,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_passare",
    aliases: ["passare", "passaré", "castelao passare", "banco do nordeste passare"],
    mainText: "Passaré",
    formattedAddress: "Passaré, Fortaleza - CE",
    neighborhood: "Passaré",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.8117,
    lng: -38.5284,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_sapiranga",
    aliases: ["sapiranga", "bairro sapiranga", "sapiranga coite"],
    mainText: "Sapiranga",
    formattedAddress: "Sapiranga, Fortaleza - CE",
    neighborhood: "Sapiranga",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7842,
    lng: -38.4682,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_luciano_cavalcante",
    aliases: ["luciano cavalcante", "eng luciano cavalcante", "bairro luciano cavalcante"],
    mainText: "Engenheiro Luciano Cavalcante",
    formattedAddress: "Engenheiro Luciano Cavalcante, Fortaleza - CE",
    neighborhood: "Engenheiro Luciano Cavalcante",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7667,
    lng: -38.4947,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_coco",
    aliases: ["coco", "cocó", "parque do coco", "bairro coco"],
    mainText: "Cocó",
    formattedAddress: "Cocó, Fortaleza - CE",
    neighborhood: "Cocó",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7495,
    lng: -38.4795,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_varjota",
    aliases: ["varjota", "polo gastronomico varjota", "bairro varjota"],
    mainText: "Varjota",
    formattedAddress: "Varjota, Fortaleza - CE",
    neighborhood: "Varjota",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7314,
    lng: -38.4878,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_praia_de_iracema",
    aliases: ["praia de iracema", "dragao do mar", "aterro da praia de iracema"],
    mainText: "Praia de Iracema",
    formattedAddress: "Praia de Iracema, Fortaleza - CE",
    neighborhood: "Praia de Iracema",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7197,
    lng: -38.5146,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_osvaldo_risato",
    aliases: ["osvaldo risato", "rua osvaldo risato", "osvaldo rizato", "bairro osvaldo risato"],
    mainText: "Rua Osvaldo Risato",
    formattedAddress: "Rua Osvaldo Risato, Jardim Bandeirante, Maracanaú - CE, 61934-090",
    neighborhood: "Jardim Bandeirante",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8755,
    lng: -38.591,
    types: ["route", "street_address"],
  },
  {
    id: "loc_jardim_bandeirante",
    aliases: ["jardim bandeirante", "bairro jardim bandeirante", "bandeirante maracanau"],
    mainText: "Jardim Bandeirante",
    formattedAddress: "Jardim Bandeirante, Maracanaú - CE",
    neighborhood: "Jardim Bandeirante",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8771,
    lng: -38.5916,
    types: ["sublocality", "neighborhood", "political"],
  },
  {
    id: "loc_coco_bambu",
    aliases: ["coco bambu", "restaurante coco bambu", "coco bambu meireles"],
    mainText: "Coco Bambu",
    formattedAddress: "Rua Canuto de Aguiar, 1317 - Meireles, Fortaleza - CE, 60160-120",
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7319,
    lng: -38.4909,
    types: ["restaurant", "food", "point_of_interest"],
  },
  {
    id: "loc_coco_bambu_beira_mar",
    aliases: ["coco bambu beira mar", "coco bambu beiramar"],
    mainText: "Coco Bambu Beira Mar",
    formattedAddress: "Av. Beira Mar, 3698 - Meireles, Fortaleza - CE, 60165-121",
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7236,
    lng: -38.4875,
    types: ["restaurant", "food", "point_of_interest"],
  },
  {
    id: "loc_picanha_do_jonas",
    aliases: ["picanha do jonas", "restaurante picanha do jonas"],
    mainText: "Picanha do Jonas",
    formattedAddress: "Rua Graciliano Ramos, 420 - Fátima, Fortaleza - CE, 60411-230",
    neighborhood: "Fátima",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7552,
    lng: -38.5273,
    types: ["restaurant", "food", "point_of_interest"],
  },
  {
    id: "loc_atacadao_maracanau",
    aliases: [
      "atacadao maracanau",
      "atacadao maracanaú",
      "atacadão maracanaú",
      "atacadao",
      "atacadão",
      "atacadao mendel steinbruch",
    ],
    mainText: "Atacadão Maracanaú",
    formattedAddress:
      "Rod. Dr. Mendel Steinbruch, 5800 - Distrito Industrial I, Maracanaú - CE, 61939-000",
    neighborhood: "Distrito Industrial I",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8647,
    lng: -38.6011,
    types: ["supermarket", "point_of_interest", "establishment"],
  },
  {
    id: "loc_assai_maracanau",
    aliases: ["assai maracanau", "assaí maracanau", "assai atacadista maracanau", "assai", "assaí"],
    mainText: "Assaí Atacadista Maracanaú",
    formattedAddress: "Av. Radialista João Ramos, 400 - Distrito Industrial I, Maracanaú - CE",
    neighborhood: "Distrito Industrial I",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8692,
    lng: -38.6042,
    types: ["supermarket", "point_of_interest", "establishment"],
  },
  {
    id: "loc_north_shopping_maracanau",
    aliases: ["north shopping maracanau", "shopping maracanau"],
    mainText: "North Shopping Maracanaú",
    formattedAddress: "Av. Carlos Jereissati, 100 - Centro, Maracanaú - CE, 61900-010",
    neighborhood: "Centro",
    city: "Maracanaú",
    state: "CE",
    country: "Brasil",
    lat: -3.8725,
    lng: -38.6253,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_atacadao_washington_soares",
    aliases: ["atacadao washington soares", "atacadao fortaleza", "atacadao cambeba"],
    mainText: "Atacadão Washington Soares",
    formattedAddress: "Av. Washington Soares, 4200 - Cambeba, Fortaleza - CE, 60822-142",
    neighborhood: "Cambeba",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7997,
    lng: -38.4842,
    types: ["supermarket", "point_of_interest", "establishment"],
  },
  {
    id: "loc_assai_washington_soares",
    aliases: ["assai washington soares", "assai edson queiroz"],
    mainText: "Assaí Atacadista Washington Soares",
    formattedAddress: "Av. Washington Soares, 3500 - Edson Queiroz, Fortaleza - CE",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7885,
    lng: -38.4845,
    types: ["supermarket", "point_of_interest", "establishment"],
  },
  {
    id: "loc_shopping_iguatemi",
    aliases: ["iguatemi", "shopping iguatemi", "iguatemi bosque"],
    mainText: "Shopping Iguatemi Bosque",
    formattedAddress: "Av. Washington Soares, 85 - Edson Queiroz, Fortaleza - CE",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7548,
    lng: -38.4908,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_riomar_fortaleza",
    aliases: ["riomar", "shopping riomar", "riomar papicu", "riomar fortaleza"],
    mainText: "RioMar Fortaleza",
    formattedAddress: "Rua Des. Lauro Nogueira, 1500 - Papicu, Fortaleza - CE",
    neighborhood: "Papicu",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7431,
    lng: -38.4735,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_riomar_kennedy",
    aliases: ["riomar kennedy", "shopping riomar kennedy"],
    mainText: "RioMar Kennedy",
    formattedAddress: "Av. Sgto. Hermínio Sampaio, 3100 - Pres. Kennedy, Fortaleza - CE",
    neighborhood: "Presidente Kennedy",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7317,
    lng: -38.5661,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_north_shopping_fortaleza",
    aliases: ["north shopping", "north shopping bezerra", "north shopping fortaleza"],
    mainText: "North Shopping Fortaleza",
    formattedAddress: "Av. Bezerra de Menezes, 2450 - Pres. Kennedy, Fortaleza - CE",
    neighborhood: "Presidente Kennedy",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7351,
    lng: -38.5654,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_shopping_parangaba",
    aliases: ["shopping parangaba", "parangaba shopping"],
    mainText: "Shopping Parangaba",
    formattedAddress: "Rua Germano Franck, 300 - Parangaba, Fortaleza - CE",
    neighborhood: "Parangaba",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7747,
    lng: -38.5638,
    types: ["shopping_mall", "point_of_interest", "establishment"],
  },
  {
    id: "loc_terminal_parangaba",
    aliases: ["terminal parangaba", "metro parangaba"],
    mainText: "Terminal da Parangaba",
    formattedAddress: "Av. Dr. Silas Munguba, 100 - Parangaba, Fortaleza - CE",
    neighborhood: "Parangaba",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7745,
    lng: -38.5629,
    types: ["transit_station", "point_of_interest"],
  },
  {
    id: "loc_terminal_papicu",
    aliases: ["terminal papicu", "metro papicu"],
    mainText: "Terminal do Papicu",
    formattedAddress: "Rua Pereira de Miranda, 80 - Papicu, Fortaleza - CE",
    neighborhood: "Papicu",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7424,
    lng: -38.4795,
    types: ["transit_station", "point_of_interest"],
  },
  {
    id: "loc_terminal_antonio_bezerra",
    aliases: ["terminal antonio bezerra", "antonio bezerra terminal"],
    mainText: "Terminal Antônio Bezerra",
    formattedAddress: "Av. Cel. Carvalho, 3780 - Antônio Bezerra, Fortaleza - CE",
    neighborhood: "Antônio Bezerra",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7389,
    lng: -38.5912,
    types: ["transit_station", "point_of_interest"],
  },
  {
    id: "loc_barraca_do_brasil",
    aliases: ["barraca do brasil", "barraca brasil", "barraca do brasil beira mar"],
    mainText: "Barraca do Brasil",
    formattedAddress: "Av. Beira Mar, 2535 - Meireles, Fortaleza - CE",
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.725,
    lng: -38.4988,
    types: ["restaurant", "food", "point_of_interest"],
  },
  {
    id: "loc_crocobeach",
    aliases: ["crocobeach", "barraca crocobeach", "praia do futuro crocobeach"],
    mainText: "Crocobeach",
    formattedAddress: "Av. Clóvis Arrais Maia, 3125 - Praia do Futuro, Fortaleza - CE",
    neighborhood: "Praia do Futuro",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7381,
    lng: -38.4485,
    types: ["restaurant", "food", "point_of_interest"],
  },
  {
    id: "loc_chico_do_caranguejo",
    aliases: ["chico do caranguejo", "barraca chico do caranguejo"],
    mainText: "Chico do Caranguejo",
    formattedAddress: "Av. Clóvis Arrais Maia, 4930 - Praia do Futuro, Fortaleza - CE",
    neighborhood: "Praia do Futuro",
    city: "Fortaleza",
    state: "CE",
    country: "Brasil",
    lat: -3.7511,
    lng: -38.4358,
    types: ["restaurant", "food", "point_of_interest"],
  },
];

export function searchCatalogLocations(query: string): LocationSuggestion[] {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized || normalized.length < 2) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);

  // Se o usuário digitou um endereço residencial livre e específico (com número ou vírgula),
  // não força sobreposição de bairro genérico.
  const isSpecificAddress =
    normalized.includes(",") ||
    /\b\d{1,5}\b/.test(normalized) ||
    normalized.startsWith("rua ") ||
    normalized.startsWith("av ") ||
    normalized.startsWith("avenida ");

  interface ScoredEntry {
    entry: CatalogLocationEntry;
    score: number;
  }

  const scored: ScoredEntry[] = [];

  for (const entry of CEARA_LOCATION_CATALOG) {
    const mainNorm = entry.mainText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const normAliases = entry.aliases.map((a) =>
      a
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    );

    let matchScore = 0;

    // 1. Algum alias contém a query inteira (ex: "atacadao maracanau", "unifor")
    const matchingAlias = normAliases.find((a) => a.includes(normalized));
    if (matchingAlias) {
      matchScore = 100;
      if (matchingAlias === normalized) matchScore += 50;
    } else if (mainNorm.includes(normalized)) {
      matchScore = 90;
      if (mainNorm === normalized) matchScore += 50;
    } else if (
      entry.neighborhood &&
      entry.neighborhood
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(normalized)
    ) {
      matchScore = 70;
    } else if (
      entry.city
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(normalized)
    ) {
      matchScore = 60;
    } else if (!isSpecificAddress && tokens.length >= 2) {
      // Para múltiplos tokens (ex: "atacadao maracanau"), verifica se o catálogo contém os termos
      const haystack = [...normAliases, mainNorm, entry.neighborhood || "", entry.city]
        .join(" ")
        .toLowerCase();

      const allTokensMatch = tokens.every((t) => haystack.includes(t));
      if (allTokensMatch) {
        matchScore = 80;
      }
    }

    // Se for um endereço residencial livre específico, não deixa bairros genéricos se sobreporem
    if (
      isSpecificAddress &&
      matchScore > 0 &&
      !normAliases.some((a) => normalized.includes(a) && a.length >= 8) &&
      !mainNorm.includes(normalized) &&
      !normalized.includes(mainNorm)
    ) {
      matchScore = 0;
    }

    if (matchScore > 0) {
      scored.push({ entry, score: matchScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map(({ entry }) => ({
    providerId: entry.id,
    mainText: entry.mainText,
    secondaryText: [entry.neighborhood, `${entry.city} - ${entry.state}`]
      .filter(Boolean)
      .join(", "),
    formattedAddress: entry.formattedAddress,
    neighborhood: entry.neighborhood,
    city: entry.city,
    state: entry.state,
    country: entry.country,
    lat: entry.lat,
    lng: entry.lng,
    types: entry.types,
  }));
}

export function findCatalogLocationById(id: string): LocationSuggestion | null {
  const found = CEARA_LOCATION_CATALOG.find((e) => e.id === id);
  if (!found) return null;

  return {
    providerId: found.id,
    mainText: found.mainText,
    secondaryText: [found.neighborhood, `${found.city} - ${found.state}`]
      .filter(Boolean)
      .join(", "),
    formattedAddress: found.formattedAddress,
    neighborhood: found.neighborhood,
    city: found.city,
    state: found.state,
    country: found.country,
    lat: found.lat,
    lng: found.lng,
    types: found.types,
  };
}
