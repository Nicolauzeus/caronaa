# CARONAA — Release 06–09: consolidação, segurança, homologação e UX

## Inventário verificado
- 01 · Universidade Urbana — já integrado à main.
- 02 · Universidade Regional — PR #17, migration 0097.
- 03 · Eventos e Match de Saída — PR #18, sem migration nova.
- 04 · Empresas próximas às universidades — PR #19, migration 0098.
- 05 · CARONAA Corporativo Interno — PR #20, migration 0099.

A branch consolidada #21 incorpora **os cinco templates** do catálogo e resolve conflitos de UI, formulários, indicadores e journal. Modelos 02, 04 e 05 possuem verificação de readiness da migration antes da criação. Modelos anteriores não ficam bloqueados por dependências futuras.

## Prompt 06 — integração e migrations pendentes
A ordem obrigatória de SQL é:
1. `0095_reusable_research_infrastructure.sql` (instalada anteriormente)
2. `0096_research_trash_and_guarded_deletion.sql` (instalada anteriormente; numeração regularizada)
3. `0097_regional_university_market_metrics.sql` — nova, **pendente**
4. `0098_company_campus_research.sql` — nova, **pendente**
5. `0099_corporate_internal_research_access.sql` — nova, **pendente**

NÃO executar o SQL nesta entrega. Após backup e homologação, aplicar cada script em sequência e confirmar versão de schema pela RPC `get_research_schema_version()`, que reporta 97→98→99. **Não reaplicar 0095/0096** sem conciliar histórico de migrations de produção.

As versões exigidas para criar novos formulários são regional=97, empresa próxima=98, corporativo interno=99. Evento=95. Se o backend não informar a versão exigida, o cadastro desses modelos deve falhar fechado com mensagem clara.

## Prompt 07 — regras de segurança corporativa e limite de operação
Segurança de pesquisa: o acesso `COLABORADORES_DA_EMPRESA` requer conta autenticada e aprovada explicitamente por administrador com referência de RH; a aprovação é por `form_id` e `user_id`, nunca por domínio de email, selo ou link. Acesso pode ser revogado com auditoria. Validação é **no banco** no momento da consulta, envio, repetição idempotente, inscrição de interesse e reivindicação de selo.

Respostas individuais e recibos ficam associados ao autor. RLS restritiva sobre `research_forms`, `research_form_versions` e `research_answers` bloqueia leitura e gravação direta indevidas. Todas as exceções administrativas são deliberadas e exigem função autorizada, não grants diretos ao colaborador.

**As caronas corporativas reais continuam DESABILITADAS:** esta entrega NÃO introduz `company_id` nem uma camada de isolamento nas ofertas, solicitações, match, reserva, pagamento e rastreamento existentes. A pesquisa não cria carona; a UX remove a indicação que poderia encaminhar um colaborador à busca pública como se fosse um corredor corporativo.

Para ativar caronas internas de verdade, preparar separadamente uma migration e uma revisão de segurança específicas para:
- vincular cada oferta e cada solicitação a uma organização/filial validada, sem trust no payload do cliente;
- manter ofertas corporativas invisíveis na busca pública, incluindo views, RPCs SECURITY DEFINER, realtime, notificações e exportações;
- validar **bilateralmente** vínculo ativo do motorista e do passageiro nas operações de busca, criação, proposta, aceitação e reserva (incluindo passageiros adicionais);
- recusar mistura de empresa e público, troca de modalidade, contas revogadas e corridas de grupos distintos;
- preservar políticas de pagamento e segurança do transporte sem abrir uma segunda via de reserva;
- testar diretamente no PostgreSQL, inclusive tentativas de bypass via RPC e SELECT direto.
**Não ativar esse fluxo até as provas de isolamento existirem.**

## Prompt 08 — QA e proteção contra regressões
- Todas as cinco chaves oficiais devem ser únicas no catálogo.
- Clonagens recriam IDs de perguntas e suas dependências; não copiam respostas, identidade de funcionário ou permissões.
- Município, turno, origem/destino aproximados e data devem corresponder à configuração real, nunca dados simulados.
- Formulários condicionais ocultam e removem respostas irrelevantes (não dirige, não oferece, moto com mais de 1 assento).
- Dados de pesquisa: consentimento, versionamento e recibo idempotente sem confirmação de carona.
- Modelos corporativos: testagem em PostgreSQL descartável das políticas RLS, HR validation, revogação, titularidade de respostas e impossibilidade de inserir diretamente na tabela.
- BI: indicadores semânticos de todos os modelos, denominadores corretos por coorte e rotas não pessoais.
- Controle do admin: publicar, copiar, arquivar, restaurar, lixeira e exclusão protegida.
- Navegadores: mobile 360/390px, desktop, teclado, longa descrição, erro e carregamento; sem quebra de etiquetas e horários.

O teste `scripts/test-research-infrastructure.mjs` deve aplicar 0095, 0097, 0098 e 0099 na ordem declarada, além dos pré-requisitos anteriores, em PostgreSQL descartável. Não usar dados nem credenciais do Supabase produtivo.

## Prompt 09 — UX/UI mobile-first e ortografia
- Catálogo mostra o modelo, duração e número de perguntas. Antes de criar, avisa quando a migration exigida está ausente.
- Para formulários configurados, nunca permitir desativar acidentalmente a configuração institucional obrigatória.
- Mostrar textos próprios para evento, universidade regional, empresa próxima e funcionários internos.
- Mensagens de consentimento e interesse nunca devem confundir pesquisa com reserva, match confirmado, vagas operacionais ou autorização profissional.
- Campos com label próximo ao controle, clique confortável para touch, erro legível, estado de carregamento e pontos de encontro claramente distintos de endereço residencial.
- Se evento estiver operando, levar a `/buscar` e `/oferecer` reais com data, horário, rota e tolerância. Se não há ofertas, retornar lista vazia, sem match fake.
- Formulário corporativo não deve apontar para mercado público com linguagem que sugira exclusividade de funcionários.

## Checklist de implantação futura
1. Fazer backup e relatório dos objetos/migrations atuais antes de qualquer DDL.
2. Analisar os SQLs 0097→0099 no estado real do banco e resolver journal aplicado manualmente.
3. Aplicar 0097 em homologação; testar BI e RPC de readiness=97.
4. Aplicar 0098 em homologação; testar criação de pesquisa de empresa próxima e readiness=98.
5. Aplicar 0099 em homologação; testar anônimos, não membros, membros verificados, admin, revogados, recibos e badges; readiness=99.
6. Repetir com autorização explícita em produção, sem reaplicar migrations pré-existentes.
7. Só depois habilitar os modelos para uso e testar com usuários e instituições autorizadas. Nenhuma oferta corporativa real até concluir as garantias de isolamento operacional.

**Estado:** código integrado na branch de release; SQL preparado, **não executado no Supabase**. Publicação do código ≠ aprovação para ativar rotas corporativas exclusivas.
