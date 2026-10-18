import type { SurveyQuestion, SurveySchema } from "@/lib/formulario/research-templates";

export const URBAN_MODEL_KEY = "UNIVERSIDADE_URBANA_CARONAA" as const;
export const URBAN_DAY_OPTIONS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
export const URBAN_TIME_SUGGESTIONS = ["07:00", "12:00", "17:30", "18:00", "19:00", "21:00", "22:00"];

export type UrbanLaunchStatus = "PLANEJADO" | "CONFIRMADO" | "ATIVO" | "ADIADO";
export type UrbanUniversitySettings = {
  model: typeof URBAN_MODEL_KEY;
  university: string;
  campus: string;
  address: string;
  city: string;
  launch_status: UrbanLaunchStatus;
  launch_date: string | null;
  times: string[];
  days: string[];
  areas: string[];
  modes: string[];
  campaign: string;
  partnership_status: "EM_ESTUDO" | "EM_NEGOCIACAO" | "CONFIRMADA";
};
export const defaultUrbanSettings: UrbanUniversitySettings = {
  model: URBAN_MODEL_KEY,
  university: "",
  campus: "",
  address: "",
  city: "",
  launch_status: "PLANEJADO",
  launch_date: null,
  times: [...URBAN_TIME_SUGGESTIONS],
  days: ["SEG", "TER", "QUA", "QUI", "SEX"],
  areas: [],
  modes: ["CARRO_COMPARTILHADO"],
  campaign: "",
  partnership_status: "EM_ESTUDO",
};
export function normalizeUrbanTimes(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)))].sort();
}
export function validateUrbanSettings(config: UrbanUniversitySettings): string[] {
  const errors: string[] = [];
  if (config.university.trim().length < 2) errors.push("Informe o nome da universidade.");
  if (config.campus.trim().length < 2) errors.push("Informe o campus ou unidade.");
  if (config.address.trim().length < 5) errors.push("Informe a localização do campus.");
  if (config.city.trim().length < 2) errors.push("Informe a cidade.");
  if (!["PLANEJADO","CONFIRMADO","ATIVO","ADIADO"].includes(config.launch_status))
    errors.push("Situação de lançamento inválida.");
  if (config.launch_status === "CONFIRMADO" && !config.launch_date)
    errors.push("Informe a data de início confirmada.");
  if (config.launch_date && !/^\d{4}-\d{2}-\d{2}$/.test(config.launch_date))
    errors.push("Data de início inválida.");
  if (config.times.length < 2 || config.times.length > 24 ||
      normalizeUrbanTimes(config.times).length !== config.times.length)
    errors.push("Escolha entre 2 e 24 horários válidos, sem repetição.");
  if (config.days.length === 0) errors.push("Escolha pelo menos um dia da semana.");
  if (config.modes.length === 0) errors.push("Selecione uma modalidade disponível.");
  return errors;
}
export function launchNotice(config: UrbanUniversitySettings): string {
  const date = config.launch_date
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" })
      .format(new Date(config.launch_date + "T12:00:00Z"))
    : null;
  if (config.launch_status === "ATIVO") return "O CARONAA já está em operação nesta instituição, conforme as modalidades habilitadas.";
  if (config.launch_status === "ADIADO") return "O início do CARONAA nesta instituição foi adiado. Uma nova data será comunicada quando confirmada.";
  if (config.launch_status === "CONFIRMADO" && date) return "O início do CARONAA nesta instituição está confirmado para " + date + ".";
  return date
    ? "O início está previsto para " + date + ", sujeito a confirmação."
    : "A data de início ainda não foi confirmada.";
}
export function universityIntroduction(config: UrbanUniversitySettings): string {
  return "Seu caminho para " + config.university + " pode ser mais simples. " +
    "O CARONAA conecta pessoas com trajetos e horários compatíveis para compartilhar deslocamentos. " +
    "Estamos conhecendo a rotina de quem frequenta " + config.campus + " e preparando uma alternativa para a comunidade universitária. " +
    launchNotice(config) + " Responda em poucos minutos e, se desejar, prepare seu interesse para o lançamento.";
}

const PAINS = ["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06"];
const roleOptions = ["PEGAR","OFERECER","AMBOS","CONHECER"];
function question(id: string, label: string, type: SurveyQuestion["type"], required: boolean,
  options: string[] = [], more: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return { id, label, type, required, options, ...more };
}

/** Stable question keys are intentional: server-side opt-in and analytics use them. */
export function buildUrbanUniversitySchema(config: UrbanUniversitySettings): SurveySchema & { model: string } {
  const errors = validateUrbanSettings(config);
  if (errors.length) throw new Error(errors.join(" "));
  const departure = normalizeUrbanTimes(config.times);
  const vehicle = ["CARRO","MOTO"];
  return { model: URBAN_MODEL_KEY, sections: [
    { id: "urban-profile", title: "Sua rotina hoje", description: "Leva cerca de um minuto. Sem solicitar endereço residencial.", questions: [
      question("urban_affiliation","Qual é seu vínculo com a universidade?","single_choice",true,
        ["ESTUDANTE","ESTUDANTE_TRABALHADOR","PROFESSOR","COLABORADOR","TERCEIRIZADO","OUTRO"],
        {semanticCode:"ACADEMIC_ROLE"}),
      question("urban_transport","Como você costuma ir ou voltar da universidade?","multiple_choice",true,
        ["ONIBUS","APLICATIVO","CARRO","MOTO","CARONA","BICICLETA","A_PE","OUTRO"],
        {semanticCode:"TRANSPORT_MODE"}),
      question("urban_cost","Quanto gasta, aproximadamente, por trecho, em R$?","number",false,[],
        {semanticCode:"COST_PER_TRIP",helpText:"Informe o custo de uma única viagem, não da semana. Pode informar 0.",minValue:0,maxValue:10000}),
      question("urban_pains","Quais são suas duas maiores dificuldades no deslocamento?","multiple_choice",true,PAINS,
        {semanticCode:"MOBILITY_PAINS",helpText:"Marque uma ou duas opções."}),
      question("urban_main_pain","Qual é a principal dificuldade?","single_choice",true,PAINS,
        {semanticCode:"MOBILITY_MAIN_PAIN",helpText:"Escolha uma das dificuldades assinaladas acima."}),
    ]},
    { id: "urban-journey", title: "Seu trajeto e horários",description:"Usaremos regiões aproximadas e horários para estudar oportunidades de correspondência.",questions: [
      question("urban_role","Como gostaria de participar do CARONAA?","single_choice",true,roleOptions,
        {semanticCode:"MOBILITY_ROLE"}),
      question("urban_origin","De qual bairro ou ponto de referência costuma partir?","location",true,[],
        {semanticCode:"ORIGIN_AREA",helpText:"Não informe rua, número ou endereço residencial completo."}),
      question("urban_destination_type","Para onde normalmente vai após sair da universidade?","single_choice",true,
        ["CASA","TRABALHO","OUTRO_CAMPUS","OUTRO"],{semanticCode:"DESTINATION_TYPE"}),
      question("urban_destination_area","Qual é a região aproximada de destino?","location",true,[],
        {semanticCode:"DESTINATION_AREA",helpText:"Bairro, região ou ponto público de referência."}),
      question("urban_days","Em quais dias costuma frequentar o campus?","multiple_choice",true,
        config.days.length ? config.days : URBAN_DAY_OPTIONS,{semanticCode:"CAMPUS_DAYS_WEEK"}),
      question("urban_departure","Em qual horário costuma sair do campus?","single_choice",true,
        [...departure,"OUTRO"],{semanticCode:"DEPARTURE_WINDOW",helpText:"Horários sugeridos para facilitar encontros de pessoas com rotinas parecidas."}),
      question("urban_departure_other","Qual é o outro horário de saída?","time",true,[],
        {showWhen:{questionId:"urban_departure",equals:"OUTRO"}}),
      question("urban_flex","Quanto pode ajustar seu horário?","single_choice",true,
        ["EXATO","15_MIN","30_MIN"],{semanticCode:"SCHEDULE_FLEXIBILITY"}),
      question("urban_vehicle_offer","Qual veículo utilizaria para oferecer carona?","single_choice",true,vehicle,
        {showWhen:{questionId:"urban_role",equals:"OFERECER"},semanticCode:"OFFER_VEHICLE"}),
      question("urban_seats_offer","Quantos lugares realmente pode oferecer?","number",true,[],
        {showWhen:{questionId:"urban_role",equals:"OFERECER"},semanticCode:"SEATS_AVAILABLE",minValue:1,maxValue:4,integerOnly:true}),
      question("urban_vehicle_both","Qual veículo utilizaria para oferecer carona?","single_choice",true,vehicle,
        {showWhen:{questionId:"urban_role",equals:"AMBOS"},semanticCode:"OFFER_VEHICLE"}),
      question("urban_seats_both","Quantos lugares realmente pode oferecer?","number",true,[],
        {showWhen:{questionId:"urban_role",equals:"AMBOS"},semanticCode:"SEATS_AVAILABLE",minValue:1,maxValue:4,integerOnly:true}),
    ]},
    { id:"urban-solution",title:"Sua opinião sobre a proposta",questions: [
      question("urban_intent","Se houver uma carona compatível com informações claras sobre percurso e valor, você consideraria participar?","single_choice",true,
        ["CERTEZA","PROVAVELMENTE","TALVEZ","PROVAVELMENTE_NAO","NAO"],{semanticCode:"ADOPTION_INTENT"}),
      question("urban_decision","O que mais influenciaria sua decisão?","single_choice",true,
        ["PRECO","CONFIANCA","HORARIO","EMBARQUE","AVALIACOES","PREVISIBILIDADE","OUTRO"],
        {semanticCode:"ADOPTION_DRIVER"}),
    ]},
    { id:"urban-economics",title:"Valores e condições",description:"Perguntas sobre intenção — não são pagamentos nem reservas.",questions: [
      question("urban_budget","Para um trecho compatível, qual seria seu orçamento aproximado?","money_range",false,
        ["ATE_5","DE_5_A_10","DE_10_A_15","DE_15_A_20","ACIMA_20","DEPENDE_DA_ROTA"],
        {semanticCode:"WILLINGNESS_TO_PAY_BAND",helpText:"Faixas em reais, apenas para pesquisa. Nenhum preço de carona está sendo prometido."}),
      question("urban_driver_motivation","O que mais motivaria você a oferecer carona?","single_choice",false,
        ["DIVIDIR_DESPESAS","AJUDAR","PRATICIDADE","OUTRO"],
        {semanticCode:"DRIVER_MOTIVATION"}),
    ]},
    { id:"urban-activation",title:"Prepare sua participação",description:launchNotice(config),questions: [
      question("urban_notify","Gostaria de receber um aviso sobre o início do CARONAA no campus?","yes_no",true,[],
        {semanticCode:"LAUNCH_NOTIFICATION_INTENT"}),
      question("urban_prepare","Deseja deixar sua disponibilidade ou interesse preparado para ativação?","yes_no",true,[],
        {semanticCode:"PREACTIVATION_INTENT",helpText:"Não cria uma oferta, reserva ou cobrança. Você poderá confirmar seu trajeto no aplicativo quando o serviço estiver disponível."}),
    ]},
  ]};
}
