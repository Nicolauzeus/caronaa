# Departamento 02 — Tecnologia e Produto

## Implementado na main
- Página /admin/tecnologia.
- Abas de incidentes técnicos, bugs, melhorias e releases.
- Formulários de registro e atualização de situação, com persistência após a migração.
- Severidade, componente, referência HTTPS e registro histórico.
- Políticas RLS administrativas e trilha de auditoria de inserts/updates.
- Navegação pela biblioteca de departamentos.
- Estados N/D explícitos para telemetria ainda não instrumentada.

## Pré-requisito
Revisar backup e executar individualmente a migração 0081_technology_product_management.sql no SQL Editor. Não disparar o runner completo caso o histórico esteja divergente.
Verificação:
```sql
SELECT to_regclass('public.tech_work_items') AS items,
       to_regclass('public.tech_work_item_events') AS events;
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('tech_work_items','tech_work_item_events');
```

## Teste guiado
1. Abrir /admin/departamentos/technology e /admin/tecnologia.
2. Criar incidente com severidade ALTA e serviço afetado.
3. Alterar incidente para EM_ANDAMENTO e RESOLVIDO; conferir persistência e resolved_at.
4. Criar BUG com link para GitHub e conferir abertura segura.
5. Registrar melhoria e release; verificar filtros por tipo.
6. Conferir histórico CREATE/UPDATE no banco.
7. Recarregar página e conferir integridade.
8. Confirmar bloqueio de /admin/tecnologia para visitante e usuário sem acesso.
9. Testar responsividade 360px/768px/desktop e navegação por teclado.
10. Executar npm run test e npm run build e verificar Actions.
11. Não publicar produção até homologação.

## Limitações transparentes
Disponibilidade de serviços, métricas de APIs, integrações e logs centralizados ainda exigem instrumentação e fonte confiável. Não há monitoramento ativo implementado nesta rodada.
