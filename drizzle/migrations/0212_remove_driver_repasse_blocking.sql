-- 0212 | Finance ledger remains enforceable financially, but never blocks mobility.
-- Explicit business decision: no rider or driver access restriction because of
-- unpaid commission, number of pending trips, or payment statement status.
-- Preserve ledger, billing, audit, settlement and professional GPS/approval gates.
-- Apply manually in Supabase SQL Editor if migrations are not auto-deployed.
BEGIN;

-- Existing professional, shared and Flash acceptance/visibility functions
-- call this helper for the FINANCIAL rule only. Keep NULL identities denied.
CREATE OR REPLACE FUNCTION public.driver_platform_access_allowed(p_driver uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $allowed$
  SELECT p_driver IS NOT NULL;
$allowed$;
REVOKE ALL ON FUNCTION public.driver_platform_access_allowed(uuid)
  FROM PUBLIC,anon,authenticated;

-- Historic financial-only triggers are no longer necessary. All unrelated
-- authorization, GPS, ride-state and integrity triggers remain intact.
DROP TRIGGER IF EXISTS ride_offer_driver_debt ON public.ride_offers;
DROP TRIGGER IF EXISTS ride_routine_driver_debt ON public.ride_routines;
DROP TRIGGER IF EXISTS ride_match_driver_debt ON public.ride_matches;
DROP TRIGGER IF EXISTS presence_driver_debt ON public.professional_presence;
DO $drop_optional$
BEGIN
  IF to_regclass('public.professional_driver_locations') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS professional_location_driver_debt ON public.professional_driver_locations';
  END IF;
  IF to_regclass('public.professional_quick_rides') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS quick_ride_accept_driver_debt ON public.professional_quick_rides';
  END IF;
END
$drop_optional$;

-- Defence in depth: a stale future trigger must not reintroduce fee blocking.
CREATE OR REPLACE FUNCTION public.guard_driver_platform_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $no_fee_gate$
BEGIN
  RETURN NEW;
END
$no_fee_gate$;
REVOKE ALL ON FUNCTION public.guard_driver_platform_debt()
  FROM PUBLIC,anon,authenticated;

-- Read-only financial reports keep actual unpaid totals, due rows, statement
-- amounts and verification status. Their driverAllowed flag is a compatibility
-- field and no longer means debts can block a driver.
CREATE OR REPLACE FUNCTION public.get_my_caronaa_commission_ledger()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $read$
DECLARE v_driver uuid:=auth.uid(); v_pending integer; v_total bigint;
  v_ready bigint; v_dues jsonb; v_statements jsonb; v_key text;
BEGIN
  IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  WITH all_dues AS (
    SELECT 'SHARED'::text AS source_kind,f.ride_id,f.driver_id,
      round(f.gross_amount*100)::integer AS gross_cents,
      round(f.fee_amount*100)::integer AS fee_cents,
      round(f.fee_rate*10000)::integer AS commission_bps,
      f.status,f.created_at FROM public.driver_platform_fees f
    UNION ALL
    SELECT 'QUICK',q.ride_id,q.driver_id,q.gross_cents,q.fee_cents,
      q.commission_bps,q.status,q.created_at
      FROM public.caronaa_quick_driver_fees q
  ), my_dues AS (
    SELECT d.*,i.statement_id FROM all_dues d
    LEFT JOIN public.caronaa_driver_fee_statement_items i
      ON i.source_kind=d.source_kind AND i.ride_id=d.ride_id
    WHERE d.driver_id=v_driver
  )
  SELECT count(*) FILTER (WHERE status<>'SETTLED')::integer,
    coalesce(sum(fee_cents) FILTER(WHERE status<>'SETTLED'),0),
    coalesce(sum(fee_cents) FILTER(WHERE status='OPEN' AND statement_id IS NULL),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'source',source_kind,'rideId',ride_id,'grossCents',gross_cents,
      'feeCents',fee_cents,'commissionBps',commission_bps,
      'status',status,'statementId',statement_id,'createdAt',created_at
    ) ORDER BY created_at DESC),'[]'::jsonb)
  INTO v_pending,v_total,v_ready,v_dues FROM my_dues;

  SELECT pix_key INTO v_key FROM public.platform_fee_config WHERE singleton=true;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'status',s.status,'totalCents',s.total_cents,
    'itemCount',s.item_count,'pixKey',s.pix_key_snapshot,
    'txid','C'||upper(substr(replace(s.id::text,'-',''),1,24)),
    'claimReference',s.claim_reference,'createdAt',s.created_at,
    'verifiedAt',s.verified_at
  ) ORDER BY s.created_at DESC),'[]'::jsonb)
  INTO v_statements FROM public.caronaa_driver_fee_statements s
  WHERE s.driver_id=v_driver;

  RETURN jsonb_build_object(
    'driverAllowed',true,'pendingTrips',v_pending,'limit',NULL,
    'totalOutstandingCents',v_total,'readyToInvoiceCents',v_ready,
    'platformPixConfigured',length(btrim(coalesce(v_key,'')))>=6,
    'dues',v_dues,'statements',v_statements
  );
END $read$;

CREATE OR REPLACE FUNCTION public.get_my_driver_platform_fees()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $legacy$
DECLARE v_driver uuid:=auth.uid(); v_shared_count integer; v_quick_count integer;
  v_shared_total numeric; v_quick_cents bigint; v_pix text;
BEGIN
  IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT count(*)::integer,coalesce(sum(fee_amount),0)
    INTO v_shared_count,v_shared_total
    FROM public.driver_platform_fees
    WHERE driver_id=v_driver AND status<>'SETTLED';
  SELECT count(*)::integer,coalesce(sum(fee_cents),0)
    INTO v_quick_count,v_quick_cents
    FROM public.caronaa_quick_driver_fees
    WHERE driver_id=v_driver AND status<>'SETTLED';
  SELECT pix_key INTO v_pix FROM public.platform_fee_config WHERE singleton=true;
  RETURN jsonb_build_object(
    'driverAllowed',true,
    'pendingTrips',v_shared_count+v_quick_count,
    'limit',NULL,
    'feePercent',NULL,
    'rateVaries',true,
    'amountOutstanding',v_shared_total+v_quick_cents/100.0,
    'platformPixKey',v_pix,
    'dues',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'rideId',ride_id,'grossAmount',gross_amount,'feeAmount',fee_amount,
      'status',status,'claimReference',claim_reference,'createdAt',created_at
    ) ORDER BY created_at DESC)
      FROM public.driver_platform_fees WHERE driver_id=v_driver),'[]'::jsonb)
  );
END $legacy$;

-- Admin financial overview keeps counts and amounts, but the legacy
-- blocked JSON field must never imply that pending dues suspend mobility.
CREATE OR REPLACE FUNCTION public.get_admin_driver_debts_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $
DECLARE r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(d ORDER BY (d->>'pendingCount')::int DESC, (d->>'pendingAmount')::numeric DESC),'[]'::jsonb) INTO r
 FROM (
  SELECT jsonb_build_object(
   'driverId', f.driver_id,
   'name', coalesce(p.full_name,'Sem nome'),
   'email', u.email,
   'vehicle', nullif(trim(concat_ws(' ', p.vehicle_brand, p.vehicle_description)),''),
   'plate', p.vehicle_plate,
   'pendingCount', count(*),
   'openCount', count(*) FILTER (WHERE f.status='OPEN'),
   'claimedCount', count(*) FILTER (WHERE f.status='CLAIMED'),
   'pendingAmount', coalesce(sum(f.fee_amount),0),
   'blocked', false,
   'oldestAt', min(f.created_at),
   'items', jsonb_agg(jsonb_build_object('rideId',f.ride_id,'status',f.status,'gross',f.gross_amount,'fee',f.fee_amount,'createdAt',f.created_at,'claimReference',f.claim_reference) ORDER BY f.created_at)
  ) d
  FROM public.driver_platform_fees f
  LEFT JOIN public.profiles p ON p.id=f.driver_id
  LEFT JOIN auth.users u ON u.id=f.driver_id
  WHERE f.status <> 'SETTLED'
  GROUP BY f.driver_id, p.full_name, u.email, p.vehicle_brand, p.vehicle_description, p.vehicle_plate
 ) s;
 RETURN r;
END $;

REVOKE ALL ON FUNCTION public.get_admin_driver_debts_overview()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_driver_debts_overview()
  TO authenticated;

COMMENT ON FUNCTION public.driver_platform_access_allowed(uuid) IS
  'Unpaid commissions never prevent mobility; non-NULL identity is the only test. Professional authorization and GPS checks remain separate.';
COMMENT ON FUNCTION public.guard_driver_platform_debt() IS
  'Deprecated fee-only trigger: no-op after removal of repasse-based access blocking.';
COMMENT ON TABLE public.driver_platform_fees IS
  'Per-ride commissions remain payable, auditable and verifiable; debt volume never blocks driver activity.';
COMMENT ON FUNCTION public.get_my_caronaa_commission_ledger() IS
  'Read combined shared and professional obligations; driverAllowed is always true regardless of outstanding balance.';
NOTIFY pgrst,'reload schema';
COMMIT;
