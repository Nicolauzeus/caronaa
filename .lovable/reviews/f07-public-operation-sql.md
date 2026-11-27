# Flash F07 — operação pública

Sua decisão de 27/11/2026 passa a ser a regra vigente: o Flash é operação pública. Não voltaremos a pedir um ambiente de homologação como condição de produto.

## O que já foi alterado

- Retirados do painel do motorista os caminhos de simulação e autorização temporária. Chamadas antigas não conseguem criar posições simuladas nem emitir autorizações.
- Mantidos GPS real consentido, habilitação normal, veículo ativo, suspensões, regras financeiras e cotação do servidor.
- Removidas as mensagens de homologação do painel de preço Flash, sem liberar cobranças automáticas ou serviços de pagamento ainda indisponíveis.
- Corrigidos dois erros de carregamento nos menus quando a conta não possui nome/metadados.
- Regra atualizada no README; histórico, migrations antigas e auditorias preservados. Nomes antigos no histórico não representam um modo operacional ativo.

## Próxima alteração de banco

O SQL abaixo cria uma janela **pública de 90 dias a partir da aplicação**, troca a origem do controle usado pelas funções atuais e encerra os atalhos temporários. Não altera os municípios, modalidades ou tarifas configurados, nem aprova motoristas, apaga GPS, cria viagens ou modifica pagamentos.

A função com nome antigo permanece apenas como ponte para consumidores já instalados; passa a consultar exclusivamente a janela pública. Os bloqueios individuais históricos não são removidos nem convertidos em autorização permanente.

**Ainda não aplicado:** o banco público mantém a janela anterior até 27/12/2026 às 14:56 (Fortaleza). Aprovar a direção do produto não substitui a aprovação deste SQL completo.

## Verificação e limites

**Módulo/status:** F07, alteração parcial, preservando F02/F08. **Arquivos:** painel profissional, preço Flash, funções antigas, menus da conta, metadados da página, README, testes e proposta SQL. **Testes/resultados:** 91 testes distintos passaram; SQL executado com sucesso em PostgreSQL local descartável com estrutura mínima, cobrindo 90 dias, expiração, ausência/desativação do controle, permissões, compatibilidade autenticada e preservação do arquivo histórico. Avisos React de `act` nos testes existentes, sem falhas. Validação automática da aplicação: OK.

**Verificação visual:** sessão autenticada abriu o cockpit em computador e celular após corrigir os menus; nenhum cartão temporário. Capturas feitas ainda durante verificação de cadastro/mapa, portanto não comprovam prontidão de GPS/despacho. Não criei corrida real, não publiquei nem testei celular/APK. **Riscos/pendências:** aprovação e aplicação deste SQL, esquema público completo e fluxo real cotação → pedido → leitura. Avaliação legal/operacional não é comprovada pela decisão de produto. **README:** decisão expressa registrada sem remover requisitos de segurança ou testes automatizados.

## SQL completo proposto
```sql
-- PROPOSAL ONLY: apply to the public database only after explicit SQL approval.
-- Preserve existing tariffs, coverage, normal driver permissions and all rides.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.caronaa_f07_operation_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f07_operation_expiry CHECK (expires_at > activated_at)
);
GRANT ALL ON TABLE public.caronaa_f07_operation_control TO service_role;
REVOKE ALL ON TABLE public.caronaa_f07_operation_control FROM PUBLIC, anon, authenticated;
ALTER TABLE public.caronaa_f07_operation_control ENABLE ROW LEVEL SECURITY;
-- No client policies: only trusted operations can change the global window.

INSERT INTO public.caronaa_f07_operation_control
  (id, enabled, activated_at, expires_at, updated_at)
VALUES (true, true, now(), now() + interval '90 days', now());

CREATE FUNCTION public.caronaa_f07_operation_dispatch_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $operation$
  SELECT coalesce((
    SELECT c.enabled AND c.activated_at <= now() AND c.expires_at > now()
    FROM public.caronaa_f07_operation_control c WHERE c.id = true
  ), false);
$operation$;
REVOKE ALL ON FUNCTION public.caronaa_f07_operation_dispatch_allowed()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_operation_dispatch_allowed() TO service_role;

-- Compatibility name only: all installed coverage/submit/acceptance consumers
-- now use the PUBLIC operation window, without rewriting their security gates.
CREATE OR REPLACE FUNCTION public.caronaa_f07_test_dispatch_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $compatibility$
  SELECT public.caronaa_f07_operation_dispatch_allowed();
$compatibility$;
REVOKE ALL ON FUNCTION public.caronaa_f07_test_dispatch_allowed()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_test_dispatch_allowed() TO service_role;

-- Retire the old switch. Do not delete audit rows, change account approval,
-- erase GPS or alter trips. Individual legacy expiry guards remain protective.
UPDATE public.caronaa_f07_pilot_control SET enabled = false, updated_at = now()
WHERE id = true;

REVOKE ALL ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- These optional diagnostics are not installed in every database.
DO $retire$
BEGIN
  IF to_regprocedure('public.caronaa_f07_test_self_radar(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regclass('public.caronaa_f07_simulated_driver_positions') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.caronaa_f07_simulated_driver_positions FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END
$retire$;

COMMENT ON TABLE public.caronaa_f07_operation_control IS
  'Public F07 operational window. Does not grant driver approval, GPS consent, coverage or tariffs.';
COMMENT ON FUNCTION public.caronaa_f07_test_dispatch_allowed() IS
  'Legacy compatibility name delegating exclusively to the public operation control.';
COMMIT;
```
