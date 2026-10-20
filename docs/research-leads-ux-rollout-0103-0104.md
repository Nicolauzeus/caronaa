# CARONAA — pesquisa responsiva, vagas e leads captados

## Escopo
- Modelos novos e telas de pesquisa: até 7 vagas reais para passageiros (motos: 1).
- Formulário mobile-first com contador e validação contextual.
- Captura de e-mail consentida, **somente após ativar na configuração de cada pesquisa**.
- Conclusão resumida em uma CTA; registrar interesse é opcional e recolhido.
- CRM > Crescimento: novos contatos de pesquisa separados dos leads manuais; filtro de conta e consentimento; paginação de 20 itens; totais no servidor.

## Pré-requisitos de banco
As migrations `0103_research_lead_capture_crm.sql`, `0104_seven_passenger_seat_capacity.sql` e `0105_research_dynamic_field_limits.sql` foram somente versionadas. **Não estão aplicadas em produção**. Executar após backup, no ambiente de homologação, em ordem, uma a uma.

O SQL 0103 depende de 0094, 0095 e 0099.
O SQL 0104 exige as funções do modelo de pesquisas e de oferta de caronas já instaladas. O SQL 0105 protege no servidor os limites dinâmicos de caracteres e múltipla escolha. Se a implementação local dessas funções difere, o upgrade aborta com erro e requer revisão explícita; não ignore.

## Ativação do formulário
1. Confirmar o deploy das migrations e os testes de permissões.
2. Abrir Admin > Formulários > pesquisa específica > configuração institucional.
3. Ativar **Captura de e-mail e inteligência de leads** e salvar.
4. A UI consulta `research_contact_capture_enabled(form_id)` e só solicita e-mail se banco **e** configuração estiverem prontos.
5. Não reescrever respostas ou versões publicadas. A mudança de política de contato requer aviso atualizado e autorização apropriada.

## Limites da integração
- A seção de leads de pesquisas usa tabela privada `research_lead_contacts`, sem criar automaticamente registros duplicados em `crm_leads` (cadastro administrativo legado).
- A simples correspondência de e-mail com uma conta serve para indicadores de **existência de conta**, não prova autoria da pesquisa.
- Reconhecimento automático entre aparelhos depende de mecanismo seguro para comprovar controle do **recibo/resposta**. O envio de confirmação específica de pesquisa não está implementado neste PR; o recibo permanece como recuperação.

## Segurança
- `research_lead_contacts` é tabela privada (RLS ligado, sem SELECT direto por navegador).
- A gravação pública exige recibo imprevisível de **uma resposta realmente salva** e consentimento específico.
- Opt-in comercial é independente e inicialmente falso.
- Status de conta é apenas agregação administrativa via `auth.users`; **e-mail digitado jamais reivindica um selo**.
- Administradores do Growth e o global consultam RPCs com gate do banco; demais acessos são negados.
- Para reconhecer a participação **em outro dispositivo**, ainda é necessário comprovar a origem da submissão. Nesta versão, o recibo privado recupera o vínculo; envio de verificação de participação por e-mail depende de serviço transacional não incluído neste PR.

## SQL para homologação
```sql
-- Executar após aplicar 0103 e 0104 em homologação:
SELECT to_regclass('public.research_lead_contacts') AS contacts;
SELECT to_regprocedure('public.capture_research_lead(uuid,uuid,text,boolean,boolean)') AS capture_rpc;
SELECT to_regprocedure('public.get_admin_research_leads(integer,integer,text,uuid,boolean)') AS crm_rpc;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('public.ride_offers'::regclass,'public.ride_routines'::regclass)
  AND conname IN ('ride_offers_available_seats_check','ride_routines_seat_count_check');
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN ('capture_research_lead','get_admin_research_leads','get_admin_research_lead_metrics');
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND tablename='research_lead_contacts';
```

Conferir permissões com sessão anônima, usuário comum, administrador departamental Growth e global.
Anon não pode executar RPC de listagem nem ler a tabela de contatos.
Testar replay idempotente do mesmo recibo; recusar associação de e-mail diferente após o primeiro registro.

## Métricas
- Um contato = endereço de e-mail normalizado distinto (somente para contagens).
- Uma resposta = uma submissão; não confundir com usuário nem cadastro.
- `SEM_CADASTRO`, `CADASTRO_NAO_CONFIRMADO` e `CONTA_CONFIRMADA` são derivados do estado verificado de Auth.
- Regras de ativação operacional e taxa de primeira viagem não são inferidas deste indicador.
- Leads comerciais manuais continuam separados até reconciliação de identidade verificada.
- Sem autorização comercial, o e-mail não entra em público de disparo.

## Roteiro visual
Testar 320 / 360 / 390 / 430 px no mobile; 768 / 1024 px no tablet; 1280 / 1440 px no desktop.
Confirmar teclados e foco em erros, safe area inferior, ausência de rolagem horizontal, última etapa com input e consentimento inteiramente visíveis, tela final curta com uma CTA, detalhes de interesse recolhidos, CRM em cartões no mobile e tabela no tablet/desktop.

## Testes de aceitação
- Formulário sem ativação preserva sua experiência de captação anterior; não exige novo campo.
- Com ativação, exige e-mail e consentimento do vínculo, sem exigir consentimento comercial.
- 1,4,5,7 válidos para oferta; 0 permitido somente em perguntas de investigação; 8 ou decimais inválidos.
- Moto não pode afirmar disponibilidade superior a 1 passageiro.
- Captura repetida não duplica dados e formulário diferente preserva fonte.
- 301+ contatos retornam total real de agregação, independentemente da paginação.
- Provar que um e-mail digitado por terceiro não cria selo nem libera o pré-lançamento.

## Rollback
Não reverter 0103 apagando contatos captados. Se necessário, desabilitar o toggle de todas as pesquisas e usar feature gating no frontend. Qualquer exclusão deve seguir retenção e LGPD.
A reversão de 0104 para 6 vagas só é segura quando nenhum registro tiver capacidade >6. Validar com consultas antes de restaurar as constraints e funções antigas; não aplicar rollback destrutivo automaticamente.
