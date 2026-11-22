# CARONAA — Automação de e-mail operacional (0234)

## O que entrou

- Resumo diário: solicitações do dia anterior.
- Semanal: segunda a domingo da semana anterior; disparo na segunda.
- Mensal: mês civil anterior; disparo no primeiro dia do mês.
- Fuso: America/Fortaleza, com horário configurável no módulo Histórico & Relatórios.
- KPIs: pedidos, sem aceite, aceitos, concluídos, cancelados, passageiros solicitantes, horário de pico e soma de tarifas concluídas (NÃO representa pagamento confirmado).
- E-mail HTML com números agregados e link ao histórico administrativo protegido.
- Sem anexos PDF automáticos neste estágio; impressão/PDF manual permanece no painel.

## Pré-requisitos (não ativar sem configurar)

1. Aplicar migrations 0233 e 0234 no banco, nesta ordem, e validar RLS e RPCs.
2. Definir SOMENTE no servidor CARONAA, nunca no frontend:
   - SUPABASE_SERVICE_ROLE_KEY: credencial service_role Supabase real.
   - CARONAA_REPORT_SCHEDULER_TOKEN: token aleatório de 32 caracteres ou mais.
   - RESEND_API_KEY: chave do provedor de e-mail.
   - CARONAA_REPORT_FROM: remetente em domínio verificado no provedor.
3. No GitHub, definir secrets CARONAA_REPORT_ENDPOINT (URL pública real do endpoint de disparo) e CARONAA_REPORT_SCHEDULER_TOKEN (mesmo token do servidor).
4. Após teste, definir variável de repositório CARONAA_REPORTS_ENABLED=true. A automação GitHub está DESLIGADA sem essa variável.
5. Em /admin/operacoes#history, configurar os destinatários e ativar apenas a frequência desejada.
6. Testar manualmente a execução no workflow CARONAA Operational Report Emails antes de depender da agenda automática.

IMPORTANTE: O GitHub Actions CARONAA Quality está falhando antes de receber runner, com zero etapas iniciadas. A execução agendada também pode depender da correção dessa situação na conta/repositório. Salvar uma frequência no painel não comprova um envio.

## Segurança e confiabilidade

- Os dados são agregados: nenhum GPS preciso, chave Pix, PIN, telefone ou nome individual de passageiro aparece no e-mail.
- Cadastro das frequências só por administrador, via RPC com validação; tabelas privadas com RLS e sem SELECT para usuários comuns.
- Execução somente com credencial do serviço + token Bearer; o servidor confere token em tempo constante.
- Log individual por destinatário e período, com unicidade; máximo de cinco tentativas e reprocessamento após 15 minutos.
- Idempotency-Key por destinatário e período na API Resend; a API controla duplicação de requisições no intervalo de suporte dela.
- Status SENT significa aceite do provedor, não prova de entrega na caixa postal; confirmação de entrega via webhook é trabalho futuro.
- Nenhum campo de destinatário é incluído no conteúdo do e-mail enviado a outras pessoas.
- Os agendamentos começam todos desligados. Se faltar qualquer credencial, o endpoint recusa o envio.

## Checagem somente leitura

SQL:
SELECT cadence,enabled,local_hour,cardinality(recipients) AS recipient_count
FROM public.caronaa_ops_report_schedules ORDER BY cadence;

SELECT cadence,window_start,window_end,status,attempts,updated_at
FROM public.caronaa_ops_report_deliveries ORDER BY updated_at DESC LIMIT 20;

Não persistir chaves reais no GitHub, no frontend ou em documentos anexados.
