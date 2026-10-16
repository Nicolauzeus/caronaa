# Central de Formularios CARONAA

## Preservacao STS 2026
Todas as respostas historicas existentes pertencem ao STS, conforme confirmacao do produto. Antes de qualquer migracao, fazer backup verificavel de form_submissions, form_submission_pain_points, form_funnel_events e tabelas relacionadas; registrar contagens e checksums. Nao excluir ou reescrever respostas originais. Backfill deve ser idempotente.

## Catalogo
Cada formulario possui UUID imutavel, codigo publico unico (exemplo STS-2026), titulo, natureza, publico, modalidade, status e versoes imutaveis apos publicacao.
Naturezas: EVENTO, EDUCACAO, EMPRESA, MOBILIDADE_LOCAL e OUTRA.
Publicos: geral, profissional, passageiro, prefeitura.
Modalidades: COMPARTILHADA, PROFISSIONAL_SOB_DEMANDA, PESQUISA_GERAL.

## Dados comparaveis
Preservar DOR_01 ate DOR_06, bem como classificacoes historicas MOTORISTA, PASSAGEIRO e AMBOS. Separar ocupacao de papel de mobilidade. Recalcular percentuais a partir de contagens de respondentes elegiveis em vez de somar percentuais de pesquisas diferentes.

## UX admin
Catalogo e busca; construtor sem codigo com blocos, tipos, condicionais e pre-visualizacao mobile; painel individual por formulario; filtros globais por dor, publico, ocupacao, natureza, municipio e periodo; comparacoes com denominadores explicitados; exportacao controlada.

## Mobilidade Local
Pesquisas separadas para mototaxistas/motoristas, moradores e prefeitura no mesmo projeto municipal. Validar adesao, demanda, internet, custos, seguranca e adequacao regulatoria antes de desenvolver corridas profissionais em tempo real.

## Entregas sequenciais
1. Backup e auditoria do STS. 2. Migration aditiva do catalogo e versoes. 3. Editor e publicacao. 4. Respostas e dashboard por pesquisa. 5. BI transversal e testes RLS, integridade e acessibilidade.
