/**
 * Organizational information architecture. This registry is navigation metadata,
 * not an authorization mechanism. The existing AdminGuard and database RLS remain
 * responsible for access until department roles are formally introduced.
 */
export type DepartmentId =
 | "executive" | "technology" | "operations" | "growth"
 | "research" | "partnerships" | "safety" | "finance" | "compliance";
export type DepartmentCategory = {
 id:string; label:string; description:string; route?:string; phase:"existing"|"planned";
};
export type Department = {
 id:DepartmentId; name:string; shortName:string; mission:string;
 ownerRole:string; categories:readonly DepartmentCategory[];
};
const existing=(id:string,label:string,description:string,route:string):DepartmentCategory=>({id,label,description,route,phase:"existing"});
const planned=(id:string,label:string,description:string):DepartmentCategory=>({id,label,description,phase:"planned"});
export const DEPARTMENTS:readonly Department[]=[
 {id:"executive",name:"Direção e Estratégia",shortName:"Direção",mission:"Acompanhar resultados, metas, decisões e riscos empresariais.",ownerRole:"Direção executiva",categories:[
 existing("overview","Visão executiva","Indicadores reais, funil de ativação e gestão estratégica.","/admin/executivo"),
 existing("okrs","Objetivos e resultados-chave","Metas, progresso e prazos com persistência.","/admin/executivo"),
 existing("decisions","Decisões estratégicas","Registro de decisões e responsáveis.","/admin/executivo"),
 existing("risk","Riscos e oportunidades","Registro de riscos, prioridades e tratamento.","/admin/executivo")
 ]},
 {id:"technology",name:"Tecnologia e Produto",shortName:"Tecnologia",mission:"Evoluir produto, infraestrutura e confiabilidade técnica.",ownerRole:"Gestão de tecnologia",categories:[
 planned("health","Saúde dos serviços","Disponibilidade, erros e métricas instrumentadas."),
 existing("incidents","Incidentes técnicos","Gestão de incidentes com histórico.","/admin/tecnologia"),
 existing("releases","Produto e releases","Registros de bugs, melhorias e releases.","/admin/tecnologia"),
 planned("integrations","Integrações","Estado e dependências das integrações.")
 ]},
 {id:"operations",name:"Operações de Mobilidade",shortName:"Operações",mission:"Operar viagens e equilibrar oferta, demanda e qualidade.",ownerRole:"Gestão de operações",categories:[
 existing("command","Centro de Operações","Acompanhamento operacional ao vivo.","/admin/operacoes"),
 existing("history","Histórico & Relatórios","Pedidos, corridas e picos de demanda.","/admin/operacoes"),
 existing("support","Configurações","WhatsApp de suporte e parâmetros administrativos.","/admin/operacoes"),
 existing("rides","Caronas","Gestão de ofertas e viagens.","/admin/caronas"),
 existing("requests","Solicitações","Pedidos de passageiros.","/admin/solicitacoes"),
 existing("matches","Correspondências","Correspondências entre ofertas e solicitações.","/admin/matching"),
 existing("drivers","Motoristas","Consulta da base de motoristas.","/admin/motoristas"),
 existing("passengers","Passageiros","Consulta da base de passageiros.","/admin/passageiros"),
 planned("local","Mobilidade local","Operação profissional e municípios.")
 ]},
 {id:"growth",name:"Crescimento, Marketing e CRM",shortName:"Growth e CRM",mission:"Adquirir, converter e reter usuários com origem rastreável.",ownerRole:"Gestão de crescimento",categories:[
 existing("users","Usuários","Contas existentes e situação de cadastro.","/admin/usuarios"),
 existing("leads","Leads e aquisição","Cadastro e qualificação de leads.","/admin/crescimento"),
 planned("funnels","Funil de conversão","Pesquisa, lead, cadastro e primeira utilização."),
 existing("campaigns","Campanhas","Cadastro de campanhas e canais de origem.","/admin/crescimento"),
 planned("retention","Retenção","Segmentos e retenção comprovada.")
 ]},
 {id:"research",name:"Pesquisa e Inteligência de Mercado",shortName:"Pesquisa",mission:"Validar problemas de mobilidade com evidências confiáveis.",ownerRole:"Gestão de pesquisa",categories:[
 existing("intelligence","Centro de Pesquisa e Validação","BI consolidado, comparações e metodologia.","/admin/inteligencia-pesquisa"),
 existing("forms","Central de Formulários","Biblioteca, publicação e análises de pesquisas.","/admin/formularios"),
 existing("answers","Respostas","Consulta de respostas históricas.","/admin/formularios/respostas"),
 existing("validation","Validação","Análise de hipóteses e dores.","/admin/validacao"),
 existing("opportunities","Oportunidades","Oportunidades registradas.","/admin/oportunidades"),
 planned("quality","Qualidade estatística","Amostragem, consistência e denominadores."),
 planned("territories","Inteligência territorial","Demanda por município e região.")
 ]},
 {id:"partnerships",name:"Parcerias e Expansão",shortName:"Parcerias",mission:"Desenvolver relações institucionais e pilotos locais.",ownerRole:"Gestão de parcerias",categories:[
 existing("relations","Relacionamentos","Relações e contatos já cadastrados.","/admin/relacionamentos"),
 existing("partners","Instituições e convênios","Gestão de instituições, contatos e situações.","/admin/parcerias"),
 existing("pilots","Pilotos","Criação e acompanhamento de pilotos.","/admin/parcerias"),
 existing("expansion","Expansão","Municípios com instituições e pilotos cadastrados.","/admin/parcerias")
 ]},
 {id:"safety",name:"Atendimento, Confiança e Segurança",shortName:"Atendimento",mission:"Atender participantes e gerir segurança e incidentes.",ownerRole:"Gestão de atendimento e segurança",categories:[
 existing("feedback","Sugestões","Feedback recebido da comunidade.","/admin/sugestoes"),
 existing("tickets","Tickets e atendimento","Fila administrativa, prioridade e acompanhamento.","/admin/atendimento"),
 existing("reports","Denúncias e incidentes","Registro e triagem administrativa de ocorrências.","/admin/atendimento"),
 planned("verification","Verificações","Critérios de segurança de profissionais.")
 ]},
 {id:"finance",name:"Financeiro e Administrativo",shortName:"Financeiro",mission:"Controlar receitas, pagamentos, repasses e despesas.",ownerRole:"Gestão financeira",categories:[
 existing("overview","Visão financeira","Painel de transações confirmadas e pendentes.","/admin/financeiro"),
 existing("transactions","Transações","Consulta de pagamentos por status e provedor.","/admin/financeiro"),
 planned("payouts","Repasses e conciliação","Liquidação, taxas e conferência."),
 planned("budget","Orçamento e despesas","Planejamento e acompanhamento financeiro.")
 ]},
 {id:"compliance",name:"Jurídico, Compliance e Privacidade",shortName:"Compliance",mission:"Assegurar contratos, privacidade, auditoria e obrigações legais.",ownerRole:"Responsável jurídico e compliance",categories:[
 existing("contracts","Contratos","Controle de prazos, referências e situações.","/admin/compliance"),
 planned("privacy","Consentimentos e privacidade","Finalidades, consentimentos e direitos dos titulares."),
 existing("audit","Auditoria","Histórico de alterações de estados no banco.","/admin/compliance"),
 existing("regulation","Regulamentação","Registro administrativo de requisitos e prazos.","/admin/compliance")
 ]}
] as const;
export function getDepartment(id:string):Department|undefined{return DEPARTMENTS.find(d=>d.id===id)}
export function departmentPath(id:DepartmentId){return "/admin/departamentos/"+id}
export const DEPARTMENT_IDS=DEPARTMENTS.map(d=>d.id);
