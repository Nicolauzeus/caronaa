# Validacao de descoberta e solicitacao

A migration 0019 depende da 0018 (user_verifications). Ambas estao no journal.
Nao foram aplicadas ao banco remoto nesta revisao.

## Regra temporal

O codigo existente armazena date/time sem fuso e exibe datas locais; nao havia
timezone explicito no dominio. A 0019 explicita America/Fortaleza, conforme o
contexto do projeto. Discovery, solicitacao direta e matching interpretam a
soma ride_date + departure_time nesse fuso e comparam com clock_timestamp().
A igualdade ainda e elegivel; somente instantes anteriores sao vencidos.
O relogio real evita usar o inicio de uma transacao que aguardou o lock.
Requests vencidos tambem sao excluidos pelo allocator, inclusive quando chamado
pelo trigger de uma nova oferta. As linhas nao sao expiradas por job nem removidas:
podem manter status available/open, mas nao podem ser descobertas/consumidas.
Badges publicos contem apenas type/status, inclusive depois do mapper da UI.

Os testes temporais avaliam os predicados extraidos do SQL com relogio fixo e
verificam que o allocator original so mudou pelas duas condicoes temporais.
Nao executam a migration ou substituem validacao em PostgreSQL. Acrescentar aos
cenarios remotos abaixo ofertas de ontem, hoje antes/depois do horario atual e
amanha; repetir pela RPC direta e criacao generica de pedidos/ofertas.

## Policies auditadas

As migrations posteriores a 0015 nao ampliam o SELECT de ride_offers.
ride_requests e ride_offers continuam legiveis diretamente apenas pelo dono.
ride_matches e rides permitem SELECT somente aos participantes.
ride_status_history e ride_completion_confirmations verificam participacao pela
ride associada. INSERT/UPDATE/DELETE estao revogados para anon/authenticated nas
seis tabelas. transition_ride_status valida auth.uid(), participacao e transicao.
try_match_ride_request permanece inacessivel para anon/authenticated.

A descoberta usa SECURITY DEFINER com search_path vazio e objetos qualificados.
O resultado contem rota, horario, vagas, IDs, nome/avatar/cidade e badges VERIFIED.
Nao inclui e-mail, referencia de formulario ou metadados privados do badge.
O middleware verifica o JWT e encaminha esse mesmo token ao Supabase; as RPCs
decidem identidade exclusivamente por auth.uid(), sem argumento user_id.
getMyRides ainda usa service role exclusivamente no servidor, com filtro por
participante antes de carregar as entidades relacionadas. Nenhuma chave service
role e enviada ao browser. Os badges dessa leitura tambem foram reduzidos.

## Testes locais e limites

ride-discovery.test.ts verifica contratos SQL e regras de compatibilidade.
ride-matching.test.ts e ride-lifecycle.test.ts verificam capacidade, identidade,
transicoes e confirmacao bilateral. Esses testes nao executam PostgreSQL e nao
comprovam RLS, triggers, grants ou isolamento transacional em runtime.

## Validacao pendente no Supabase de teste

Aplicar as migrations em ambiente de teste com tres usuarios reais A/B/C. Usar
clientes com chave publishable e JWT de cada usuario, nunca service role para
as chamadas sob teste.

1. A chama create_ride_offer com duas vagas e rota/data/horario conhecidos.
2. B chama search_available_ride_offers e recebe a oferta de A sem campos privados.
3. A faz a mesma busca e nao recebe a propria oferta. anon deve ter EXECUTE negado.
4. B chama request_available_ride_offer com essa oferta e dois passageiros.
5. A/B consultam ride_matches/rides e encontram um unico match e ride MATCHED.
6. C nao le essa ride/historico/confirmacoes; transition_ride_status deve falhar.
7. Em outra oferta de uma vaga, solicitar dois passageiros deve falhar sem criar
   request/match nem consumir vagas.
8. A oferta lotada nao aparece na descoberta, mesmo sem filtros.
9. Repetir simultaneamente a solicitacao de B deve devolver o mesmo request_id,
   com um unico match/evento e um unico consumo de vagas. Para B/C concorrendo
   pela ultima vaga de outra oferta, somente um deve conseguir match.
10. MATCHED -> COMPLETED deve falhar. MATCHED -> CONFIRMED -> IN_PROGRESS deve
    funcionar; COMPLETED exige confirmacao dos dois participantes.

Verificar tambem que, havendo duas ofertas identicas, a solicitacao casa com o
offer_id escolhido. Repetir com quantidade diferente deve falhar. A idempotencia
vale tambem apos cancelamento/conclusao: o mesmo passageiro nao reserva outra vez
a mesma oferta; uma nova viagem exige outra oferta.

sessionStorage remanescente serve somente atribuicao de campanha e identificador
de sessao do funil, com testes que limpam esse armazenamento. Nao armazena caronas.
