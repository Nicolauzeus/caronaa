# CARONAA F01 — Pesquisa acadêmica expressa V2 (novos rascunhos)

## Compatibilidade e publicação

- O schema `ACADEMIC_EXPRESS_V1` e os históricos de UNIFOR (código público `0K9K09K`) não são atualizados. UNILAB e formulários tradicionais permanecem no motor atual.
- Novos rascunhos `F01_UNIVERSIDADE` com a opção **Experiência acadêmica expressa** usam `ACADEMIC_EXPRESS_F01_V2`. Rua e empresa mantêm o modelo simplificado F01 de três etapas.
- Para a campanha UNIFOR já publicada, `0117_unifor_f01_v4_rollout.sql` cria exclusivamente a **versão 4**, sem atualizar/despublicar a v3 nem alterar respostas anteriores, e registra `unifor.br` na configuração do domínio. **Só executar após o frontend V2 e a migration 0116 estarem validados.** O código dessa migration é específico à campanha histórica; o criador e a experiência de runtime permanecem dinâmicos.
- Para novos formulários, não é criada uma versão publicada sem ação explícita no Admin. Requer `research_configurations`, `research_lead_contacts` e `0110_research_survey_window`.
- `0116_academic_f01_domain_hint_and_guard.sql` é aditiva: indicador de domínio no lead, proteção no servidor de dores sociais, capacidade de motocicleta e 1–4 vagas nas respostas F01 V2. Exige execução controlada após validação. Nenhuma migração foi aplicada por este PR.

## Fluxo e privacidade

1. Nome completo, vínculo (quatro opções) e e-mail autorizado para contato.
2. Passageiro, motorista ou ambos; seleção avança automaticamente.
3. Região de origem, destino editável (campus configurado), dias e horário. GPS só mediante toque; a busca reversa produz o nome aproximado da localidade e **não grava coordenadas precisas**.
4. Campos específicos do perfil, depois a **única** seleção de dores sociais com até três respostas, dor principal e texto Outra. Dois painéis compactos na mesma etapa 4; nenhuma redundância entre papéis.
5. Resumo, aceite da pesquisa, autorização separada para identificação por e-mail, marketing opcional e registro de interesse **também opcional**. Ambos pode autorizar registro de interesses de passageiro e motorista.

Envio: `submit_configured_research_answer` grava respostas e rotina de forma idempotente; `capture_research_lead` grava contato no CRM; `register_research_interest` grava intenção declarada somente com aceite. Responder **não** registra viagem, oferta, reserva, pagamento ou acesso especial. O domínio configurado para o e-mail é apenas um indício, não prova de titularidade/matrícula.

O pré-lançamento exibe dias até a data configurada e preserva separação entre diferentes formulários/contagens. Sem data de início, não promete viagem inaugural.

## Validação e rollout

1. Validar permissões de Admin e dependências DB: 0095, 0103, 0110, 0113 e migrations 0116/0117. Executar 0116 em homologação primeiro; validar frontend; depois 0117 para UNIFOR com backup, auditoria prévia v3 e observabilidade.
2. `npm install --no-audit --no-fund` (o repositório tem lockfile em atualização), `npx tsc --noEmit`, `npm test -- src/lib/formulario src/components/research/AcademicExpressForm.test.tsx src/components/admin/SimpleResearchCreator.test.tsx`, `npm run build`.
3. `node scripts/test-research-navigation.mjs` com Playwright disponível. Verificar 375×667 e 393×852, com screenshots de cinco etapas (painel adicional da quarta etapa incluído).
4. Testar no Admin `TESTE-CAMPUS` com região não cadastrada, domínio arbitrário, rascunho, revisão e publicação explícita. Testar também RPC indisponível, concorrência de código e falha com cleanup.
5. Validar como visitante e conta confirmada; e-mails institucionais e comuns; perfis Passageiro/Motorista/Ambos; consentimento de contato, retorno em erro parcial e participação em duas campanhas.
6. A publicação e as migrations são ações operacionais separadas do merge no GitHub. Não aplicar `0113` novamente para converter formulários legados; a transição UNIFOR v3 → v4 é feita exclusivamente pela `0117` após os testes do V2.

## Critérios que não podem ser simulados

- Não afirmar que há carona inaugural marcada ou matches garantidos apenas por responder.
- Não liberar cadastro sem verificação por coincidência do domínio.
- Não ocultar campos num aparelho com teclado aberto só para afirmar 'zero scroll'; a página usa altura do viewport e contém o formulário, com rolagem interna apenas quando estritamente necessária.
- Testes e screenshots devem ser executados de fato; a existência dos testes no repositório não equivale a uma execução aprovada.

## Revisão 27/10/2026 — Express Glass e UNILAB-1

- A experiência acadêmica Express F01 V2 foi reduzida a **nove campos no schema**: nome, vínculo, papel, prioridade do passageiro, veículo, vagas e as três perguntas semânticas de dores (incluindo Outro). Valores `DOR_XX`, custo/orçamento, modelo do veículo e demais perguntas legadas não aparecem na versão nova.
- Uma seleção de prioridade do passageiro ou vagas do motorista avança para o painel único de dores sociais da etapa 4. A etapa 5 apresenta opção principal de **pré-agendar interesse** (autorização pelo próprio clique, com os demais consentimentos) e alternativa para enviar **somente a pesquisa**. Não cria nem promete uma viagem real.
- A identificação visual do domínio aparece em verde imediatamente para qualquer domínio cadastrado em `research_configurations.settings.institutionalEmailDomains`, **sem autorizar acesso, verificar matrícula ou dispensar autenticação**. Nome da instituição, título, campus, data e fuso vêm da configuração do Admin, não da URL.
- O editor `/admin/formularios/:codigo` permite criar uma versão Express V2 nova ou aplicar o modelo ao rascunho, com atalho para edição de campanha, datas e domínios. Nunca sobrescreve versões publicadas. A prévia Express é a mesma experiência interativa de cinco etapas, em largura de iPhone, mas em modo **sem persistência** de respostas, leads ou interesses.
- Nova migration `0118_unilab_f01_v5_rollout.sql`: somente `UNILAB-1`, espera V4 publicada e guarda server-side 0116 já instalada. Publica V5 com Express V2, acrescenta `unilab.edu.br` à lista de domínios reconhecíveis, preserva a data de lançamento existente e mantém as respostas e versões V1–V4. **Não foi aplicada nesta alteração do GitHub**.
- A migration ainda pendente `0117_unifor_f01_v4_rollout.sql` foi alinhada à mesma versão essencial de nove campos, conservando a V3 histórica.
- Browser checks reforçados para 375×667 e 393×852: overflow horizontal, rolagem da página **e do painel de cada etapa**, screenshots. Requerem execução real com Playwright, TypeScript e Vite; adição de testes não comprova aprovação.

**Importante:** a migration automática 0118 e o botão de criação manual de versão Express do Admin são **rotas alternativas**. Se alguém já criou a V5 editável, a migration 0118 deve abortar e a versão deve ser revisada/publicada pelo próprio Admin; nunca force uma segunda V5 ou substitua a versão publicada. A configuração de domínio e data continua específica de cada formulário.

## 27/10/2026 — UNILAB como padrão visual e dores obrigatórias para passageiros

- A experiência pública acadêmica aprovada usa o mesmo layout da UNILAB: cinco etapas, cabeçalho escuro, cards Glass, dias em chips e dois seletores de hora (ida/retorno). A UNIFOR deve usar este mesmo componente público após migração de schema, sem um fork de interface.
- A tela de rota de **todas** as versões acadêmicas exibe explicitamente **Minha localização** e **Buscar localização** no celular. Busca aceita sugestões e entrada manual; GPS somente após consentimento; persistir apenas região aproximada, nunca endereço residencial ou coordenadas precisas.
- **PASSAGEIRO e AMBOS mantêm obrigatoriamente** a pergunta `MOBILITY_PAINS` e a dor principal `MOBILITY_PRIMARY_PAIN` (com `MOBILITY_OTHER_PAIN` condicional), num painel da etapa 4. Somente **MOTORISTA** pula o painel de dores.
- O banco auditado estava em UNILAB-1 V8 `ACADEMIC_EXPRESS_V1` e UNIFOR V3 `ACADEMIC_EXPRESS_V1` sem os campos de dor publicados. A migração `0121_university_express_passenger_pains_unification.sql` cria novas versões `ACADEMIC_EXPRESS_F01_V2` com dores para passageiros (UNILAB V8→V9, UNIFOR V3→V4). Ela aceita o rascunho V4 da UNIFOR **apenas enquanto permanecer idêntico à versão publicada**. Caso o Admin o edite, a migração abortará para evitar perder trabalho.
- A migração exige frontend compatível e as migrações 0116/0119 já aplicadas, preserva todas as versões publicadas anteriores e suas respostas. A aplicação no banco não é feita automaticamente pelo merge.
- A configuração institucional da UNILAB mantém campus LIBERDADE; a UNIFOR recebe campus Edson Queiroz e domínio unifor.br apenas na configuração do banco, nunca como regra rígida em componentes compartilhados. A previsão de lançamento da UNILAB permanece definida pelo Admin (última verificação: 22/10/2026; data já passada).
- No editor administrativo, a opção de prévia interativa abre o mesmo formulário real com cinco etapas para todas as versões acadêmicas, sem persistir dados. Preserva-se o construtor avançado de perguntas como editor, não como prévia do público.
- Testes atualizados: identidade com dropdown, ida/retorno, busca manual sem GPS, visibilidade dos dois botões no V1 e no V2, PASSAGEIRO/AMBOS com dores, MOTORISTA sem dores, migração append-only e histórico.
