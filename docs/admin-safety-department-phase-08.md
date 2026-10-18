# Departamento 07 — Atendimento, Confiança e Segurança

## Implementação
- Rota administrativa /admin/atendimento integrada em /admin/departamentos/safety.
- Registro com protocolo numérico, categorias SUPORTE, RECLAMACAO, DENUNCIA, INCIDENTE e VERIFICACAO.
- Fila com busca, categorias, prioridades e mudanças de estado.
- Métricas derivadas dos casos reais: total, em tratamento e críticos não resolvidos.
- Auditoria de mudanças de estado com trigger AFTER INSERT/UPDATE para proteger chave estrangeira.
- RLS administrativa, sem acesso público a denúncias.
- Sem anexos pessoais, sem fluxo de denúncias anônimas nem decisões automáticas sobre envolvidos.

## Migração pendente
Confirmar backup, revisar e executar individualmente drizzle/migrations/0086_safety_cases.sql no SQL Editor.
```sql
SELECT to_regclass('public.safety_cases') AS cases,
       to_regclass('public.safety_case_events') AS events;
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('safety_cases','safety_case_events');
```

## Testes guiados
1. Abrir /admin/departamentos/safety → Central de Atendimento.
2. Criar ticket de teste e conferir numeração e persistência após atualizar.
3. Alterar ABERTO → EM_TRIAGEM → EM_ANALISE → RESOLVIDO; verificar histórico na tabela events.
4. Criar denúncia fictícia claramente marcada TESTE; conferir que não existe denúncia presumida ou consequência automática.
5. Filtrar por categoria e buscar pelo protocolo.
6. Testar duas sessões admin e concorrência de atualização.
7. Usuário comum e anônimo não devem conseguir ler ou escrever tabelas privadas.
8. Testar mobile 360px/768px, acessibilidade e erros de banco.
9. Executar npm run build e npm run test, verificar Actions.
10. Não utilizar relatos sensíveis reais nesta homologação.

## Pendências
- Permissões departamentais mais restritas do que admin global.
- Protocolos públicos e suporte via aplicativo.
- Upload seguro e retenção de evidências.
- Verificação de documentação/licenças e gestão da resposta a incidentes graves.
- SLA, atribuição e notificações.
- Build, testes E2E e implantação SQL ainda não confirmados.

Não publicar produção até avaliação de segurança e privacidade.
