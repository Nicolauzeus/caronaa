# CARONAA — Bússola de Desenvolvimento e Governança Funcional

**Versão:** 1.0  
**Data-base:** 07/11/2026  
**Objetivo:** relacionar produto (F01–F09), setores administrativos, regras de negócio, dependências e controles futuros, orientando ChatGPT, Codex, Lovable e desenvolvedores.

> **Hierarquia de referência:** o [README](../README.md) é o contrato canônico do produto; o [AGENTS.md](../AGENTS.md) orienta a execução técnica. Este documento complementa os dois. Em divergências, **não substituir a regra existente sem decisão explícita e registrada**. A existência de uma tela, migration ou teste **não comprova deploy, homologação nem operação em produção**.

## 1. Legenda para status e decisões

- **CÓDIGO IDENTIFICADO:** existe arquivo, migration, rota ou contrato no repositório; requer confirmação de aplicação, testes e funcionamento.
- **INFORMADO PELO PRODUTO:** comportamento reportado no mapeamento de negócio, ainda sem auditoria funcional completa.
- **PARCIAL:** há estrutura reutilizável, mas a capacidade descrita não está integralmente comprovada.
- **PROPOSTO:** requisito de evolução, **não** funcionalidade disponível.
- **DECISÃO PENDENTE:** número, política ou regra conflitante que não pode ser arbitrado por implementação silenciosa.

Os status abaixo são fotografia documental de 07/11/2026, não substituem testes, inspeção do banco ativo nem evidências de produção.

## 2. Organograma funcional e autoridade por domínio

| Setor | Responsabilidade / decisão | Rotas administrativas |
| --- | --- | --- |
| Tecnologia & Produto | Regras técnicas, Google Maps/Places/Routes, disponibilidade, observabilidade, configurações e integração Asaas; jamais expor segredos. | `/admin/tecnologia` |
| Operações & Tráfego | Elegibilidade e fila de acesso ao radar, oferta/demanda, cidades habilitadas, despacho, viagens e segurança operacional. | `/admin/operacoes` |
| Financeiro & Repasses | Comissão comercial, Pix, reconciliação, faturas, comprovação de quitação, dívida, repasses, estornos e auditoria financeira. | `/admin/financeiro` |
| CRM & Relacionamento / Atendimento | Dossiê unificado, jornada do usuário, suporte, cancelamentos, reclamações, disputas e consentimento de contato. | `/admin/relacionamentos`, `/admin/atendimento` |
| Crescimento & Parcerias | Pesquisas, comunidades UNIFOR/UNILAB, novas instituições, campanhas, embaixadores e catálogo local do Ceará. | `/admin/crescimento`, `/admin/parcerias` |
| Compliance & Segurança | LGPD, consentimentos, auditoria, acesso privilegiado, moderação de denúncias/avaliações e validação regulatória da modalidade profissional. | `/admin/compliance` |
| Executivo / Diretoria | Liquidez de oferta e demanda, conversão, margem líquida, viagens concluídas, riscos e aprovação de políticas comerciais relevantes. | `/admin/executivo` |

Uma ação intersetorial deve ter **um setor dono da regra**, co-responsáveis e registro de auditoria. A permissão de leitura não implica permissão de alteração: aplicar RBAC/RLS/RPC do servidor.

## 3. Matriz de módulos F01–F09

| Módulo | Capacidade principal | Dono da regra | Co-responsáveis |
| --- | --- | --- | --- |
| **F01 — Pesquisas e Validação** | Formulários STS, universidade, rua e empresa; dores reais, contato e consentimento; versões de formulário preservadas. | Crescimento | CRM, Compliance |
| **F02 — Perfil, Veículo e Preferências** | Conta única, perfil, avatar, carro/moto, placa declaratória, gênero, Carona Mulher, música e bagagem. | Operações | Compliance, Tecnologia |
| **F03 — Oferecer Compartilhada** | Trajeto, pontos de parada, vagas, rota estrita/desvios, contribuição proporcional ao trecho contratado. | Operações | Tecnologia, Financeiro |
| **F04 — Recorrências** | Rotinas semanais, pausa/cancelamento de ocorrência e renovação consentida. | Operações | Tecnologia, Compliance |
| **F05 — Pedir Carona e Matching** | GPS autorizado, Google Places, busca, radar, compatibilidade por percurso/subtrecho/horário e ponto seguro de encontro. | Operações | Tecnologia |
| **F06 — Desvios e Paradas** | Sugestões de subtrecho, avaliação de impacto e aprovação prévia dos envolvidos. | Operações | Tecnologia, Compliance |
| **F07 — Corrida Direta / Piloto** | Solicitação sob demanda, elegibilidade de carro/moto, fila de autorização, disponibilidade profissional, busca e despacho. | Operações | Tecnologia, Compliance |
| **F08 — Pagamentos e Repasses** | Pix por modalidade, comissão, dívida, conciliação, gateway Asaas e avaliações pós-viagem. | Financeiro | Tecnologia, Atendimento |
| **F09 — CRM e Dossiê Unificado** | Contatos, pesquisas, participações, viagens e histórico financeiro autorizado, sem unir contatos não identificados. | CRM | Executivo, Compliance |

**Regras transversais permanentes:** uma conta com múltiplos papéis; sem CPF exigido no MVP; documentação profissional declaratória, **sem** afirmar verificação; compartilhada conserva **R$ 6/11 km rodoviários no trecho contratado**, sem transpor tarifa profissional; mapas e rotas **somente Google**; histórico imutável onde exigido; nenhuma localização ou comunicação sem consentimento cabível; nenhuma operação profissional real sem revisão legal/operacional.

## 4. Relações existentes / identificadas no código

| Relação | Evidência e estado | Lacuna ou cautela |
| --- | --- | --- |
| Operações ↔ acesso ao radar (F07) | **CÓDIGO IDENTIFICADO:** `src/components/admin/ProfessionalAccessQueue.tsx` e `src/components/admin/QuickRideAdminPanel.tsx` fornecem fila, decisão e autorização declaratória. | Aprovação para piloto não significa documentos ou licenciamento verificados; validar RPCs, RLS, migrações e fluxos ponta a ponta. |
| Operações ↔ presença profissional | **CÓDIGO IDENTIFICADO:** `ProfessionalLiveMonitor.tsx` consulta sinais a cada 15 s; considera online o último sinal há menos de 90 s. `ProfessionalRadarSync.tsx` mantém localização somente após opt-in já existente, sem GPS em segundo plano. | Presença não é, por si, elegibilidade, despacho ou mapa de corridas ao vivo. |
| Operações ↔ ativação municipal | **CÓDIGO IDENTIFICADO:** `QuickRideAdminPanel.tsx` já usa `admin_set_quick_ride_region` para os toggles **Mostrar motoristas** e **Aceitar pedidos** por município. | Não duplicar essa interface; verificar deploy e estender para raio/polos apenas se faltar no banco atual. |
| Financeiro ↔ taxa/obrigações (F08) | **CÓDIGO IDENTIFICADO:** `drizzle/migrations/0131_manual_payment_and_driver_fee_gate.sql`, `0134_payment_method_exclusivity_commission_1686.sql`, `0135_manual_pix_commission_15.sql` e `src/lib/payments/commission.ts`. | Conferir migrações aplicadas, método selecionado, comprovação e conciliação no ambiente real. Os percentuais **não são intercambiáveis**. |
| CRM ↔ pesquisas (F01/F09) | **CÓDIGO IDENTIFICADO:** `/admin/relacionamentos`, componentes de CRM e regras no README/AGENTS. | A consolidação por pessoa requer chave real informada; contato anônimo e consentimento de marketing permanecem independentes. |
| Tecnologia ↔ lançamento | **INFORMADO PELO PRODUTO:** configuração de data/hora com `validate_research_configuration`. | Validar implementação, permissões, persistência e fuso `America/Fortaleza` antes de tratar como homologado. |

**Reconciliações de regras já detectadas:**

1. **15% versus 16,86%:** o README especifica **15% líquidos** para a plataforma no modelo profissional com processamento tratado separadamente; a migration **0135** define **15% para novas confirmações MANUAL_PIX** e preserva históricos de 16,86%. O helper `src/lib/payments/commission.ts` ainda calcula uma **divisão bruta de 16,86%/83,14%** no fluxo de pagamentos integrado. Isso exige **matriz por modalidade, método de pagamento e base de cálculo** antes de tornar taxas configuráveis. Não supor que 16,86% é a taxa universal vigente.
2. **Bloqueio por débitos:** a migration **0131** implementa `pendentes < 3`, portanto bloqueia **a partir de 3 débitos em aberto**. O texto de negócio recebido dizia “acima de 3”. **DECISÃO PENDENTE:** manter o comportamento implementado até deliberação explícita; não ampliar a tolerância silenciosamente.
3. **Radar ativo por padrão:** preservar a disponibilidade já autorizada entre telas quando houver opt-in válido, mas **não criar primeiro opt-in silencioso** nem rastrear em background; `ProfessionalRadarSync.tsx` requer consentimento prévio, estado online, acesso aprovado e ausência de bloqueio.
4. **Município versus Região:** usar **Região/Polo** na interface quando representar agrupamentos como Fortaleza ou Maciço de Baturité; `municipality` pode continuar como chave operacional para municípios. Evitar pedir a mesma informação duas vezes.
5. **Asaas:** migrations acima explicitamente mantêm checkout real Asaas desabilitado no estado documentado. Implementação de split, webhooks, pagamento confirmado e estornos precisa de habilitação e homologação próprias, nunca simuladas.

## 5. Controles gerenciais propostos

### A — Política dinâmica de comissão e precificação

- **Responsável:** Financeiro (regra e aprovação), Tecnologia (implementação), Executivo (autorizações extraordinárias), Compliance (auditoria).
- **Local:** `/admin/financeiro`, com visibilidade/configuração técnica coordenada em `/admin/tecnologia`.
- **Proposta de dados:** inventariar antes `platform_fee_config`, `ride_payment_policy`, `driver_platform_fees` e helpers de cotação. Criar `platform_settings` **somente se for a modelagem adequada**, sem duplicar fontes de verdade.
- **Escopo dos parâmetros:** categoria CAR/MOTO, modalidade, método Pix manual/Asaas, região/campanha opcional, percentual, vigência, versão, motivo, autor, aprovador e histórico. **15%, 16%, 12%, 0% e 20% são exemplos, não mudanças aprovadas.**
- **Invariantes:** cálculo autoritativo no servidor; permissão específica de escrita; validação de limites e vigência; alterações não retroativas; cada viagem/débito retém o snapshot da taxa e preço aceitos. Não reprecificar corrida confirmada; não misturar tarifa solidária F03 e tarifa comercial F07.
- **Interface:** percentual explícito, prévia de impacto em viagem fictícia identificada como **simulação**, salvamento com confirmação, motivo e trilha de auditoria. Nunca armazenar chaves secretas do Google/Asaas em tabela legível pelo frontend.
- **Aceite:** configuração persistida e respeitada por servidor/UI; concorrência e replay seguros; comprovante/split/repasse reconciliados; histórico inalterado; cobertura de RLS/limites e reversão de vigência.

### B — Torre de Controle de Rastreamento (Google Maps)

- **Responsável:** Operações (monitoramento/ação), Tecnologia (telemetria/limites de APIs), Compliance (privacidade).
- **Local:** aba `Rastreamento ao vivo` em `/admin/operacoes`, sem substituir o monitor de presença existente.
- **Dados separados:** (i) profissional disponível e habilitado, com heartbeat recente; (ii) viagem ativa, seus participantes e estado; (iii) última localização **consentida e autorizada** com carimbo de tempo. Online não equivale a GPS válido.
- **Mapa:** marcadores de profissionais elegíveis e localização permitida; linha amarela da rota operacional conhecida para viagens em andamento; origem/destino e idade do sinal. Não desenhar trajetória inventada nem expor dados a administradores sem permissão.
- **Alerta proposto:** possível viagem parada por mais de **10 minutos**, somente se existirem localização com qualidade suficiente e estado em andamento; diferenciar sem movimento, sinal ausente e app fechado, evitando alarmes falsos.
- **Limites:** usar Google Maps/Routes exclusivamente; consultas eficientes com limites/quota e atualização proporcional à necessidade; não reter GPS preciso além da política de retenção; cessar compartilhamento no encerramento/cancelamento ou revogação.
- **Aceite:** viagem teste observável com consentimento; expiração de sinal; revogação; restrições RLS; indisponibilidade da API com erro honesto; segurança e custo de chamadas medidos.

### C — Cidades/polos e raio de atuação

- **Responsável:** Operações, com Tecnologia e Compliance.
- **Situação:** toggles por município de descoberta/despacho já aparecem no código de F07. **Não recriar** controles equivalentes.
- **Evolução proposta:** catálogo organizado por região/polo, inclusive **Fortaleza, Redenção, Acarape e Baturité** conforme autorização operacional; raio máximo de busca parametrizado (ex.: **5 km ou 10 km**, apenas exemplo); estado de funcionamento diferenciado para compartilhada e profissional; auditoria de quem alterou, quando e por quê.
- **Aceite:** mudanças autenticadas pelo admin propagam-se ao servidor de matching/despacho sem SQL manual recorrente; região desligada não aceita novos pedidos profissionais, sem apagar ou abandonar viagens já contratadas; testes de fronteira e cache.

### D — Tickets de cancelamento, encontro e disputas

- **Responsável:** Atendimento (tratamento), Financeiro (liberação, estorno), Operações (fatos da viagem), Compliance (auditoria).
- **Local:** `/admin/atendimento`, vinculado ao dossiê em `/admin/relacionamentos`.
- **Fluxo:** evento/cancelamento → ticket com viagem, atores e evidências autorizadas → classificação/SLA → decisão fundamentada → ação financeira **se houver pagamento confirmado e autorização** → notificação → encerramento auditável.
- **Aceite:** nenhuma duplicação de estorno, idempotência de webhooks/ações, privacidade, segregação de permissões, rastreabilidade e recurso/reabertura quando aplicável.

## 6. Ordem de execução recomendada

1. **P0 — Auditoria de política financeira:** validar o que está aplicado (0131, 0134, 0135), quais percentuais se aplicam a **MANUAL_PIX** e **ASAAS_PIX** e a base bruta/líquida; formalizar decisão 15%/16,86% antes de qualquer controle editável.
2. **P1 — Comissão administrável:** planejar contrato versionado; implementar banco, RPC/RLS, admin Financeiro/Tecnologia e testes sem afetar carona compartilhada nem débitos históricos.
3. **P2 — Torre de Controle:** reutilizar presença e fluxo F07; adicionar telemetria de viagens com consentimento, Google Maps, alarmes fundamentados e controles de custo.
4. **P3 — Raio por região:** estender os toggles já existentes com configuração geográfica auditada e integração ao despacho.
5. **P4 — Disputas e estornos:** tickets vinculados à viagem e conciliação, com autorização dupla quando sensível.

**Critério de priorização:** parametrização financeira **primeiro**, porém após conciliar as regras contraditórias. A Torre de Controle é a segunda entrega estrutural.

## 7. Procedimento obrigatório para futuras alterações

1. Ler `README.md`, `AGENTS.md` e **esta bússola**; indicar F01–F09, setor dono e comportamento esperado.
2. Localizar rotas, componentes, serviços, funções SQL, migrations e testes reais antes de propor algo novo.
3. Informar separadamente **existente no código**, **aplicado no banco**, **homologado**, **em produção**, **parcial** e **proposto**; não confundir essas etapas.
4. Avaliar impacto em preço/repasse, autorização, RLS, consentimento LGPD, despacho, CRM, mapas e retrocompatibilidade.
5. Implementar mudanças pequenas, versionadas e reversíveis; não reescrever histórico de pagamento ou pesquisas.
6. Testar happy path, erros, permissões, concorrência, sessão vencida, mobile e integração; registrar evidência objetiva.
7. Ao concluir, atualizar este guia e o roadmap com: **módulo, setor, alteração, migração, evidência de teste, estado real e riscos**.

**Regra final:** documentação gerencial orienta decisões; a comprovação funcional vem de código, banco, testes e operação. Nada neste documento autoriza automaticamente cobrar, rastrear pessoas, habilitar transporte profissional ou substituir contratos vigentes.
