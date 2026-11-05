-- 0133: defense-in-depth for radar eligibility and concurrent fee acknowledgements.
-- Reuses existing SQL RPC signatures, adding finance predicates without changing payloads.
BEGIN;
DO $guard_rpcs$
DECLARE v_definition text; v_rewrite text;
BEGIN
  SELECT pg_get_functiondef('public.discover_approximate_professional_drivers(text)'::regprocedure)
  INTO v_definition;
  IF position('driver_platform_access_allowed' IN v_definition)=0 THEN
    v_rewrite:=regexp_replace(v_definition,
      '(WHERE[[:space:]]+l\.municipality[[:space:]]*=[[:space:]]*btrim\(p_municipality\))',
      E'\\1\n   AND public.driver_platform_access_allowed(l.user_id)');
    IF v_rewrite=v_definition THEN
      RAISE EXCEPTION 'Professional discovery predicate was not located';
    END IF;
    EXECUTE v_rewrite;
  END IF;

  SELECT pg_get_functiondef('public.quick_ride_driver_queue(text)'::regprocedure)
  INTO v_definition;
  IF position('driver_platform_access_allowed' IN v_definition)=0 THEN
    v_rewrite:=regexp_replace(v_definition,
      '(IF[[:space:]]+auth\.uid\(\)[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR[[:space:]]+NOT[[:space:]]+EXISTS)',
      E'IF NOT public.driver_platform_access_allowed(auth.uid()) THEN RETURN; END IF;\n \\1');
    IF v_rewrite=v_definition THEN RAISE EXCEPTION 'Quick queue guard was not located'; END IF;
    EXECUTE v_rewrite;
  END IF;

  SELECT pg_get_functiondef('public.confirm_manual_ride_payment(uuid)'::regprocedure)
  INTO v_definition;
  IF position('pg_advisory_xact_lock(hashtextextended(v_ride.driver_user_id::text' IN v_definition)=0 THEN
    v_rewrite:=replace(v_definition,
      'SELECT passenger_count INTO v_count',
      'PERFORM pg_advisory_xact_lock(hashtextextended(v_ride.driver_user_id::text, 0));' ||
      E'\n  SELECT passenger_count INTO v_count');
    IF v_rewrite=v_definition THEN RAISE EXCEPTION 'Confirmation serialization anchor was not located'; END IF;
    EXECUTE v_rewrite;
  END IF;
END $guard_rpcs$;
NOTIFY pgrst,'reload schema';
COMMIT;
