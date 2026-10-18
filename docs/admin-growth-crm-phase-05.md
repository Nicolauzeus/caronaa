# Departamento 04 - Crescimento, Marketing e CRM

## Implementado
- /admin/crescimento: indicadores reais calculados a partir dos registros de CRM, busca, filtro e atualização de leads.
- Registro administrativo de leads com nome, contato e indicação explícita de autorização de contato.
- Campanhas com código estável, canal, instituição e situação.
- /formulario/$code: convite opcional de cadastro somente depois da resposta ser salva.
- A pesquisa pública permanece anônima; cadastro não é requisito para responder.
- Catálogo de departamentos atualizado e RLS admin preparado na migração 0084.

## Pré-requisito SQL
Confirmar backup e aplicar individualmente a migração 0084_growth_crm_foundation.sql, sem executar o histórico inteiro.
```sql
SELECT to_regclass('public.crm_leads') AS leads,
       to_regclass('public.crm_campaigns') AS campaigns;
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('crm_leads','crm_campaigns');
```

## Homologação guiada
1. Superadmin abre /admin/departamentos/growth, depois /admin/crescimento.
2. Cria campanha UNILAB de teste com código único, canal e instituição.
3. Cria lead manual com nome e e-mail ou WhatsApp. Verifica a opção de consentimento de contato.
4. Filtra por nome e status, atualiza NOVO para QUALIFICADO e confirma após recarregar.
5. Testa código de campanha duplicado (deve falhar); testa formulário sem contato (não deve salvar).
6. Loga como usuário comum e verifica bloqueio do Admin; usuário anônimo não pode consultar crm_leads.
7. Preenche uma pesquisa publicada e vê o convite para cadastro só após resposta ser aceita.
8. Cancela o cadastro e confirma que a resposta continua salva.
9. Verifica layout em 360px, 768px e desktop; navegação por teclado e erros.
10. Executa npm run build, npm run test e GitHub Actions e registra resultados.

## Não homologado / próximos trabalhos
- Identidade única de lead e deduplicação verificada;
- Atribuição persistente UTM e origem do questionário à conta criada;
- Consentimentos versionados com evidência de origem;
- Automação de contatos e retenção;
- Conversão pesquisa -> conta -> primeira viagem com vínculo comprovado.
Não presumir conversões: dashboard só conta registros efetivos de CRM.
Migração não aplicada nesta entrega; sem publicação em produção.
