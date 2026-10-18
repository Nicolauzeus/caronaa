# CARONAA Admin Enterprise — Departamento 01: Direção e Estratégia

## Entrega
- Rota privada `/admin/executivo`, integrada à biblioteca de departamentos.
- Indicadores reais de operações e funil dos últimos 30 dias, reutilizando os serviços existentes.
- Gestão persistente de OKRs, decisões e riscos em `executive_records`, com ações criar, atualizar estado e realização.
- Histórico de alterações em `executive_record_history` (somente leitura administrativa).
- Sem indicadores simulados, sem novas contas/perfis.
- `AdminGuard` e RLS mantidos; Superadmin com função `admin` possui acesso.

## Migração pendente
Backup obrigatório antes de aplicar `drizzle/migrations/0080_executive_governance.sql`.
Não executar o runner completo de migrações se o histórico ainda estiver fora de sincronia. Revisar e aplicar individualmente após backup, como realizado com 0078 e 0079.

## Checklist do teste
1. Abrir `/admin/departamentos/executive`, clicar nas categorias e entrar em `/admin/executivo`.
2. Verificar que os indicadores coincidem com as respectivas fontes no Admin atual para o mesmo período de 30 dias.
3. Se alguma RPC falhar, validar que o valor é N/D e há mensagem de fonte indisponível.
4. Criar OKR com meta numérica e prazo; atualizar realizado; conferir cálculo e persistência após recarregar.
5. Criar decisão estratégica, alterar para EM_ANDAMENTO e depois CONCLUIDO.
6. Registrar risco com prioridade CRITICA e prazo. Conferir persistência.
7. Verificar `executive_record_history` para cada INSERT/UPDATE e usuário ator.
8. Tentar acessar a rota como visitante e como usuário não-admin; o acesso deve ser negado.
9. Testar layout no desktop e em 360px e 768px, inclusive formulários, tabs e indicadores.
10. Rodar `npm test`, `npm run build` e verificar GitHub Actions no commit.
11. Não publicar produção até concluir os testes.

## SQL de verificação (após instalação)
```sql
SELECT to_regclass('public.executive_records') AS records,
       to_regclass('public.executive_record_history') AS history;
SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('executive_records','executive_record_history');
SELECT count(*) AS registros FROM public.executive_records;
```

## Não concluído
- A aplicação da migração no Supabase não foi executada nesta entrega.
- Não foram executados testes end-to-end com credenciais reais.
- Para manter registros íntegros, a interface não oferece exclusão física.
- OKRs possuem meta e realizado, mas a modelagem hierárquica de múltiplos resultados-chave e responsáveis será refinada em fase posterior.
