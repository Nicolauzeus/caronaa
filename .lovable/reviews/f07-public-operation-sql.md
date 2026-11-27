# CARONAA Flash — operação pública permanente

## Resultado e aprovação necessária

A decisão definitiva já está registrada no README: Flash contínuo por padrão, sem expiração nem renovação. **A permanência ainda não está instalada em produção.** O SQL abaixo substitui integralmente a proposta anterior de 90 dias e precisa de aprovação explícita antes da execução. Nenhuma alteração de banco foi feita nesta etapa.

## Módulos, estado e preservação

- **F07:** transição preparada, testada localmente e pendente da aprovação do SQL.
- **F02/F08:** autorização normal, veículo ativo, GPS real consentido, pagamentos, notificações, avaliações, cancelamentos e regras financeiras preservados; nenhum cadastro ou corrida real foi modificado.
- **F03:** R$ 6 por 11 km rodoviários permanece independente das tarifas profissionais.
- Administradores mantêm os controles existentes de município, modalidade e tarifa. A nova RPC `admin_set_f07_operation_enabled` permite suspensão/retomada global auditada por administrador autenticado. Não há novo botão administrativo nesta entrega; os controles municipais existentes continuam funcionando.
- Suspensão global bloqueia novos pedidos/aceites, não o acompanhamento, encerramento, pagamento ou cancelamento de corridas já aceitas. Reenvio de uma cotação já usada continua retornando o mesmo pedido.

## Auditoria da implementação instalada

Leitura do banco de produção em 27/11/2026 confirmou **três consumidores comerciais diretos** do controle antigo: `caronaa_quick_region_status`, `caronaa_quick_submit_quoted` e `guard_caronaa_quick_driver_assignment`. O SQL troca cada chamada na origem por `caronaa_f07_operation_dispatch_allowed`, sem delegar a nomes de teste e sem remover outras validações.

O controle antigo, `caronaa_f07_test_dispatch_allowed` e `caronaa_f07_pilot_activate_driver` deixam de autorizar operação/contas temporárias. A função de ativação passa a falhar mesmo para o proprietário do banco; sua permissão também é revogada. RPC/tabela opcional de simulação perde acesso. Os registros históricos não são apagados.

**Controles individuais que NÃO devem ser retirados:** `caronaa_f07_pilot_location_expiry_guard` limita contas temporárias antigas; `professional_auto_enable`, `save_my_professional_vehicle` e `activate_my_professional_vehicle` bloqueiam promoção de acessos temporários; `caronaa_f07_pilot_deactivate_driver` mantém revogação/auditoria privilegiada, sem interferir no serviço global. Não foi registrada nenhuma autorização temporária no banco auditado (0 linhas).

Não há views ou políticas RLS instaladas dependendo do controle antigo. Há um trigger individual de GPS temporário, preservado. O aceite instalado mantém GPS/presença de 90 segundos e distância máxima de 15.000 m. A busca instalada mantém 30 minutos e idempotência. O SQL contém preflight das três funções e hashes das definições auditadas: se houver alteração concorrente, aborta sem sobrescrever código mais novo.

Migrations históricas 0143, 0144, 0147 e 0228 mantêm seus registros originais; a mudança é incremental. Scripts antigos de ativação permanecem arquivos históricos e **não devem ser executados em produção**. O novo controle comercial não os consulta. Arquivos gerados de tipos não foram alterados antes da instalação.

Componentes/serviços ativos auditados: `QuickRideHomePanel`, `ProfessionalAvailabilityPage`, `ProfessionalRadarSync`, `DriverFlashPlanner`, `quick-ride.functions`, endpoints F07 aposentados e componentes de mapa. A interface de solicitação já não depende da quantidade online; exige cotação válida/cobertura. Os endpoints antigos já falham fechados. Identificadores tarifários terminados em `-piloto` continuam snapshots de política, não flags de ambiente; não foram renomeados nem usados para liberar homologação.

## Cobertura e tarifas

Consulta autenticada atual: **34/34 combinações ENABLED** — Carro e Moto em Acarape, Aracoiaba, Aratuba, Barreira, Baturité, Capistrano, Fortaleza, Guaiúba, Guaramiranga, Itapiúna, Maracanaú, Mulungu, Ocara, Pacatuba, Pacoti, Palmácia e Redenção. O SQL não reinsere catálogo histórico nem modifica nenhuma tarifa, comissão, região ou snapshot.

## Testes e resultados desta etapa

- **42 verificações SQL passaram**, em banco local descartável: operação sem deadline, controle antigo expirado sem bloquear o comercial, 34 combinações, pedido com zero online e preço 3.000 centavos preservado, busca de 1.800 segundos, idempotência, suspensão/retomada com autorização e auditoria, bloqueio de conta temporária expirada, manutenção de corridas existentes e proteção contra reaplicação.
- Fixture utiliza os **corpos comerciais reais** das três funções instaladas, além do guard individual real. O motor interno `quick_ride_request` é substituído por fixture: não representa validação completa de produção, concorrência real, GPS ou entrega de notificações.
- **111/111 testes focados passaram** em 17 arquivos: preços, tarifas, cobertura, raio, GPS, controles aposentados, busca, Pix/encerramento e notificações.
- Suíte completa: **1.858 passaram e 5 falharam**, em 309 arquivos. As cinco falhas são as já conhecidas de `src/test/location-layer.test.ts` (buscas/endereço); nenhum código dessa camada foi alterado. Não declarar suíte toda verde.
- Compilação automática: **build OK** após alterações. TypeScript não foi executado separadamente: o ambiente impede execução manual de build/typecheck; não afirmar uma validação TypeScript independente.
- Navegador autenticado: painel profissional renderizou, RPC de cobertura 34/34 e zero exceções de execução capturadas. Google Maps mostrou falha de carregamento em localhost; a conta não tinha cadastro profissional completo. **Não foi criada corrida real**, não foi validado pedido→aceite→conclusão no APK.

## Arquivos e alinhamento ao README

README, regras locais `src/lib/quick-rides/AGENTS.md`, regra técnica resumida no AGENTS raiz (sem alterar o conteúdo das regras existentes), roadmap, comentário de política em `quick-ride.functions.ts`, SQL permanente e testes locais em `scripts/tests/` / `scripts/test-f07-permanent-operation-db.mjs`. Proposta e teste de janela de 90 dias removidos. A documentação é explícita sobre o estado pendente no banco.

## Transição segura e pendências

A migration executa em uma transação, com lock limitado a 5 segundos: falha de preflight/lock reverte a transição inteira, mantendo a implementação anterior. Ela não atualiza corridas nem autorizações individuais. Depois da aprovação, aplicar **este SQL exato** via ferramenta de migrations, conferir grants/RLS e consumidores, repetir cobertura autenticada e validar o fluxo de solicitação com entrada autorizada sem prejudicar corridas reais. Atualizações do código/publicação, TypeScript independente, mapas no domínio autorizado, aparelho real e entrega de push permanecem não comprovados nesta etapa. Em caso de incidente, administradores podem suspender novos pedidos com a nova RPC; não reativar mecanismos antigos de teste como reversão.

## SQL completo para aprovação — não executado

```sql
-- PROPOSAL ONLY. No production execution before explicit approval of this exact SQL.
-- Permanent public Flash. Preserve configured municipalities, fares and ride snapshots.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Abort on concurrent schema changes rather than overwrite a newer implementation.
DO $preflight$
DECLARE actual text[];
BEGIN
  IF to_regclass('public.caronaa_f07_operation_control') IS NOT NULL THEN
    RAISE EXCEPTION 'Operation control already exists; audit installed schema before retry';
  END IF;
  SELECT array_agg(p.proname::text ORDER BY p.proname) INTO actual
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND p.prosrc LIKE '%public.caronaa_f07_test_dispatch_allowed()%';
  IF actual IS DISTINCT FROM ARRAY['caronaa_quick_region_status',
      'caronaa_quick_submit_quoted','guard_caronaa_quick_driver_assignment'] THEN
    RAISE EXCEPTION 'Commercial dependency set changed; re-audit before applying';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.caronaa_quick_region_status(text,text)'::regprocedure)
        IS DISTINCT FROM '0ef1b0d054c20949f3b68c56230f7541'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.caronaa_quick_submit_quoted(uuid)'::regprocedure)
        IS DISTINCT FROM '11e51df537f173b6255368b6ce0a5fa3'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.guard_caronaa_quick_driver_assignment()'::regprocedure)
        IS DISTINCT FROM 'b0dda7e5689051442ffe34a104a3e793' THEN
    RAISE EXCEPTION 'Commercial function changed since review; re-audit before applying';
  END IF;
END
$preflight$;

CREATE TABLE public.caronaa_f07_operation_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON TABLE public.caronaa_f07_operation_control TO authenticated;
GRANT ALL ON TABLE public.caronaa_f07_operation_control TO service_role;
REVOKE ALL ON TABLE public.caronaa_f07_operation_control FROM PUBLIC, anon;
ALTER TABLE public.caronaa_f07_operation_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY f07_operation_admin_read ON public.caronaa_f07_operation_control
  FOR SELECT TO authenticated
  USING ((select public.has_role((select auth.uid()), 'admin')));

CREATE TABLE public.caronaa_f07_operation_control_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  previous_enabled boolean NOT NULL,
  enabled boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON TABLE public.caronaa_f07_operation_control_events TO authenticated;
GRANT ALL ON TABLE public.caronaa_f07_operation_control_events TO service_role;
REVOKE ALL ON TABLE public.caronaa_f07_operation_control_events FROM PUBLIC, anon;
ALTER TABLE public.caronaa_f07_operation_control_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY f07_operation_events_admin_read ON public.caronaa_f07_operation_control_events
  FOR SELECT TO authenticated
  USING ((select public.has_role((select auth.uid()), 'admin')));
CREATE INDEX f07_operation_events_actor_time_idx
  ON public.caronaa_f07_operation_control_events (actor_id, created_at DESC);
CREATE INDEX f07_operation_events_time_idx
  ON public.caronaa_f07_operation_control_events (created_at DESC);

INSERT INTO public.caronaa_f07_operation_control (id, enabled) VALUES (true, true);

CREATE FUNCTION public.caronaa_f07_operation_dispatch_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $operation$
  SELECT coalesce((SELECT c.enabled FROM public.caronaa_f07_operation_control c
    WHERE c.id=true), false);
$operation$;
REVOKE ALL ON FUNCTION public.caronaa_f07_operation_dispatch_allowed()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_operation_dispatch_allowed() TO service_role;

-- An authenticated administrator can suspend/resume NEW requests and acceptance.
-- No deadlines; no impact on tracking, completion, payment or cancellation of accepted rides.
CREATE FUNCTION public.admin_set_f07_operation_enabled(p_enabled boolean, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $admin$
DECLARE previous boolean; actor uuid:=auth.uid();
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
  END IF;
  IF p_enabled IS NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Enabled and reason required' USING ERRCODE='22023';
  END IF;
  SELECT enabled INTO previous FROM public.caronaa_f07_operation_control
    WHERE id=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation control missing'; END IF;
  IF previous IS DISTINCT FROM p_enabled THEN
    UPDATE public.caronaa_f07_operation_control SET enabled=p_enabled,updated_at=now()
      WHERE id=true;
    INSERT INTO public.caronaa_f07_operation_control_events
      (actor_id,previous_enabled,enabled,reason)
      VALUES(actor,previous,p_enabled,btrim(p_reason));
  END IF;
  RETURN p_enabled;
END
$admin$;
REVOKE ALL ON FUNCTION public.admin_set_f07_operation_enabled(boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_f07_operation_enabled(boolean,text) TO authenticated, service_role;

-- Replace each commercial consumer at its source; none delegates to a test RPC.
-- Function signatures/ACLs and ALL other validations remain unchanged.
CREATE OR REPLACE FUNCTION public.caronaa_quick_region_status(p_municipality text, p_vehicle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; enabled boolean; tariff boolean; commercial boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO')
    OR length(btrim(coalesce(p_municipality,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Invalid quick region or vehicle' USING ERRCODE='22023';
  END IF;
  SELECT c.pricing_region,c.car_enabled,c.moto_enabled,
         coalesce(s.public_discovery_enabled,false) AS radar,
         coalesce(s.dispatch_enabled,false) AS dispatch
  INTO r FROM public.caronaa_service_municipalities c
  LEFT JOIN public.professional_service_regions s ON s.municipality=c.municipality
  WHERE lower(c.municipality)=lower(btrim(p_municipality)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','OUTSIDE','region',null,
      'radar',false,'dispatch',false);
  END IF;
  enabled:=CASE WHEN p_vehicle='MOTO' THEN r.moto_enabled ELSE r.car_enabled END;
  SELECT t.published INTO tariff FROM public.caronaa_quick_tariff_policies t
  WHERE t.pricing_region=r.pricing_region AND t.vehicle_type=p_vehicle;
  commercial:=coalesce(enabled AND r.dispatch AND r.radar AND tariff,false)
    AND public.caronaa_f07_operation_dispatch_allowed();
  RETURN jsonb_build_object(
    'status',CASE WHEN commercial THEN 'ENABLED' ELSE 'WAITLIST' END,
    'region',r.pricing_region,'radar',r.radar,'dispatch',commercial
  );
END
$function$;


CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.caronaa_quick_fare_quotes%ROWTYPE;
  r_id uuid;
  v_destination text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes
    WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE='42501';
  END IF;
  -- Idempotent re-submission does not create a second ride.
  IF q.ride_id IS NOT NULL THEN RETURN q.ride_id; END IF;
  IF q.expires_at <= now() THEN
    RAISE EXCEPTION 'Quote expired';
  END IF;

  v_destination := q.destination_municipality;
  IF v_destination IS NULL THEN
    -- A legacy same-city destination may only be supplied after the
    -- authenticated server re-verifies its stored destination coordinates.
    SELECT v.destination_municipality INTO v_destination
      FROM public.caronaa_quick_legacy_destination_verifications v
      WHERE v.quote_id=q.id
        AND v.destination_municipality=q.municipality
        AND v.verified_at >= q.issued_at;
    IF v_destination IS NULL THEN
      RAISE EXCEPTION 'Quote destination is not verified';
    END IF;
  END IF;

  IF NOT public.caronaa_f07_operation_dispatch_allowed() THEN
    RAISE EXCEPTION 'Flash service is administratively suspended' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities o
    JOIN public.professional_service_regions r ON r.municipality=o.municipality
    JOIN public.caronaa_quick_tariff_policies t
      ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
    WHERE o.municipality=q.municipality AND o.pricing_region=q.pricing_region
      AND r.public_discovery_enabled AND r.dispatch_enabled AND t.published
      AND CASE WHEN q.vehicle_type='MOTO' THEN o.moto_enabled ELSE o.car_enabled END
      AND (v_destination=o.municipality OR t.intermunicipal_enabled)
  ) THEN
    RAISE EXCEPTION 'Origin, tariff or intermunicipal dispatch unavailable'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities d
    JOIN public.professional_service_regions r ON r.municipality=d.municipality
    WHERE d.municipality=v_destination
      AND r.public_discovery_enabled AND r.dispatch_enabled
      AND CASE WHEN q.vehicle_type='MOTO' THEN d.moto_enabled ELSE d.car_enabled END
  ) THEN
    RAISE EXCEPTION 'Destination not approved for this mode' USING ERRCODE='42501';
  END IF;
  -- Keep the original atomic dispatch and its one-request-per-passenger rules.
  r_id := public.quick_ride_request(
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    q.origin_lat,q.origin_lng,q.destination_lat,q.destination_lng
  );
  -- Allow an explicit waiting window for a passenger even with no driver online.
  -- The existing atomic request guard still prevents duplicate active requests.
  UPDATE public.professional_quick_rides
    SET expires_at=now()+interval '30 minutes',updated_at=now()
    WHERE id=r_id AND passenger_id=auth.uid() AND status='SEARCHING';
  UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id WHERE id=q.id;
  RETURN r_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status='SEARCHING' AND NEW.status='ACCEPTED' THEN
    IF NOT public.caronaa_f07_operation_dispatch_allowed() OR NOT EXISTS (
      SELECT 1 FROM public.caronaa_quick_fare_quotes q
      JOIN public.caronaa_service_municipalities o
        ON o.municipality=q.municipality
      JOIN public.professional_service_regions os
        ON os.municipality=o.municipality
      JOIN public.caronaa_quick_tariff_policies t
        ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
      LEFT JOIN public.caronaa_quick_legacy_destination_verifications v
        ON v.quote_id=q.id AND v.destination_municipality=q.municipality
           AND v.verified_at>=q.issued_at
      JOIN public.caronaa_service_municipalities d
        ON d.municipality=COALESCE(q.destination_municipality,v.destination_municipality)
      JOIN public.professional_service_regions ds
        ON ds.municipality=d.municipality
      WHERE q.ride_id=OLD.id
        AND q.municipality=OLD.municipality
        AND q.vehicle_type=OLD.vehicle_type
        AND os.dispatch_enabled AND os.public_discovery_enabled
        AND ds.dispatch_enabled AND ds.public_discovery_enabled
        AND t.published
        AND (o.municipality=d.municipality OR t.intermunicipal_enabled)
        AND CASE WHEN q.vehicle_type='MOTO' THEN o.moto_enabled AND d.moto_enabled
                 ELSE o.car_enabled AND d.car_enabled END
    ) THEN
      RAISE EXCEPTION 'Destination, origin or tariff is no longer approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- Retire legacy test entry points even if an old deployment flag/control is toggled.
-- Historical control and authorization audit rows remain; no driver is promoted/revoked here.
CREATE OR REPLACE FUNCTION public.caronaa_f07_test_dispatch_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $retired$ SELECT false; $retired$;
REVOKE ALL ON FUNCTION public.caronaa_f07_test_dispatch_allowed()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_activate_driver(p_user_id uuid, p_vehicle_type text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $retired_activation$
BEGIN
  RAISE EXCEPTION 'Temporary activation retired; use normal professional authorization'
    USING ERRCODE='42501';
END
$retired_activation$;
REVOKE ALL ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
UPDATE public.caronaa_f07_pilot_control SET enabled=false,updated_at=now() WHERE id=true;

DO $retire_optional$
BEGIN
  IF to_regprocedure('public.caronaa_f07_test_self_radar(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regclass('public.caronaa_f07_simulated_driver_positions') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.caronaa_f07_simulated_driver_positions FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END
$retire_optional$;

-- Keep individual temporary authorization expiry guards and revocation/audit maintenance.
-- Keep 90-second GPS, 15km acceptance, quote expiry and 30-minute SEARCHING untouched.
DO $verify$
BEGIN
  IF NOT public.caronaa_f07_operation_dispatch_allowed() THEN
    RAISE EXCEPTION 'Permanent operation is not enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND p.prosrc LIKE '%public.caronaa_f07_test_dispatch_allowed()%'
  ) THEN RAISE EXCEPTION 'Unmigrated legacy commercial dependency'; END IF;
END
$verify$;
COMMENT ON TABLE public.caronaa_f07_operation_control IS
  'Permanent public Flash administrative switch; no expiration or driver authorization grants.';
COMMENT ON TABLE public.caronaa_f07_operation_control_events IS
  'Private administrative suspension/resumption audit; no customer, GPS or payment payload.';
COMMENT ON FUNCTION public.caronaa_f07_test_dispatch_allowed() IS
  'Retired test switch, always false. Commercial consumers use permanent operation control directly.';
NOTIFY pgrst, 'reload schema';
COMMIT;
```
