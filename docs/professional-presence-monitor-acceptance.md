# Monitoramento de presença profissional — homologação

## Entregue
- Painel administrativo em /admin/operacoes com profissionais disponíveis, indisponíveis e último sinal.
- Consulta atualizada a cada 15 s e assinatura de eventos Realtime do Supabase (fallback polling).
- Sinal com intervalo de 30 s enquanto a página do profissional está visível.
- Sessões passam a offline no painel após 90 s sem heartbeat, sem depender de evento de desconexão.
- Controle voluntário em /disponibilidade-profissional, protegido por autenticação.
- Não coleta coordenadas GPS nem ativa despacho de viagens.
- RLS impede leitura de terceiros não administradores; status não garante verificação profissional.

## Migração
Backup confirmado antes de aplicar individualmente drizzle/migrations/0083_professional_presence.sql.
Verificações:
```sql
SELECT to_regclass('public.professional_presence') AS tabela,
       to_regprocedure('public.set_professional_presence(boolean,text)') AS funcao;
SELECT policyname,cmd FROM pg_policies
 WHERE schemaname='public' AND tablename='professional_presence';
```

## Testes
1. Logar com conta de teste; acessar /disponibilidade-profissional.
2. Informar município, clicar Ficar disponível.
3. No Admin em outra sessão, abrir /admin/operacoes e confirmar novo registro online.
4. Clicar Ficar offline: estado deve atualizar.
5. Habilitar outra vez, fechar a página e esperar mais de 90 s: Admin deve mostrar offline.
6. Testar vários usuários e filtrar permissões: usuário comum deve ver apenas sua própria linha.
7. Visitante anônimo não pode consultar a tabela nem acessar Administração.
8. Simular rede offline e validar expiração.
9. Validar layout 360px, 768px e desktop.
10. Rodar npm run build e npm test; confirmar Actions.

## Não homologado / não implementado
- Verificação de identidade/licenciamento de motoristas profissionais;
- GPS contínuo, despacho e primeira aceitação, preços, segurança e pagamentos da modalidade profissional;
- Histórico operacional de pedidos por município;
- Monitoramento com navegador fechado ou aplicativo em segundo plano;
- Testes E2E e aplicação da migração.

O Admin não deve tratar `is_available` como elegibilidade de transporte, apenas como opt-in de presença para pilotos.
