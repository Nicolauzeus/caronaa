# CARONAA — Correção de publicação e exclusão segura de pesquisas

## Contexto
A função original `publish_research_form` tinha validações frágeis, inclusive na consulta de perguntas condicionais. O botão de publicar ficava no fim do editor e era bloqueado sem mensagens suficientemente claras. A única exclusão existente era `delete_empty_research_draft`, limitada a rascunhos nunca publicados.

## Entrega no código
- `/admin/formularios`: botão primário **Revisar e publicar** em cada rascunho, e **Arquivar / Excluir** para formulários, exceto os históricos encerrados.
- `/admin/formularios/:code`: botões próprios para publicar/abrir nova versão e arquivar/excluir; atualização do status após publicação.
- Editor: ação de publicação no cabeçalho, pendências visíveis e verificação da resposta booleana da RPC.
- Diálogo de gerenciamento: consulta administrativa ao banco sobre respostas, registros históricos, leads e pilotos; exige digitar exatamente o código antes da exclusão definitiva.
- Publicado sem respostas/vínculos: pode ser excluído permanentemente, incluindo versões.
- Publicado com respostas ou vínculos: **não** permite exclusão permanente; permite arquivamento, que desabilita novas respostas e preserva a informação.
- Pesquisa histórica ENCERRADO: permanece protegida.
- Migração 0092: duas funções administrativas de elegibilidade/exclusão e correção transacional da publicação. É aditiva para dados; não exclui registros por conta própria.

## Procedimento seguro
1. Conferir backup do banco Supabase.
2. Revisar e aplicar **somente** `drizzle/migrations/0092_research_publication_and_safe_removal.sql` no SQL Editor. Não reexecutar indiscriminadamente o histórico de migrações.
3. Em aba anônima, confirmar que funções administrativas rejeitam usuário não-admin.
4. Validar o diagnóstico read-only:

```sql
SELECT to_regprocedure('public.publish_research_form(uuid,uuid,jsonb)') AS publish,
       to_regprocedure('public.get_research_form_removal_eligibility(uuid)') AS removal_audit,
       to_regprocedure('public.delete_unanswered_research_form(uuid,text)') AS remove_empty;
SELECT f.code,f.status,f.is_enabled,
 (SELECT count(*) FROM public.research_answers a WHERE a.form_id=f.id) AS answers,
 (SELECT count(*) FROM public.form_submissions s WHERE s.research_form_id=f.id) AS historic_submissions,
 (SELECT count(*) FROM public.crm_leads l WHERE l.source_form_id=f.id) AS crm_leads,
 (SELECT count(*) FROM public.partner_pilots p WHERE p.research_form_id=f.id) AS pilots
FROM public.research_forms f ORDER BY f.code;
```

## Testes guiados (NÃO usar pesquisa histórica real como cobaia)
1. `TESTE-25`, rascunho de 4 seções e 13 perguntas: abrir /admin/formularios/TESTE-25, escolher **Revisar e publicar**, corrigir eventuais pendências, confirmar publicação e checar status `PUBLICADO` com `is_enabled=true`.
2. Abrir a pesquisa em janela anônima, preencher todos os campos relevantes e confirmar uma resposta de teste somente se o ambiente permitir.
3. Criar uma nova pesquisa fictícia isolada, publicar **sem receber respostas**, entrar em **Arquivar / Excluir**, digitar exatamente o código e excluir. Confirmar que formulário e versões desaparecem.
4. Criar uma segunda pesquisa fictícia, publicar, receber uma resposta de teste, abrir exclusão: a opção permanente deve estar bloqueada; **Arquivar** deve desativar o link, mas preservar a resposta.
5. `UNILAB-2026-NOV`: possui respostas reais. Não excluir. A interface deve informar os vínculos e oferecer apenas arquivamento.
6. `STS-2026`: histórica, encerrada e protegida; não permitir exclusão pelo Admin.
7. Validar 360px, 768px, desktop, foco de teclado, confirmação de exclusão e erros RPC.
8. Executar `npm test`, `npm run build` e CI; não publicar em produção sem homologação.

## Limitações e cautelas
- Arquivar não apaga respostas nem as oculta da análise do Superadmin; apenas impede novas respostas públicas.
- Exclusão definitiva é irreversível e permitida somente quando comprovadamente não existem respostas nem vínculos.
- Esta entrega não implementa destruição regulamentada de dados pessoais; quando essa for necessária, exige fluxo jurídico/privacidade com retenção, exportação e trilha de auditoria.
- Testes de UI, build e execução real da migração ainda devem ser registrados em homologação.
