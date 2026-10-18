# Departamento 09 — Jurídico, Compliance e Privacidade

## Entrega
- `/admin/compliance`: contratos, políticas, regulamentações, riscos e metadados de solicitações de titulares.
- Registros de título, descrição resumida, versão, município, prazo e estado.
- Filtros por categoria e indicadores calculados sobre registros reais.
- `0088_compliance_registry.sql`: tabelas RLS admin e histórico de alteração de estado.
- Sem anexos sensíveis, tratamento automático de solicitações, exposição pública ou decisões jurídicas automáticas.
- Sem alterações nas respostas históricas STS.

## Pré-requisito
Confirmar backup; revisar e aplicar individualmente `drizzle/migrations/0088_compliance_registry.sql` no SQL Editor. Não executar automaticamente todas as migrações com histórico divergente.

```sql
SELECT to_regclass('public.compliance_records') AS records,
       to_regclass('public.compliance_record_events') AS history;
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('compliance_records','compliance_record_events');
```

## Homologação
1. Abrir /admin/departamentos/compliance e /admin/compliance.
2. Criar contrato de TESTE com prazo e versão, conferir persistência.
3. Registrar requisito regulatório de TESTE por município.
4. Alterar status ABERTO → EM_ANALISE → CONCLUIDO e conferir eventos.
5. Filtrar por categorias e conferir cards sem dados mockados.
6. Testar com sessão sem login e usuário não-admin; dados devem ser inacessíveis.
7. Verificar que nenhuma exclusão irreversível e nenhum documento pessoal são solicitados na interface.
8. Validar mobile 360/768 px e desktop.
9. Executar npm run build, testes e GitHub Actions; registrar evidências.
10. Não publicar antes de homologação.

## Próximas entregas
- Canal seguro e procedimento completo para direitos de titulares;
- Consentimentos versionados, revogação e evidências;
- Contratos e anexos com armazenamento segregado e permissão restrita;
- Matriz regulatória validada juridicamente para mobilidade local;
- Trilha de auditoria transversal padronizada;
- Perfis departamentais de acesso, depois da homologação.
