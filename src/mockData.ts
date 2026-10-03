import rafael from "@/assets/driver-rafael.jpg";
import marina from "@/assets/driver-marina.jpg";
import lucas from "@/assets/driver-lucas.jpg";

export type Ride = {
  id: number;
  driver: string;
  photo: string;
  rating: string;
  reviews: number;
  origin: string;
  destination: string;
  date: string;
  time: string;
  arrival: string;
  seats: number;
  price: number;
  vehicle: string;
  meeting: string;
  type: "Urbana" | "Intermunicipal";
};

export const currentUser = {
  name: "Ana Beatriz",
  firstName: "Ana",
  city: "Fortaleza, CE",
  photo: marina,
  rating: "4,9",
  rides: 12,
  joined: "Março de 2026",
};

export const rides: Ride[] = [
  { id: 1, driver: "Rafael Oliveira", photo: rafael, rating: "4,9", reviews: 42, origin: "Aldeota", destination: "Meireles", date: "Hoje, 03 out", time: "07:30", arrival: "08:05", seats: 2, price: 8, vehicle: "Honda Fit · Prata", meeting: "Praça Portugal", type: "Urbana" },
  { id: 2, driver: "Marina Costa", photo: marina, rating: "5,0", reviews: 28, origin: "Fortaleza", destination: "Eusébio", date: "Hoje, 03 out", time: "08:15", arrival: "09:00", seats: 3, price: 15, vehicle: "Hyundai HB20 · Branco", meeting: "Shopping Iguatemi Bosque", type: "Intermunicipal" },
  { id: 3, driver: "Lucas Ferreira", photo: lucas, rating: "4,8", reviews: 36, origin: "Benfica", destination: "Centro", date: "Amanhã, 04 out", time: "09:00", arrival: "09:30", seats: 1, price: 7, vehicle: "Chevrolet Onix · Azul", meeting: "Praça da Gentilândia", type: "Urbana" },
  { id: 4, driver: "Rafael Oliveira", photo: rafael, rating: "4,9", reviews: 42, origin: "Fortaleza", destination: "Aquiraz", date: "Amanhã, 04 out", time: "10:30", arrival: "11:25", seats: 2, price: 20, vehicle: "Honda Fit · Prata", meeting: "Terminal Papicu", type: "Intermunicipal" },
];

export const myPassengerRides = [
  { id: 101, origin: "Aldeota", destination: "Meireles", date: "Hoje, 03 out", time: "07:30", driver: "Rafael Oliveira", status: "Confirmada", photo: rafael },
  { id: 102, origin: "Fortaleza", destination: "Eusébio", date: "Amanhã, 04 out", time: "08:15", driver: "Marina Costa", status: "Aguardando", photo: marina },
];

export const myDriverRides = [
  { id: 201, origin: "Benfica", destination: "Centro", date: "Seg, 05 out", time: "08:00", driver: "Você está dirigindo", status: "Publicada", photo: marina },
];

export const rideService = {
  list: () => rides,
  findById: (id: number) => rides.find((ride) => ride.id === id),
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  profile: "Motorista" | "Passageiro" | "Os dois";
  verification: "Verificado" | "Pendente" | "Em revisão";
  status: "Ativo" | "Bloqueado" | "Novo";
  joinedAt: string;
  lastActive: string;
  avatar: string;
  ridesOffered: number;
  ridesTaken: number;
  reputation: number;
};

export type AdminResponse = {
  id: string;
  participant: string;
  profile: "Motorista" | "Passageiro" | "Os dois";
  city: string;
  source: "STS2026" | "UNIFOR" | "Instagram" | "QR Code" | "Direct";
  contact: string;
  submittedAt: string;
  status: "Nova" | "Em análise" | "Aprovada" | "Revisão";
  answers: Record<string, string | string[]>;
};

export const adminOverview = {
  metrics: [
    { label: "Usuários", value: "1.284", detail: "+12% vs. período anterior", trend: "+12%" },
    { label: "Caronas", value: "364", detail: "+7% vs. período anterior", trend: "+7%" },
    { label: "Matches", value: "493", detail: "82% aceitos", trend: "+18%" },
    { label: "Respostas", value: "811", detail: "37 hoje", trend: "+9%" },
  ],
  funnel: [
    { stage: "Cadastros", value: "1.284" },
    { stage: "Perfil completo", value: "912" },
    { stage: "Oferta/Demanda", value: "472" },
    { stage: "Matches", value: "302" },
    { stage: "Solicitações", value: "186" },
    { stage: "Aceites", value: "128" },
    { stage: "Caronas realizadas", value: "96" },
  ],
  activity: [
    { title: "João criou uma carona", time: "18:32" },
    { title: "Maria solicitou uma vaga", time: "18:29" },
    { title: "Match encontrado", time: "18:21" },
    { title: "Usuário cadastrado", time: "18:04" },
    { title: "Formulário STS recebido", time: "17:55" },
  ],
  pending: [
    { title: "8 revisões", detail: "Perfis em análise" },
    { title: "3 incidentes", detail: "2 em investigação" },
    { title: "12 perfis incompletos", detail: "Dados pendentes" },
  ],
  quickActions: [
    { label: "Ver novos usuários", to: "/admin/usuarios?status=novo" },
    { label: "Ver solicitações pendentes", to: "/admin/solicitacoes?status=pending" },
    { label: "Ver respostas recentes", to: "/admin/formularios/respostas" },
    { label: "Exportar respostas", to: "/admin/formularios/respostas" },
  ],
};

export const adminUsers: AdminUser[] = [
  {
    id: "usr-1042",
    name: "Nicolau Pereira",
    email: "nicolau@caronaa.app",
    phone: "+55 (85) 98888-1212",
    city: "Fortaleza",
    profile: "Os dois",
    verification: "Verificado",
    status: "Ativo",
    joinedAt: "2026-01-18",
    lastActive: "Hoje, 08:12",
    avatar: marina,
    ridesOffered: 15,
    ridesTaken: 9,
    reputation: 4.9,
  },
  {
    id: "usr-1150",
    name: "Larissa Costa",
    email: "larissa.costa@email.com",
    phone: "+55 (85) 99112-2244",
    city: "Maracanaú",
    profile: "Passageiro",
    verification: "Pendente",
    status: "Novo",
    joinedAt: "2026-02-02",
    lastActive: "Ontem, 22:41",
    avatar: lucas,
    ridesOffered: 0,
    ridesTaken: 3,
    reputation: 4.7,
  },
  {
    id: "usr-1186",
    name: "Rafael Oliveira",
    email: "rafael.oliveira@gmail.com",
    phone: "+55 (85) 98344-1002",
    city: "Aldeota",
    profile: "Motorista",
    verification: "Verificado",
    status: "Ativo",
    joinedAt: "2025-11-28",
    lastActive: "Hoje, 07:40",
    avatar: rafael,
    ridesOffered: 28,
    ridesTaken: 2,
    reputation: 5.0,
  },
  {
    id: "usr-1231",
    name: "Marta Nunes",
    email: "marta.nunes@outlook.com",
    phone: "+55 (85) 97654-8890",
    city: "Joaquim Távora",
    profile: "Motorista",
    verification: "Em revisão",
    status: "Bloqueado",
    joinedAt: "2026-02-15",
    lastActive: "Há 4 dias",
    avatar: marina,
    ridesOffered: 8,
    ridesTaken: 1,
    reputation: 4.4,
  },
];

export const adminResponses: AdminResponse[] = [
  {
    id: "resp-3001",
    participant: "Nicolau Pereira",
    profile: "Os dois",
    city: "Fortaleza",
    source: "STS2026",
    contact: "nicolau@caronaa.app",
    submittedAt: "2026-09-30T07:20:00",
    status: "Nova",
    answers: {
      Participante: "Nicolau",
      Perfil: "Motorista",
      Origem: "Maracanaú",
      Destino: "Unifor",
      Frequência: "5x por semana",
      Dores: ["Custo do transporte", "Pouca previsibilidade"],
      Expectativas: ["Horario estável", "Segurança"],
    },
  },
  {
    id: "resp-3002",
    participant: "Larissa Costa",
    profile: "Passageiro",
    city: "Maracanaú",
    source: "UNIFOR",
    contact: "+55 (85) 99112-2244",
    submittedAt: "2026-09-29T18:40:00",
    status: "Em análise",
    answers: {
      Participante: "Larissa",
      Perfil: "Passageira",
      Origem: "Parangaba",
      Destino: "Centro",
      Frequência: "3x por semana",
      Dores: ["Falta de opções seguras"],
      Expectativas: ["Preço justo", "Trajeto previsível"],
    },
  },
  {
    id: "resp-3003",
    participant: "Rafael Oliveira",
    profile: "Motorista",
    city: "Aldeota",
    source: "Instagram",
    contact: "+55 (85) 98344-1002",
    submittedAt: "2026-09-28T09:05:00",
    status: "Aprovada",
    answers: {
      Participante: "Rafael",
      Perfil: "Motorista",
      Origem: "Aldeota",
      Destino: "Meireles",
      Frequência: "4x por semana",
      Dores: ["Assentos vazios"],
      Expectativas: ["Mais segurança e avaliação"] ,
    },
  },
  {
    id: "resp-3004",
    participant: "Marta Nunes",
    profile: "Motorista",
    city: "Joaquim Távora",
    source: "QR Code",
    contact: "+55 (85) 97654-8890",
    submittedAt: "2026-09-26T16:20:00",
    status: "Revisão",
    answers: {
      Participante: "Marta",
      Perfil: "Motorista",
      Origem: "Joaquim Távora",
      Destino: "Fortaleza",
      Frequência: "2x por semana",
      Dores: ["Tempo de deslocamento"],
      Expectativas: ["Teste em rota e horários"],
    },
  },
];

export const adminLeadSources = [
  { source: "STS2026", responses: 137, conversions: 42 },
  { source: "UNIFOR", responses: 109, conversions: 33 },
  { source: "Instagram", responses: 94, conversions: 28 },
  { source: "QR Code", responses: 71, conversions: 17 },
  { source: "Direct", responses: 58, conversions: 14 },
];

export const adminValidationSummary = {
  totalResponses: 811,
  responsesToday: 37,
  responsesLast7Days: 182,
  completionRate: "76%",
  byProfile: [
    { label: "Motoristas", value: 42 },
    { label: "Passageiros", value: 36 },
    { label: "Os dois", value: 22 },
  ],
};

export const adminService = {
  getOverview: () => adminOverview,
  listUsers: ({ filter = "all", search = "" }: { filter?: string; search?: string } = {}) => {
    const normalized = search.trim().toLowerCase();
    const filtered = adminUsers.filter((user) => {
      const matchesSearch =
        !normalized ||
        [user.name, user.email, user.phone, user.id, user.city].some((field) =>
          field.toLowerCase().includes(normalized),
        );

      const matchesFilter =
        filter === "all" ||
        (filter === "motorista" && user.profile === "Motorista") ||
        (filter === "passageiro" && user.profile === "Passageiro") ||
        (filter === "ambos" && user.profile === "Os dois") ||
        (filter === "verificados" && user.verification === "Verificado") ||
        (filter === "bloqueados" && user.status === "Bloqueado") ||
        (filter === "novos" && user.status === "Novo");

      return matchesSearch && matchesFilter;
    });

    return filtered;
  },
  getUser: (id: string) => adminUsers.find((user) => user.id === id) ?? null,
  listSurveyResponses: ({ source = "all", search = "" }: { source?: string; search?: string } = {}) => {
    return adminResponses.filter((response) => {
      const matchesSource = source === "all" || response.source === source;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [response.participant, response.city, response.contact, response.id, response.source].some((field) =>
          field.toLowerCase().includes(query),
        );

      return matchesSource && matchesSearch;
    });
  },
  getSurveyResponse: (id: string) => adminResponses.find((response) => response.id === id) ?? null,
};
