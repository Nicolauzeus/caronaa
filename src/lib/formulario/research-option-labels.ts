/**
 * Public-facing labels are presentation-only. Persist the original option value
 * so responses, BI aggregates and historical survey versions stay compatible.
 *
 * Legacy pain descriptions follow the CARONAA pain catalog.
 */
export const RESEARCH_OPTION_LABELS:Record<string,string>={
 LOTACAO:"Ônibus lotados",
 PRECO_ALTO:"Preço alto do transporte",
 ESPERA_LONGA:"Tempo de espera prolongado",
 ATRASOS:"Atrasos frequentes",
 INSEGURANCA:"Insegurança no trajeto",
 SEM_TRANSPORTE:"Falta de transporte disponível",
 DESCONFORTO:"Desconforto nas viagens",
 HORARIO_INCOMPATIVEL:"Horários incompatíveis",
 NENHUMA:"Nenhuma dessas dificuldades",
 DIARIAMENTE:"Diariamente",
 ALGUNS_DIAS:"Alguns dias da semana",
 MORADOR:"Morador(a)",
 GESTOR:"Gestor(a)",
 PRESTADOR:"Prestador(a) de serviço",
 CARONA_COMPARTILHADA:"Carona compartilhada no mesmo trajeto",
 MOTOTAXI_REGULARIZADO:"Mototáxi profissional regularizado",
 AMBAS_MODALIDADES:"Ambas, dependendo do trajeto",
 NENHUMA:"Nenhuma dessas dificuldades",
 CONHECER_MELHOR:"Preciso conhecer melhor as opções",
 DISPONIBILIDADE:"Disponibilidade no horário",
 ESPERA:"Tempo de espera",
 SEM_GRANDE_DESVIO:"Não desviar muito do trajeto",
 NENHUM:"Nenhum desvio",
 ATE_5_MIN:"Até 5 minutos",
 ATE_10_MIN:"Até 10 minutos",
 MAIS_10_MIN:"Mais de 10 minutos",
 TODOS_DIAS:"Todos os dias de trabalho",
 ALGUNS_DIAS:"Alguns dias da semana",
 EVENTUALMENTE:"Eventualmente",
 DOR_01:"Dificuldade para encontrar transporte para meu trajeto",
 DOR_02:"Transporte lotado ou desconfortável",
 DOR_03:"Preço alto das opções de transporte",
 DOR_04:"Muito tempo gasto no deslocamento",
 DOR_05:"Poucas opções de carona ou assentos disponíveis",
 DOR_06:"Insegurança ou falta de confiança ao viajar",
 AVALIACOES:"Avaliações e comentários de outros usuários",
 RASTREAMENTO:"Acompanhamento da viagem em tempo real",
 PRECO_ANTECIPADO:"Saber o preço antes de confirmar",
 SUPORTE:"Suporte rápido quando precisar",
 OUTRA:"Outra dificuldade",
 OUTRO:"Outro",
 SIM:"Sim",
 NAO:"Não",
 TALVEZ:"Talvez",
 NAO_SEI:"Não sei",
 A_PE:"A pé",
 ONIBUS:"Ônibus",
 MOTOTAXI:"Mototáxi",
 TRANSPORTE_COLETIVO:"Transporte coletivo",
 CARONA:"Carona",
 BICICLETA:"Bicicleta",
 APLICATIVO:"Aplicativos de transporte",
 APP:"Aplicativo",
 MOTO:"Motocicleta",
 TAXI:"Táxi",
 VAN:"Van",
 MANHA:"Manhã",
 TARDE:"Tarde",
 NOITE:"Noite",
 MADRUGADA:"Madrugada",
 ESTUDANTE:"Estudante",
 ESTUDANTE_TRABALHADOR:"Estudante e trabalhador(a)",
 PROFESSOR:"Professor(a)",
 TECNICO:"Técnico(a)",
 TERCEIRIZADO:"Terceirizado(a)",
 ORGANIZADOR:"Organizador(a)",
 PALESTRANTE:"Palestrante",
 EXPOSITOR:"Expositor(a)",
 VISITANTE:"Visitante",
 TRABALHADOR:"Trabalhador(a)",
 IDENTIFICACAO:"Identificação verificada dos participantes",
 INDICACAO:"Indicação de alguém de confiança",
 SINALIZACAO:"Sinalização dos pontos de embarque",
 ACESSIBILIDADE:"Acessibilidade do transporte",
 SEGURANCA:"Segurança",
 HORARIO:"Horários",
 PRECO:"Preço",
 CONFIANCA:"Confiança",
 DESVIO:"Desvios da rota",
 CUSTO:"Custo",
 PONTO:"Pontos de embarque",
 TELEFONE:"Telefone",
 WHATSAPP:"WhatsApp",
 INTERNET:"Conexão à internet",
 INSEGURANCA:"Insegurança",
 CANCELAMENTO:"Cancelamentos de última hora",
 COMISSAO:"Comissão cobrada",
 CONCORRENCIA:"Concorrência",
 PAGAMENTO:"Pagamento",
 REGULAMENTACAO:"Regras e regulamentação",
 SEMPRE:"Sempre",
 AS_VEZES:"Às vezes",
 RARAMENTE:"Raramente",
 PARCIAL:"Parcialmente",
 EQUIPE:"Equipe",
 CARRO:"Carro",
 ESCALA:"Escala de trabalho",
 COLABORADOR:"Colaborador(a)",
 PEGAR:"Quero pegar carona",
 OFERECER:"Posso oferecer carona",
 AMBOS:"Quero pegar ou oferecer carona",
 CONHECER:"Quero apenas conhecer",
 CERTEZA:"Com certeza",
 PROVAVELMENTE:"Provavelmente",
 PROVAVELMENTE_NAO:"Provavelmente não",
 PREVISIBILIDADE:"Ter previsibilidade do trajeto",
 DIVIDIR_DESPESAS:"Dividir despesas do trajeto",
 AJUDAR:"Ajudar alguém que faz o mesmo caminho",
 PRATICIDADE:"Praticidade",
 ATE_5:"Até R$ 5",
 DE_5_A_10:"De R$ 5 a R$ 10",
 DE_10_A_15:"De R$ 10 a R$ 15",
 DE_15_A_20:"De R$ 15 a R$ 20",
 ACIMA_20:"Acima de R$ 20",
 DEPENDE_DA_ROTA:"Depende da rota"
};

/** Safe fallback for administrator-authored options that have no dictionary entry. */
export function formatResearchOption(option:string):string{
 const exact=RESEARCH_OPTION_LABELS[option];
 if(exact)return exact;
 if(/^DOR_\d{2}$/.test(option))return "Outra dificuldade identificada ("+option+")";
 const spaced=option.replace(/_/g," ").trim();
 if(!spaced)return option;
 return /^[A-Z0-9\s/()-]+$/.test(spaced)
  ? spaced.charAt(0).toUpperCase()+spaced.slice(1).toLocaleLowerCase("pt-BR")
  :spaced;
}

export function getRatingScaleContext(question:{id:string;label:string;semanticCode?:string;type:string}):{
 low:string;high:string;middle:string;intent:"safety"|"generic"
}{
 const isSafety=question.id.toLowerCase()==="safety"||
  question.semanticCode?.toUpperCase()==="SAFETY_SCORE"||
  /segur|proteção|risco/i.test(question.label);
 if(isSafety)return {low:"Muito inseguro",middle:"Neutro",high:"Muito seguro",intent:"safety"};
 if(/útil|utilidade/i.test(question.label))return {low:"Nada útil",middle:"Neutro",high:"Muito útil",intent:"generic"};
 return {low:"Muito ruim",middle:"Regular",high:"Excelente",intent:"generic"};
}
