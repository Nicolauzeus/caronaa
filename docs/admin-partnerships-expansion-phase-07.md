# Departamento 06 — Parcerias e Expansão

## Implementado
- Rota administrativa /admin/parcerias.
- Cadastro e pesquisa de universidades, prefeituras, empresas, associações e cooperativas.
- Gestão das situações de relacionamento (prospecção, contato, negociação, ativa, suspensa e encerrada).
- Criação de pilotos vinculados a uma instituição e ao município cadastrado.
- Acompanhamento das situações dos pilotos.
- Visão territorial de organizações e pilotos por município, sem declarar cobertura de transporte.
- Integração com a navegação departamental.
- RLS administrativa e índices planejados na migração 0085.

## Migração
Confirmar backup antes de aplicar separadamente drizzle/migrations/0085_partnerships_expansion.sql no SQL Editor.
```sql
SELECT to_regclass('public.partner_organizations') AS organizations,
       to_regclass('public.partner_pilots') AS pilots;
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('partner_organizations','partner_pilots');
```

## Homologação
1. Entrar como Superadmin e abrir /admin/departamentos/partnerships e /admin/parcerias.
2. Criar instituição fictícia rotulada como TESTE, atribuir município, natureza e contato autorizado.
3. Alterar situação de PROSPECCAO para CONTATO e NEGOCIACAO. Recarregar e confirmar persistência.
4. Criar piloto de teste ligado à instituição. Verificar município, estado PLANEJAMENTO e critérios de sucesso.
5. Alterar o piloto para VALIDACAO e confirmar persistência.
6. Conferir contagens de instituições, parcerias ativas e pilotos ativos.
7. Validar agregação por município sem somar organizações a pilotos como se fossem pessoas.
8. Testar acesso como visitante e usuário não-admin; confirmar acesso negado.
9. Repetir em telas de 360px, 768px e desktop.
10. Executar testes e build e confirmar GitHub Actions.
11. Identificar e limpar os registros de TESTE pela rotina futura de arquivamento, sem excluir dados reais.

## Ainda pendente
- Gestão de anexos e convênios jurídicos.
- Histórico detalhado de reuniões e tarefas comerciais.
- Relatórios de resultados medidos dos pilotos e vínculos com pesquisas.
- Critérios regulatórios e financeiros de prontidão operacional.
- Implantação no Supabase e testes ponta a ponta.

Não publicar em produção sem aprovação explícita.
