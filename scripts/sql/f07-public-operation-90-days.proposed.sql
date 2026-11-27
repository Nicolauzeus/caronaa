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