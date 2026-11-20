-- CARONAA 0222 | Indicadores reais de pedidos e corridas
-- Requer 0221. Nao altera status, precos, pagamentos, cadastros ou viagens.
-- Contagens globais feitas no banco (nao nos 400 itens da central).
-- Cada registro de professional_quick_rides representa UM pedido Flash:
-- so vira corrida quando motorista e atribuido; nunca somar pedido como corrida.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_mobility_lifecycle_metrics(
  p_period text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $ops$
DECLARE
  v_start timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;

  IF p_period IS NULL OR p_period NOT IN ('today','7d','30d','all') THEN
    RAISE EXCEPTION 'Periodo invalido' USING ERRCODE='22023';
  END IF;

  v_start := CASE p_period
    WHEN 'today' THEN date_trunc('day',now() AT TIME ZONE 'America/Fortaleza')
                      AT TIME ZONE 'America/Fortaleza'
    WHEN '7d' THEN now()-interval '7 days'
    WHEN '30d' THEN now()-interval '30 days'
    ELSE NULL
  END;

  WITH flash AS (
    SELECT
      count(*)::int AS orders_total,
      count(*) FILTER (
        WHERE upper(status)='SEARCHING'
      )::int AS orders_searching,
      count(*) FILTER (
        WHERE upper(status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS',
                               'PENDING_REVIEW','COMPLETED')
      )::int AS orders_matched,
      count(*) FILTER (
        WHERE upper(status) IN ('CANCELLED','CANCELED')
      )::int AS orders_cancelled,
      count(*) FILTER (
        WHERE upper(status)='EXPIRED'
      )::int AS orders_expired,
      count(*) FILTER (
        WHERE driver_id IS NOT NULL
          AND upper(status) IN (
            'ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW',
            'COMPLETED','CANCELLED','CANCELED')
      )::int AS trips_total,
      count(*) FILTER (
        WHERE driver_id IS NOT NULL
          AND upper(status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
      )::int AS trips_in_progress,
      count(*) FILTER (
        WHERE driver_id IS NOT NULL
          AND upper(status)='COMPLETED'
          AND completed_at IS NOT NULL
      )::int AS trips_completed,
      count(*) FILTER (
        WHERE driver_id IS NOT NULL
          AND upper(status) IN ('CANCELLED','CANCELED')
      )::int AS trips_cancelled,
      count(*) FILTER (
        WHERE driver_id IS NOT NULL AND upper(status)='PENDING_REVIEW'
      )::int AS trips_in_review,
      count(*) FILTER (
        WHERE upper(status)='COMPLETED'
          AND completed_at IS NOT NULL
          AND coalesce(upper(payment_status),'PENDING') NOT IN
            ('PAID','CONFIRMED','SETTLED')
      )::int AS completed_payment_unconfirmed
    FROM public.professional_quick_rides
    WHERE v_start IS NULL OR requested_at>=v_start
  ), shared_orders AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE upper(status) IN ('OPEN','PENDING','SEARCHING','AVAILABLE')
      )::int AS searching,
      count(*) FILTER (
        WHERE upper(status) IN ('MATCHED','ACCEPTED','CONFIRMED','COMPLETED')
      )::int AS matched,
      count(*) FILTER (
        WHERE upper(status) IN ('CANCELLED','CANCELED')
      )::int AS cancelled,
      count(*) FILTER (
        WHERE upper(status)='EXPIRED'
      )::int AS expired
    FROM public.ride_requests
    WHERE v_start IS NULL OR created_at>=v_start
  ), shared_trips AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE upper(status) IN (
          'ACCEPTED','ARRIVED','IN_PROGRESS','ONGOING',
          'ON_ROUTE','BOARDING','STARTED','EM_ANDAMENTO')
      )::int AS in_progress,
      count(*) FILTER (
        WHERE upper(status)='COMPLETED'
          AND completed_at IS NOT NULL
      )::int AS completed,
      count(*) FILTER (
        WHERE upper(status) IN ('CANCELLED','CANCELED')
      )::int AS cancelled,
      count(*) FILTER (
        WHERE upper(status)='PENDING_REVIEW'
      )::int AS in_review
    FROM public.rides
    WHERE v_start IS NULL OR created_at>=v_start
  )
  SELECT jsonb_build_object(
    'generated_at',now(),
    'period',p_period,
    'period_start',v_start,
    'orders',jsonb_build_object(
      'total',f.orders_total+o.total,
      'searching',f.orders_searching+o.searching,
      'matched',f.orders_matched+o.matched,
      'cancelled',f.orders_cancelled+o.cancelled,
      'expired',f.orders_expired+o.expired
    ),
    'trips',jsonb_build_object(
      'total',f.trips_total+t.total,
      'in_progress',f.trips_in_progress+t.in_progress,
      'completed',f.trips_completed+t.completed,
      'cancelled',f.trips_cancelled+t.cancelled,
      'in_review',f.trips_in_review+t.in_review
    ),
    'payment',jsonb_build_object(
      'completed_flash_without_confirmed_payment',
       f.completed_payment_unconfirmed
    ),
    'sources',jsonb_build_object(
      'flash_orders',f.orders_total,
      'shared_orders',o.total,
      'flash_trips',f.trips_total,
      'shared_trips',t.total
    )
  ) INTO v_result
  FROM flash f CROSS JOIN shared_orders o CROSS JOIN shared_trips t;

  RETURN v_result;
END;
$ops$;

REVOKE ALL ON FUNCTION public.admin_mobility_lifecycle_metrics(text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_mobility_lifecycle_metrics(text)
  TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
