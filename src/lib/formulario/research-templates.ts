export type SurveyQuestionType = "short_text"|"long_text"|"single_choice"|"multiple_choice"|"number"|"rating_1_5"|"rating_0_10"|"date"|"time"|"yes_no"|"rating_stars"|"money_range"|"location"|"ranking"|"matrix"|"contact";
export type SurveyQuestion = {id:string;label:string;type:SurveyQuestionType;required:boolean;options:string[];showWhen?:{questionId:string;equals:string};semanticCode?:string;helpText?:string;rows?:string[]};
export type SurveySection={title:string;questions:SurveyQuestion[];id?:string;description?:string};
export type SurveySchema={sections:SurveySection[]};
export type ResearchTemplate={key:string;nature:string;label:string;description:string;estimatedMinutes:number;schema:SurveySchema};
export const RESEARCH_TEMPLATES:ResearchTemplate[]=[
  {
    "key": "EVENTO_TRAJETO",
    "nature": "EVENTO",
    "label": "Deslocamento de participantes",
    "description": "Origem, acesso, custo e necessidades para eventos",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Sua participação",
          "questions": [
            {
              "id": "role",
              "label": "Você participa como?",
              "type": "single_choice",
              "required": true,
              "options": [
                "VISITANTE",
                "EXPOSITOR",
                "ORGANIZADOR",
                "PALESTRANTE",
                "EQUIPE"
              ]
            },
            {
              "id": "origin",
              "label": "De qual região veio?",
              "type": "short_text",
              "required": false,
              "options": [],
              "semanticCode": "ORIGIN_AREA"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Sua viagem",
          "questions": [
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            }
          ]
        },
        {
          "title": "Próximas edições",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            },
            {
              "id": "comments",
              "label": "Como melhorar a chegada e saída do evento?",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EVENTO_SATISFACAO",
    "nature": "EVENTO",
    "label": "Avaliação do transporte no evento",
    "description": "Avalia disponibilidade, espera e segurança",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Sua participação",
          "questions": [
            {
              "id": "role",
              "label": "Você participa como?",
              "type": "single_choice",
              "required": true,
              "options": [
                "VISITANTE",
                "EXPOSITOR",
                "ORGANIZADOR",
                "PALESTRANTE",
                "EQUIPE"
              ]
            },
            {
              "id": "origin",
              "label": "De qual região veio?",
              "type": "short_text",
              "required": false,
              "options": [],
              "semanticCode": "ORIGIN_AREA"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Experiência",
          "questions": [
            {
              "id": "wait",
              "label": "Quanto tempo costuma esperar por transporte em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "WAIT_TIME"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "score",
              "label": "Como avalia o transporte até o evento?",
              "type": "rating_0_10",
              "required": true,
              "options": [],
              "semanticCode": "TRANSPORT_SATISFACTION"
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            }
          ]
        },
        {
          "title": "Melhorias",
          "questions": [
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            },
            {
              "id": "improve",
              "label": "O que deveria mudar?",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EVENTO_PLANEJAMENTO",
    "nature": "EVENTO",
    "label": "Planejamento do próximo evento",
    "description": "Planeje horários, deslocamentos e rotas com antecedência",
    "estimatedMinutes": 3,
    "schema": {
      "sections": [
        {
          "title": "Sua participação",
          "questions": [
            {
              "id": "role",
              "label": "Você participa como?",
              "type": "single_choice",
              "required": true,
              "options": [
                "VISITANTE",
                "EXPOSITOR",
                "ORGANIZADOR",
                "PALESTRANTE",
                "EQUIPE"
              ]
            },
            {
              "id": "origin",
              "label": "De qual região veio?",
              "type": "short_text",
              "required": false,
              "options": [],
              "semanticCode": "ORIGIN_AREA"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Planejamento",
          "questions": [
            {
              "id": "arrival",
              "label": "Em qual horário pretende chegar?",
              "type": "time",
              "required": false,
              "options": []
            },
            {
              "id": "departure",
              "label": "Em qual horário pretende sair?",
              "type": "time",
              "required": false,
              "options": []
            },
            {
              "id": "group",
              "label": "Quantas pessoas se deslocam com você?",
              "type": "number",
              "required": false,
              "options": []
            },
            {
              "id": "needs",
              "label": "Que facilidades ajudariam?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "CARONA",
                "TRANSPORTE_COLETIVO",
                "SINALIZACAO",
                "ACESSIBILIDADE",
                "OUTRO"
              ]
            }
          ]
        },
        {
          "title": "Interesse",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EDU_ESTUDANTES",
    "nature": "EDUCACAO",
    "label": "Mobilidade estudantil",
    "description": "Modelo para universidade, escola ou campus",
    "estimatedMinutes": 5,
    "schema": {
      "sections": [
        {
          "title": "Perfil acadêmico",
          "questions": [
            {
              "id": "affiliation",
              "label": "Seu vínculo com a instituição",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "PROFESSOR",
                "TECNICO",
                "TERCEIRIZADO",
                "OUTRO"
              ],
              "semanticCode": "ACADEMIC_ROLE"
            },
            {
              "id": "campus",
              "label": "Campus / unidade",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "CAMPUS"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Rotina acadêmica",
          "questions": [
            {
              "id": "days",
              "label": "Em quantos dias da semana frequenta a instituição?",
              "type": "number",
              "required": true,
              "options": [],
              "semanticCode": "CAMPUS_DAYS"
            },
            {
              "id": "arrival",
              "label": "Horário habitual de chegada",
              "type": "time",
              "required": false,
              "options": []
            },
            {
              "id": "departure",
              "label": "Horário habitual de saída",
              "type": "time",
              "required": false,
              "options": []
            },
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            }
          ]
        },
        {
          "title": "Dificuldades e segurança",
          "questions": [
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            }
          ]
        },
        {
          "title": "Alternativas",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "preferences",
              "label": "O que impediria você de usar carona?",
              "type": "multiple_choice",
              "required": false,
              "options": [
                "SEGURANCA",
                "HORARIO",
                "PRECO",
                "CONFIANCA",
                "OUTRO"
              ]
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EDU_COLABORADORES",
    "nature": "EDUCACAO",
    "label": "Docentes e colaboradores",
    "description": "Diagnóstico de professores e equipes",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Perfil acadêmico",
          "questions": [
            {
              "id": "affiliation",
              "label": "Seu vínculo com a instituição",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "PROFESSOR",
                "TECNICO",
                "TERCEIRIZADO",
                "OUTRO"
              ],
              "semanticCode": "ACADEMIC_ROLE"
            },
            {
              "id": "campus",
              "label": "Campus / unidade",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "CAMPUS"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Trabalho",
          "questions": [
            {
              "id": "work_days",
              "label": "Dias de presença por semana",
              "type": "number",
              "required": false,
              "options": []
            },
            {
              "id": "work_shift",
              "label": "Turnos de atividade",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "MANHA",
                "TARDE",
                "NOITE",
                "ESCALA"
              ]
            },
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            }
          ]
        },
        {
          "title": "Acesso e oportunidades",
          "questions": [
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EDU_NOTURNO",
    "nature": "EDUCACAO",
    "label": "Segurança e transporte noturno",
    "description": "Investigar disponibilidade e riscos ao sair da instituição",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Perfil acadêmico",
          "questions": [
            {
              "id": "affiliation",
              "label": "Seu vínculo com a instituição",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "PROFESSOR",
                "TECNICO",
                "TERCEIRIZADO",
                "OUTRO"
              ],
              "semanticCode": "ACADEMIC_ROLE"
            },
            {
              "id": "campus",
              "label": "Campus / unidade",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "CAMPUS"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Viagem noturna",
          "questions": [
            {
              "id": "night",
              "label": "Sai após as 19h?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "NAO"
              ]
            },
            {
              "id": "night_times",
              "label": "Horário aproximado de saída",
              "type": "time",
              "required": false,
              "options": []
            },
            {
              "id": "wait",
              "label": "Quanto tempo costuma esperar por transporte em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "WAIT_TIME"
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            }
          ]
        },
        {
          "title": "Soluções",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "concerns",
              "label": "Descreva uma dificuldade relevante",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EMPRESA_TURNOS",
    "nature": "EMPRESA",
    "label": "Deslocamento de equipes",
    "description": "Avaliar turnos e deslocamento até a empresa",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Perfil profissional",
          "questions": [
            {
              "id": "shift",
              "label": "Turno habitual",
              "type": "single_choice",
              "required": true,
              "options": [
                "MANHA",
                "TARDE",
                "NOITE",
                "ESCALA",
                "OUTRO"
              ],
              "semanticCode": "WORK_SHIFT"
            },
            {
              "id": "sector",
              "label": "Setor (opcional)",
              "type": "short_text",
              "required": false,
              "options": []
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Trajeto habitual",
          "questions": [
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            },
            {
              "id": "frequency",
              "label": "Dias trabalhados por semana",
              "type": "number",
              "required": false,
              "options": []
            },
            {
              "id": "arrive",
              "label": "Horário habitual de início do expediente",
              "type": "time",
              "required": false,
              "options": []
            }
          ]
        },
        {
          "title": "Desafios",
          "questions": [
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            },
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            }
          ]
        }
      ]
    }
  },
  {
    "key": "EMPRESA_CARONAS",
    "nature": "EMPRESA",
    "label": "Caronas corporativas",
    "description": "Interesse, disponibilidade de assentos e confiança",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Perfil profissional",
          "questions": [
            {
              "id": "shift",
              "label": "Turno habitual",
              "type": "single_choice",
              "required": true,
              "options": [
                "MANHA",
                "TARDE",
                "NOITE",
                "ESCALA",
                "OUTRO"
              ],
              "semanticCode": "WORK_SHIFT"
            },
            {
              "id": "sector",
              "label": "Setor (opcional)",
              "type": "short_text",
              "required": false,
              "options": []
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            }
          ]
        },
        {
          "title": "Viagem e disponibilidade",
          "questions": [
            {
              "id": "driver",
              "label": "Você dirige até a empresa?",
              "type": "yes_no",
              "required": true,
              "options": [],
              "semanticCode": "DRIVES_TO_WORK"
            },
            {
              "id": "seats",
              "label": "Quantos assentos costuma ter livres?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "SEATS_AVAILABLE"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            },
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            }
          ]
        },
        {
          "title": "Adoção",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            },
            {
              "id": "barriers",
              "label": "Quais são suas objeções?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "HORARIO",
                "SEGURANCA",
                "DESVIO",
                "CUSTO",
                "OUTRO"
              ]
            }
          ]
        }
      ]
    }
  },
  {
    "key": "PROFISSIONAIS",
    "nature": "MOBILIDADE_LOCAL",
    "label": "Motoristas e mototaxistas",
    "description": "Perfil, operação, conectividade e adesão de profissionais",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Perfil profissional",
          "questions": [
            {
              "id": "municipality",
              "label": "Em qual município você costuma se deslocar?",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "MUNICIPALITY"
            },
            {
              "id": "vehicle",
              "label": "Com qual veículo trabalha?",
              "type": "single_choice",
              "required": true,
              "options": [
                "MOTOTAXI",
                "TAXI",
                "CARRO",
                "OUTRO"
              ]
            },
            {
              "id": "licensed",
              "label": "Possui cadastro ou licença exigida no município?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "NAO",
                "NAO_SEI"
              ],
              "semanticCode": "LICENSING_SELF_REPORT"
            }
          ]
        },
        {
          "title": "Dia a dia",
          "questions": [
            {
              "id": "channels",
              "label": "Como recebe chamados?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "PONTO",
                "WHATSAPP",
                "TELEFONE",
                "APP",
                "INDICACAO"
              ]
            },
            {
              "id": "hours",
              "label": "Em quais períodos trabalha?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "MANHA",
                "TARDE",
                "NOITE",
                "MADRUGADA"
              ]
            },
            {
              "id": "internet",
              "label": "Mantém internet móvel durante o trabalho?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "AS_VEZES",
                "NAO"
              ]
            },
            {
              "id": "issues",
              "label": "Principais dificuldades?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "INSEGURANCA",
                "CANCELAMENTO",
                "COMISSAO",
                "CONCORRENCIA",
                "PAGAMENTO"
              ]
            }
          ]
        },
        {
          "title": "Tecnologia",
          "questions": [
            {
              "id": "adoption",
              "label": "Aceitaria avaliar recebimento de chamados pelo CARONAA?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "concerns",
              "label": "Quais seriam suas preocupações?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "COMISSAO",
                "REGULAMENTACAO",
                "SEGURANCA",
                "INTERNET",
                "PAGAMENTO"
              ]
            }
          ]
        }
      ]
    }
  },
  {
    "key": "PASSAGEIROS",
    "nature": "MOBILIDADE_LOCAL",
    "label": "Moradores e passageiros",
    "description": "Diagnóstico de demanda e acesso para passageiros",
    "estimatedMinutes": 4,
    "schema": {
      "sections": [
        {
          "title": "Seu contexto",
          "questions": [
            {
              "id": "municipality",
              "label": "Em qual município você costuma se deslocar?",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "MUNICIPALITY"
            },
            {
              "id": "occupation",
              "label": "Qual é sua ocupação?",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "TRABALHADOR",
                "ESTUDANTE_TRABALHADOR",
                "PROFESSOR",
                "OUTRO"
              ],
              "semanticCode": "OCCUPATION"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            }
          ]
        },
        {
          "title": "Disponibilidade",
          "questions": [
            {
              "id": "availability",
              "label": "Consegue transporte quando precisa?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SEMPRE",
                "AS_VEZES",
                "RARAMENTE"
              ],
              "semanticCode": "AVAILABILITY"
            },
            {
              "id": "wait_minutes",
              "label": "Quanto tempo costuma esperar por transporte em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "WAIT_TIME"
            },
            {
              "id": "time",
              "label": "Quanto tempo dura o deslocamento em minutos?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "TRAVEL_TIME"
            },
            {
              "id": "cost",
              "label": "Quanto gasta, aproximadamente, por trajeto em R$?",
              "type": "number",
              "required": false,
              "options": [],
              "semanticCode": "COST_PER_TRIP"
            }
          ]
        },
        {
          "title": "Confiança e adoção",
          "questions": [
            {
              "id": "safety",
              "label": "Quão seguro considera o trajeto atual?",
              "type": "rating_1_5",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_SAFETY"
            },
            {
              "id": "trust",
              "label": "O que aumentaria sua confiança no serviço?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "IDENTIFICACAO",
                "AVALIACOES",
                "RASTREAMENTO",
                "PRECO_ANTECIPADO",
                "SUPORTE",
                "OUTRO"
              ],
              "semanticCode": "TRUST_FACTORS"
            },
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            }
          ]
        }
      ]
    }
  },
  {
    "key": "PREFEITURA",
    "nature": "MOBILIDADE_LOCAL",
    "label": "Gestão municipal",
    "description": "Planejamento institucional e interesse em piloto supervisionado",
    "estimatedMinutes": 3,
    "schema": {
      "sections": [
        {
          "title": "Diagnóstico",
          "questions": [
            {
              "id": "municipality",
              "label": "Em qual município você costuma se deslocar?",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "MUNICIPALITY"
            },
            {
              "id": "population",
              "label": "População estimada atendida",
              "type": "number",
              "required": false,
              "options": []
            },
            {
              "id": "categories",
              "label": "Modalidades presentes",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "MOTOTAXI",
                "TAXI",
                "ONIBUS",
                "VAN",
                "OUTRO"
              ]
            },
            {
              "id": "gaps",
              "label": "Quais regiões têm mais dificuldade?",
              "type": "long_text",
              "required": true,
              "options": []
            }
          ]
        },
        {
          "title": "Governança",
          "questions": [
            {
              "id": "regulation",
              "label": "Há regulamentação ou cadastro local?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "PARCIAL",
                "NAO",
                "NAO_SEI"
              ]
            },
            {
              "id": "pilot",
              "label": "Consideraria um piloto supervisionado?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "PILOT_INTENT"
            },
            {
              "id": "goals",
              "label": "Qual problema priorizaria?",
              "type": "long_text",
              "required": true,
              "options": []
            }
          ]
        }
      ]
    }
  },
  {
    "key": "OUTRA_COMUNIDADE",
    "nature": "OUTRA",
    "label": "Escuta da comunidade",
    "description": "Diagnóstico aberto sem pressupor hábitos ou soluções",
    "estimatedMinutes": 3,
    "schema": {
      "sections": [
        {
          "title": "Contexto",
          "questions": [
            {
              "id": "municipality",
              "label": "Em qual município você costuma se deslocar?",
              "type": "short_text",
              "required": true,
              "options": [],
              "semanticCode": "MUNICIPALITY"
            },
            {
              "id": "occupation",
              "label": "Qual é sua ocupação?",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "TRABALHADOR",
                "ESTUDANTE_TRABALHADOR",
                "PROFESSOR",
                "OUTRO"
              ],
              "semanticCode": "OCCUPATION"
            }
          ]
        },
        {
          "title": "Necessidades",
          "questions": [
            {
              "id": "challenges",
              "label": "Que problema de mobilidade considera mais importante?",
              "type": "long_text",
              "required": true,
              "options": []
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            }
          ]
        },
        {
          "title": "Melhorias",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "ideas",
              "label": "Que sugestão faria?",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        }
      ]
    }
  },
  {
    "key": "OUTRA_VALIDACAO",
    "nature": "OUTRA",
    "label": "Validação de uma ideia",
    "description": "Teste de aceitação e barreiras à adoção",
    "estimatedMinutes": 3,
    "schema": {
      "sections": [
        {
          "title": "Situação atual",
          "questions": [
            {
              "id": "occupation",
              "label": "Qual é sua ocupação?",
              "type": "single_choice",
              "required": true,
              "options": [
                "ESTUDANTE",
                "TRABALHADOR",
                "ESTUDANTE_TRABALHADOR",
                "PROFESSOR",
                "OUTRO"
              ],
              "semanticCode": "OCCUPATION"
            },
            {
              "id": "transport",
              "label": "Como costuma se deslocar?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "ONIBUS",
                "MOTO",
                "CARRO",
                "MOTOTAXI",
                "APLICATIVO",
                "A_PE",
                "BICICLETA",
                "OUTRO"
              ],
              "semanticCode": "TRANSPORT_MODE"
            },
            {
              "id": "difficulties",
              "label": "Quais são suas dificuldades no trajeto?",
              "type": "multiple_choice",
              "required": true,
              "options": [
                "DOR_01",
                "DOR_02",
                "DOR_03",
                "DOR_04",
                "DOR_05",
                "DOR_06",
                "OUTRA"
              ],
              "semanticCode": "MOBILITY_PAINS"
            }
          ]
        },
        {
          "title": "A proposta",
          "questions": [
            {
              "id": "adoption",
              "label": "Experimentaria uma alternativa segura de carona?",
              "type": "single_choice",
              "required": true,
              "options": [
                "SIM",
                "TALVEZ",
                "NAO"
              ],
              "semanticCode": "ADOPTION_INTENT"
            },
            {
              "id": "value",
              "label": "Quão útil seria a proposta?",
              "type": "rating_0_10",
              "required": true,
              "options": [],
              "semanticCode": "PERCEIVED_USEFULNESS"
            },
            {
              "id": "barriers",
              "label": "O que impediria sua adoção?",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        },
        {
          "title": "Considerações",
          "questions": [
            {
              "id": "comments",
              "label": "Gostaria de acrescentar algo?",
              "type": "long_text",
              "required": false,
              "options": []
            }
          ]
        }
      ]
    }
  }
];
export const MUNICIPAL_TEMPLATES=RESEARCH_TEMPLATES.filter(t=>t.nature==="MOBILIDADE_LOCAL");
export function freshTemplate(template:ResearchTemplate):SurveySchema {
 // IDs are stable within each newly-created survey and never collide between templates.
 const sections=structuredClone(template.schema.sections);
 return {sections:sections.map(section=>({...section,id:crypto.randomUUID()}))};
}
export const QUESTION_TYPES:{value:SurveyQuestionType;label:string}[]=[
 {value:"short_text",label:"Texto curto"},{value:"long_text",label:"Texto longo"},
 {value:"number",label:"Número"},{value:"single_choice",label:"Escolha única"},
 {value:"multiple_choice",label:"Múltipla escolha"},{value:"rating_1_5",label:"Escala de 1 a 5"},
 {value:"rating_0_10",label:"Escala de 0 a 10"},{value:"date",label:"Data"},
 {value:"time",label:"Horário"},{value:"yes_no",label:"Sim ou não"},
 {value:"rating_stars",label:"Estrelas (1–5)"},{value:"money_range",label:"Faixa de valores"},
 {value:"location",label:"Localidade (bairro ou município)"},{value:"ranking",label:"Ordenar opções"},
 {value:"matrix",label:"Matriz de avaliação"},{value:"contact",label:"Contato opcional"}];
