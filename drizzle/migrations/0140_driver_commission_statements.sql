-- 0140 | Unify per-ride driver commission debt and exact-amount static Pix statements.
-- Apply AFTER 0131, 0135, 0139. No automatic Asaas charge or bank settlement.
-- Legacy shared-ride fees keep their original rates, statuses, and historical audits.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.driver_platform_fees') IS NULL
     OR to_regclass('public.caronaa_quick_fare_quotes') IS NULL
     OR to_regclass('public.professional_quick_rides') IS NULL
     OR to_regclass('public.platform_fee_config') IS NULL THEN
    RAISE EXCEPTION 'Apply shared commission migrations 0131/0135 and quick-ride migration 0139 before 0140';
  END IF;
END $preflight$;

-- Commercial dispatch must not publish a tariff with zero driver commission.
ALTER TABLE public.caronaa_quick_tariff_policies
  DROP CONSTRAINT IF EXISTS caronaa_quick_published_positive_commission;
ALTER TABLE public.caronaa_quick_tariff_policies
  ADD CONSTRAINT caronaa_quick_published_positive_commission
  CHECK (NOT published OR commission_bps > 0);

-- Exactly one quick-ride fee per completed quoted ride, with immutable
-- amount/rate from the fare quote. Shared fees remain in driver_platform_fees.
CREATE TABLE IF NOT EXISTS public.caronaa_quick_driver_fees (
  ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL UNIQUE REFERENCES public.caronaa_quick_fare_quotes(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  gross_cents integer NOT NULL CHECK (gross_cents > 0),
  fee_cents integer NOT NULL CHECK (fee_cents > 0),
  commission_bps integer NOT NULL CHECK (commission_bps BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SETTLED')),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_fee_verified_only_if_settled CHECK (
    (status = 'SETTLED') = (verified_at IS NOT NULL AND verified_by IS NOT NULL)
  ),
  CONSTRAINT quick_fee_matches_snapshot_rate CHECK (
    fee_cents = round((gross_cents::numeric * commission_bps) / 10000)::integer
  )
);
CREATE INDEX IF NOT EXISTS caronaa_quick_driver_fees_unpaid_idx
  ON public.caronaa_quick_driver_fees(driver_id, created_at)
  WHERE status <> 'SETTLED';
ALTER TABLE public.caronaa_quick_driver_fees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_driver_fees FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_accrue_completed_quick_ride_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fee$
DECLARE v_quote public.caronaa_quick_fare_quotes%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'COMPLETED' OR
     OLD.status IS NOT DISTINCT FROM 'COMPLETED' THEN RETURN NEW; END IF;
  IF NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'Completed quick ride has no assigned driver';
  END IF;
  SELECT * INTO v_quote FROM public.caronaa_quick_fare_quotes
  WHERE ride_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN
    -- A legacy pilot ride created BEFORE the quoted-dispatch release has no
    -- monetary contract; do not fabricate a debt from an invented fare.
    RETURN NEW;
  END IF;
  IF v_quote.passenger_id IS DISTINCT FROM NEW.passenger_id OR
     v_quote.vehicle_type IS DISTINCT FROM NEW.vehicle_type OR
     v_quote.municipality IS DISTINCT FROM NEW.municipality OR
     v_quote.platform_commission_cents <= 0 THEN
    RAISE EXCEPTION 'Quick ride fare snapshot mismatch; financial review required';
  END IF;
  INSERT INTO public.caronaa_quick_driver_fees(
    ride_id,quote_id,driver_id,gross_cents,fee_cents,commission_bps
  ) VALUES(
    NEW.id,v_quote.id,NEW.driver_id,v_quote.customer_pays_cents,
    v_quote.platform_commission_cents,v_quote.commission_bps
  ) ON CONFLICT(ride_id) DO NOTHING;
  RETURN NEW;
END $fee$;
REVOKE ALL ON FUNCTION public.caronaa_accrue_completed_quick_ride_fee()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS caronaa_completed_quick_ride_fee
  ON public.professional_quick_rides;
CREATE TRIGGER caronaa_completed_quick_ride_fee
  AFTER UPDATE OF status ON public.professional_quick_rides
  FOR EACH ROW EXECUTE FUNCTION public.caronaa_accrue_completed_quick_ride_fee();

-- Snapshot issued QR amount and Pix destination: it cannot be edited from the client.
CREATE TABLE IF NOT EXISTS public.caronaa_driver_fee_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  total_cents integer NOT NULL CHECK (total_cents > 0),
  item_count integer NOT NULL CHECK (item_count BETWEEN 1 AND 50),
  pix_key_snapshot text NOT NULL CHECK (length(btrim(pix_key_snapshot)) BETWEEN 6 AND 77),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLAIMED','SETTLED')),
  claim_reference text,
  claimed_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statement_claim_required CHECK (
    (status <> 'CLAIMED') OR (claim_reference IS NOT NULL AND claimed_at IS NOT NULL)
  ),
  CONSTRAINT statement_settled_requires_verification CHECK (
    (status <> 'SETTLED') OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS caronaa_fee_statement_unique_payment_claim
  ON public.caronaa_driver_fee_statements(lower(claim_reference))
  WHERE claim_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS caronaa_driver_fee_statements_pending_idx
  ON public.caronaa_driver_fee_statements(driver_id,created_at)
  WHERE status <> 'SETTLED';
ALTER TABLE public.caronaa_driver_fee_statements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_driver_fee_statements FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.caronaa_driver_fee_statement_items (
  statement_id uuid NOT NULL REFERENCES public.caronaa_driver_fee_statements(id) ON DELETE RESTRICT,
  source_kind text NOT NULL CHECK (source_kind IN ('SHARED','QUICK')),
  ride_id uuid NOT NULL,
  fee_cents integer NOT NULL CHECK (fee_cents > 0),
  PRIMARY KEY(statement_id, source_kind, ride_id),
  UNIQUE(source_kind,ride_id)
);
CREATE INDEX IF NOT EXISTS caronaa_fee_statement_items_lookup
  ON public.caronaa_driver_fee_statement_items(statement_id);
ALTER TABLE public.caronaa_driver_fee_statement_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_driver_fee_statement_items FROM PUBLIC,anon,authenticated;

-- A shared fee assigned to a payment statement cannot also be claimed by
-- the legacy one-ride manual payment flow; prevent two parallel receipts.
CREATE OR REPLACE FUNCTION public.caronaa_guard_shared_fee_in_statement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS (
    SELECT 1 FROM public.caronaa_driver_fee_statement_items i
    JOIN public.caronaa_driver_fee_statements s ON s.id=i.statement_id
    WHERE i.source_kind='SHARED' AND i.ride_id=NEW.ride_id
      AND s.status <> 'SETTLED'
  ) THEN
    RAISE EXCEPTION 'Fee is already assigned to a commission Pix statement';
  END IF;
  RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION public.caronaa_guard_shared_fee_in_statement()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS caronaa_guard_legacy_shared_fee_claim
  ON public.driver_platform_fees;
CREATE TRIGGER caronaa_guard_legacy_shared_fee_claim
  BEFORE UPDATE OF status ON public.driver_platform_fees
  FOR EACH ROW EXECUTE FUNCTION public.caronaa_guard_shared_fee_in_statement();

-- The existing 3-outstanding-ride gate applies to BOTH shared and quick rides.
CREATE OR REPLACE FUNCTION public.driver_platform_access_allowed(p_driver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $access$
  SELECT p_driver IS NOT NULL AND (
    (SELECT count(*) FROM public.driver_platform_fees f
      WHERE f.driver_id=p_driver AND f.status <> 'SETTLED') +
    (SELECT count(*) FROM public.caronaa_quick_driver_fees q
      WHERE q.driver_id=p_driver AND q.status <> 'SETTLED')
  ) < 3;
$access$;
REVOKE ALL ON FUNCTION public.driver_platform_access_allowed(uuid)
  FROM PUBLIC,anon,authenticated;

-- Read both ledgers; historic shared debts are NEVER duplicated.
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
    'driverAllowed',v_pending<3,'pendingTrips',v_pending,'limit',3,
    'totalOutstandingCents',v_total,'readyToInvoiceCents',v_ready,
    'platformPixConfigured',length(btrim(coalesce(v_key,'')))>=6,
    'dues',v_dues,'statements',v_statements
  );
END $read$;
REVOKE ALL ON FUNCTION public.get_my_caronaa_commission_ledger()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_caronaa_commission_ledger()
  TO authenticated;

-- Optional single-ride batch or all unbilled OPEN fees; no client amount.
-- Existing batches never silently change their Pix amount, even after
-- additional rides are completed.
CREATE OR REPLACE FUNCTION public.create_my_caronaa_fee_statement(
  p_source text DEFAULT NULL,p_ride_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $issue$
DECLARE v_driver uuid:=auth.uid(); v_pix text; v_total bigint:=0;
  v_count integer:=0; v_statement uuid; v_row record; v_items jsonb:='[]'::jsonb;
BEGIN
  IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF (p_source IS NULL) <> (p_ride_id IS NULL) OR
     (p_source IS NOT NULL AND p_source NOT IN ('SHARED','QUICK')) THEN
    RAISE EXCEPTION 'Invalid commission selection';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('caronaa_fee:'||v_driver::text,0));
  SELECT pix_key INTO v_pix FROM public.platform_fee_config WHERE singleton=true;
  IF length(btrim(coalesce(v_pix,''))) NOT BETWEEN 6 AND 77 THEN
    RAISE EXCEPTION 'Platform Pix key is not configured';
  END IF;
  IF p_source IS NOT NULL THEN
    SELECT i.statement_id INTO v_statement
    FROM public.caronaa_driver_fee_statement_items i
    JOIN public.caronaa_driver_fee_statements s ON s.id=i.statement_id
    WHERE i.source_kind=p_source AND i.ride_id=p_ride_id AND s.driver_id=v_driver;
    IF FOUND THEN RETURN v_statement; END IF;
  END IF;
  -- Lock source rows before selecting them into a new invoice. Independent
  -- legacy per-ride claims cannot race the statement assignment.
  FOR v_row IN
    SELECT source_kind,ride_id,fee_cents
    FROM (
      SELECT 'SHARED'::text AS source_kind,f.ride_id,
        round(f.fee_amount*100)::integer AS fee_cents,f.created_at
      FROM public.driver_platform_fees f
      WHERE f.driver_id=v_driver AND f.status='OPEN'
      UNION ALL
      SELECT 'QUICK',q.ride_id,q.fee_cents,q.created_at
      FROM public.caronaa_quick_driver_fees q
      WHERE q.driver_id=v_driver AND q.status='OPEN'
    ) d
    WHERE (p_source IS NULL OR (source_kind=p_source AND ride_id=p_ride_id))
      AND NOT EXISTS (
        SELECT 1 FROM public.caronaa_driver_fee_statement_items i
        WHERE i.source_kind=d.source_kind AND i.ride_id=d.ride_id
      )
    ORDER BY d.created_at,d.ride_id
    LIMIT 50
  LOOP
    IF v_row.source_kind='SHARED' THEN
      PERFORM 1 FROM public.driver_platform_fees
      WHERE ride_id=v_row.ride_id AND driver_id=v_driver AND status='OPEN' FOR UPDATE;
    ELSE
      PERFORM 1 FROM public.caronaa_quick_driver_fees
      WHERE ride_id=v_row.ride_id AND driver_id=v_driver AND status='OPEN' FOR UPDATE;
    END IF;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM public.caronaa_driver_fee_statement_items i
      WHERE i.source_kind=v_row.source_kind AND i.ride_id=v_row.ride_id) THEN CONTINUE; END IF;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'source',v_row.source_kind,'rideId',v_row.ride_id,'feeCents',v_row.fee_cents
    ));
    v_total:=v_total+v_row.fee_cents;
    v_count:=v_count+1;
  END LOOP;
  IF v_count=0 THEN
    SELECT id INTO v_statement FROM public.caronaa_driver_fee_statements
      WHERE driver_id=v_driver AND status IN ('OPEN','CLAIMED')
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND p_source IS NULL THEN RETURN v_statement; END IF;
    RAISE EXCEPTION 'No unbilled driver commissions for this selection';
  END IF;
  IF v_total>2147483647 THEN RAISE EXCEPTION 'Statement amount exceeds supported bounds'; END IF;
  INSERT INTO public.caronaa_driver_fee_statements(
    driver_id,total_cents,item_count,pix_key_snapshot
  ) VALUES(v_driver,v_total::integer,v_count,btrim(v_pix)) RETURNING id INTO v_statement;
  INSERT INTO public.caronaa_driver_fee_statement_items(
    statement_id,source_kind,ride_id,fee_cents
  ) SELECT v_statement,(item->>'source'),(item->>'rideId')::uuid,
      (item->>'feeCents')::integer
    FROM jsonb_array_elements(v_items) item;
  RETURN v_statement;
END $issue$;
REVOKE ALL ON FUNCTION public.create_my_caronaa_fee_statement(text,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_my_caronaa_fee_statement(text,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_my_caronaa_fee_statement(
  p_statement_id uuid,p_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $claim$
DECLARE v_status text; v_old_reference text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF length(btrim(coalesce(p_reference,''))) NOT BETWEEN 10 AND 180 THEN
    RAISE EXCEPTION 'Inform the bank Pix transaction identifier (10–180 characters)';
  END IF;
  SELECT status,claim_reference INTO v_status,v_old_reference
    FROM public.caronaa_driver_fee_statements
    WHERE id=p_statement_id AND driver_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Statement unavailable' USING ERRCODE='42501'; END IF;
  IF v_status='SETTLED' THEN RAISE EXCEPTION 'Statement already settled'; END IF;
  IF v_status='CLAIMED' THEN
    IF v_old_reference=btrim(p_reference) THEN RETURN true; END IF;
    RAISE EXCEPTION 'Statement already sent for financial verification';
  END IF;
  UPDATE public.caronaa_driver_fee_statements
    SET status='CLAIMED',claim_reference=btrim(p_reference),claimed_at=now()
    WHERE id=p_statement_id;
  RETURN true;
END $claim$;
REVOKE ALL ON FUNCTION public.claim_my_caronaa_fee_statement(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_my_caronaa_fee_statement(uuid,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_caronaa_fee_statement_claims()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $read$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance',false) THEN
    RAISE EXCEPTION 'Finance read permission required' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',s.id,'driverId',s.driver_id,'totalCents',s.total_cents,
    'itemCount',s.item_count,'claimReference',s.claim_reference,
    'claimedAt',s.claimed_at
  ) ORDER BY s.claimed_at)
  FROM public.caronaa_driver_fee_statements s WHERE s.status='CLAIMED'),'[]'::jsonb);
END $read$;
REVOKE ALL ON FUNCTION public.admin_caronaa_fee_statement_claims()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_caronaa_fee_statement_claims()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_verify_caronaa_fee_statement(
  p_statement_id uuid,p_received boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $verify$
DECLARE v_statement public.caronaa_driver_fee_statements%ROWTYPE;
  v_expected integer; v_shared integer; v_quick integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance',true) THEN
    RAISE EXCEPTION 'Finance write permission required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_statement FROM public.caronaa_driver_fee_statements
    WHERE id=p_statement_id FOR UPDATE;
  IF NOT FOUND OR v_statement.status<>'CLAIMED' THEN
    RAISE EXCEPTION 'No payment claim awaiting verification';
  END IF;
  IF p_received IS NULL THEN RAISE EXCEPTION 'Explicit bank verification decision required'; END IF;
  IF p_received IS FALSE THEN
    UPDATE public.caronaa_driver_fee_statements
    SET status='OPEN',claim_reference=NULL,claimed_at=NULL
    WHERE id=p_statement_id;
    RETURN true;
  END IF;
  -- Atomic: only the exact statement items become SETTLED, never all
  -- current debt (which may have grown since the QR was generated).
  SELECT count(*) INTO v_expected FROM public.caronaa_driver_fee_statement_items
    WHERE statement_id=p_statement_id;
  UPDATE public.caronaa_driver_fee_statements
    SET status='SETTLED',verified_by=auth.uid(),verified_at=now()
    WHERE id=p_statement_id;
  UPDATE public.driver_platform_fees f
    SET status='SETTLED',verified_at=now(),verified_by=auth.uid()
    FROM public.caronaa_driver_fee_statement_items i
    WHERE i.statement_id=p_statement_id AND i.source_kind='SHARED'
      AND i.ride_id=f.ride_id AND f.driver_id=v_statement.driver_id
      AND f.status='OPEN';
  GET DIAGNOSTICS v_shared=ROW_COUNT;
  UPDATE public.caronaa_quick_driver_fees q
    SET status='SETTLED',verified_at=now(),verified_by=auth.uid()
    FROM public.caronaa_driver_fee_statement_items i
    WHERE i.statement_id=p_statement_id AND i.source_kind='QUICK'
      AND i.ride_id=q.ride_id AND q.driver_id=v_statement.driver_id
      AND q.status='OPEN';
  GET DIAGNOSTICS v_quick=ROW_COUNT;
  IF v_shared+v_quick<>v_expected THEN
    RAISE EXCEPTION 'Statement item settlement mismatch: abort entire transaction';
  END IF;
  RETURN true;
END $verify$;
REVOKE ALL ON FUNCTION public.admin_verify_caronaa_fee_statement(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_caronaa_fee_statement(uuid,boolean)
  TO authenticated;

COMMENT ON TABLE public.caronaa_quick_driver_fees IS
  'One debt per quoted completed quick ride. Commission rate/amount snapshot immutable. No automatic confirmation of passenger payment.';
COMMENT ON TABLE public.caronaa_driver_fee_statements IS
  'Exact-amount static Pix invoice. Claim is NOT bank settlement; finance verifies the actual bank credit.';
NOTIFY pgrst,'reload schema';
COMMIT;
