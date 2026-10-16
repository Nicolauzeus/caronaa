export type SurveyQuestion = {id:string;label:string;type:"short_text"|"long_text"|"single_choice"|"multiple_choice"|"number";required:boolean;options:string[];showWhen?:{questionId:string;equals:string}};
export type SurveySection={title:string;questions:SurveyQuestion[]};
export type SurveySchema={sections:SurveySection[]};
const q=(id:string,label:string,type:SurveyQuestion["type"],required=true,options:string[]=[]):SurveyQuestion=>({id,label,type,required,options});
const context=(name:string):SurveySection=>({title:"Seu contexto",questions:[
 q("occupation","Qual é a sua ocupação?","single_choice",true,["ESTUDANTE","TRABALHADOR","ESTUDANTE_TRABALHADOR","OUTRO"]),
 q("current_transport","Como você se desloca atualmente?","multiple_choice",true,["MOTO","CARRO","ONIBUS","TAXI","MOTOTAXI","A_PE","OUTRO"]),
 q("transport_cost","Quanto gasta em média por viagem (R$)?","number",false),
 q("main_challenge","Qual a maior dificuldade de deslocamento?","multiple_choice",true,["DOR_01","DOR_02","DOR_03","DOR_04","DOR_05","DOR_06","OUTRA"])
]});
export const MUNICIPAL_TEMPLATES:{key:string;label:string;description:string;schema:SurveySchema}[]=[
 {key:"PROFISSIONAIS",label:"Profissionais locais",description:"Mototaxistas, taxistas e motoristas",schema:{sections:[
 context("Profissionais"),{title:"Seu trabalho",questions:[
 q("vehicle","Com que tipo de veículo trabalha?","single_choice",true,["MOTOTAXI","TAXI","CARRO_PARTICULAR","OUTRO"]),
 q("customer_acquisition","Como recebe chamadas de clientes?","multiple_choice",true,["PONTO","TELEFONE","WHATSAPP","INDICACAO","APLICATIVO"]),
 q("available_hours","Em quais horários costuma trabalhar?","multiple_choice",true,["MANHA","TARDE","NOITE","MADRUGADA"]),
 q("internet","Consegue manter internet móvel durante o expediente?","single_choice",true,["SIM","NAO","AS_VEZES"]),
 q("adoption","Usaria o CARONAA para receber pedidos em tempo real?","single_choice",true,["SIM","TALVEZ","NAO"]),
 q("professional_concerns","Quais suas maiores preocupações?","multiple_choice",true,["COMISSAO","SEGURANCA","CANCELAMENTO","PAGAMENTO","INTERNET","REGULAMENTACAO"])
 ]}]}},
 {key:"PASSAGEIROS",label:"Moradores e passageiros",description:"Demanda e dificuldades dos moradores",schema:{sections:[
 context("Moradores"),{title:"Acesso e espera",questions:[
 q("availability","Você consegue transporte quando precisa?","single_choice",true,["SEMPRE","AS_VEZES","RARAMENTE"]),
 q("wait_minutes","Quantos minutos costuma esperar?","number",false),
 q("trip_time","Em que período mais precisa de transporte?","multiple_choice",true,["MANHA","TARDE","NOITE","MADRUGADA"]),
 q("request_channel","Como chama transporte hoje?","multiple_choice",true,["RUA","PONTO","LIGACAO","WHATSAPP","FAMILIARES"]),
 q("adoption","Usaria o CARONAA para chamar motorista ou mototaxista?","single_choice",true,["SIM","TALVEZ","NAO"]),
 q("safety","O que aumentaria sua confiança?","multiple_choice",true,["IDENTIFICACAO","AVALIACOES","PRECO_ANTECIPADO","RASTREAMENTO","SUPORTE"])
 ]}]}},
 {key:"PREFEITURA",label:"Gestão municipal",description:"Cobertura e planejamento de transporte",schema:{sections:[
 {title:"Diagnóstico municipal",questions:[
 q("population","População estimada atendida","number",false),
 q("transport_categories","Quais serviços operam no município?","multiple_choice",true,["MOTOTAXI","TAXI","ONIBUS","VAN","TRANSPORTE_ESCOLAR","OUTROS"]),
 q("service_gaps","Onde ocorrem maiores dificuldades de acesso?","long_text",true),
 q("regulation","Há regulamentação ou cadastro local dos profissionais?","single_choice",true,["SIM","PARCIAL","NAO","NAO_SEI"]),
 q("pilot_interest","A prefeitura teria interesse em avaliar um piloto supervisionado?","single_choice",true,["SIM","TALVEZ","NAO"])
 ]}]}},
];
