-- 0135 | Restore 15% commission for NEW manual Pix settlements only.
-- Must run AFTER 0134_payment_method_exclusivity_commission_1686.sql.
-- Does NOT rewrite historical debts, create charges, or enable Asaas.
BEGIN;

-- This table stores a snapshot of the rate on each debt, not a dynamic rate.
-- Preserve both historical rates for audits, and change ONLY the default.
DO $preflight$
BEGIN
  IF to_regclass('public.driver_platform_fees') IS NULL
     OR to_regclass('public.ride_payment_policy') IS NULL THEN
    RAISE EXCEPTION 'Run migration 0134 before 0135.';
  END IF;
END $preflight$;

ALTER TABLE public.driver_platform_fees
  ALTER COLUMN fee_rate SET DEFAULT 0.1500;

COMMENT ON COLUMN public.driver_platform_fees.fee_rate IS
  'Per-ride historical snapshot. New MANUAL_PIX confirmations: 15%; prior 16.86% rows retained. Asaas fees are handled separately.';

-- Keep the method locked and keep the original fee, amount, locking and
-- authorization logic intact. Patch only the existing commission literals.
DO $patch_manual_fee$
DECLARE
  v_def text;
  v_next text;
BEGIN
  SELECT pg_get_functiondef('public.confirm_manual_ride_payment(uuid)'::regprocedure)
    INTO v_def;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'confirm_manual_ride_payment(uuid) missing';
  END IF;

  -- Require the migration-0134 implementation, including an explicitly
  -- persisted rate; refuse to overwrite an unexpected future implementation.
  IF position('fee_amount,fee_rate' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected 0134 fee_rate insert not found. Review manually.';
  END IF;

  IF position('round(v_gross*0.1686,2)' IN v_def) > 0
    AND position('0.1686)' IN v_def) > 0 THEN
    v_next := replace(v_def,
      'round(v_gross*0.1686,2)',
      'round(v_gross*0.15,2)');
    v_next := replace(v_next,
      'greatest(0.01,round(v_gross*0.15,2)),0.1686)',
      'greatest(0.01,round(v_gross*0.15,2)),0.1500)');
    IF v_next = v_def OR position('greatest(0.01,round(v_gross*0.15,2)),0.1500)' IN v_next) = 0 THEN
      RAISE EXCEPTION 'Manual fee patch did not match expected 0134 function';
    END IF;
    EXECUTE v_next;
  ELSIF position('greatest(0.01,round(v_gross*0.15,2)),0.1500)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected manual fee function. Review before migration.';
  END IF;

  -- This label is specifically shown to drivers for manual platform fees.
  SELECT pg_get_functiondef('public.get_my_driver_platform_fees()'::regprocedure)
    INTO v_def;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_my_driver_platform_fees() missing';
  END IF;
  IF position('''feePercent'', 16.86' IN v_def) > 0 THEN
    EXECUTE replace(v_def, '''feePercent'', 16.86', '''feePercent'', 15');
  ELSIF position('''feePercent'', 15' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected driver fee summary. Review before migration.';
  END IF;
END $patch_manual_fee$;

-- Asaas remains explicitly disabled in this release. This is idempotent.
UPDATE public.ride_payment_policy
SET manual_enabled=true, asaas_enabled=false, updated_at=now()
WHERE singleton=true AND (manual_enabled IS DISTINCT FROM true OR asaas_enabled IS DISTINCT FROM false);

-- Assertions: both the inserted rate and driver-facing display must now use 15%.
DO $verify$
DECLARE v_confirm text; v_view text;
BEGIN
  SELECT pg_get_functiondef('public.confirm_manual_ride_payment(uuid)'::regprocedure) INTO v_confirm;
  SELECT pg_get_functiondef('public.get_my_driver_platform_fees()'::regprocedure) INTO v_view;
  IF position('greatest(0.01,round(v_gross*0.15,2)),0.1500)' IN v_confirm) = 0
     OR position('''feePercent'', 15' IN v_view) = 0 THEN
    RAISE EXCEPTION '0135 verification failed. Transaction rolled back.';
  END IF;
END $verify$;

NOTIFY pgrst, 'reload schema';
COMMIT;
