-- 0104: Expand declared/operational OFFER capacity to seven passenger seats.
-- Passenger requests remain capped at six (a different business rule).
-- Preflight against the live schema before applying. Roll back by restoring
-- original function definitions and constraints only after verifying no >6 records.
DO $preflight$
BEGIN
 IF to_regclass('public.ride_offers') IS NULL OR
    to_regclass('public.ride_routines') IS NULL OR
    to_regprocedure('public.validate_research_answer()') IS NULL OR
    to_regprocedure('public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text)') IS NULL THEN
   RAISE EXCEPTION '0104 requires existing ride and survey schema. No change applied.';
 END IF;
END $preflight$;

ALTER TABLE public.ride_offers
  DROP CONSTRAINT IF EXISTS ride_offers_available_seats_check;
ALTER TABLE public.ride_offers
  ADD CONSTRAINT ride_offers_available_seats_check
  CHECK (available_seats BETWEEN 1 AND 7) NOT VALID;
ALTER TABLE public.ride_offers VALIDATE CONSTRAINT ride_offers_available_seats_check;

ALTER TABLE public.ride_routines
  DROP CONSTRAINT IF EXISTS ride_routines_seat_count_check;
ALTER TABLE public.ride_routines
  ADD CONSTRAINT ride_routines_seat_count_check CHECK (
    (kind='offer' AND seat_count BETWEEN 1 AND 7)
    OR (kind='request' AND seat_count BETWEEN 1 AND 6)
  ) NOT VALID;
ALTER TABLE public.ride_routines VALIDATE CONSTRAINT ride_routines_seat_count_check;

-- Preserve the current (possibly security-hardened) implementation of the
-- canonical offer RPC; only update the exact seat threshold in its definition.
DO $offer$
DECLARE fn regprocedure :=
  to_regprocedure('public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text)');
  definition text;
BEGIN
 SELECT pg_get_functiondef(fn) INTO definition;
 -- Some production versions delegate this check to the table constraint
 -- instead of duplicating it in the RPC. Do not abort when it is absent.
 IF strpos(definition,'p_available_seats NOT BETWEEN 1 AND 6') > 0 THEN
   EXECUTE replace(definition,
     'p_available_seats NOT BETWEEN 1 AND 6',
     'p_available_seats NOT BETWEEN 1 AND 7');
 ELSE
   RAISE NOTICE 'Offer RPC already delegates capacity validation to table constraints';
 END IF;
END $offer$;

-- Existing published research form schemas remain unchanged; the canonical
-- semantic rule takes precedence for passenger-seat availability.
DO $research$
DECLARE definition text;
  needle text := 'IF v_question ? ''maxValue'' THEN v_max:=(v_question->>''maxValue'')::numeric; END IF;';
BEGIN
 SELECT pg_get_functiondef('public.validate_research_answer()'::regprocedure)
 INTO definition;
 IF strpos(definition,needle)=0 THEN
   RAISE EXCEPTION 'Unexpected research validator; review 0100 lineage before applying';
 END IF;
 definition:=replace(definition,needle,
   needle || E'\n' ||
   'IF v_semantic IN (''SEATS_AVAILABLE'',''EVENT_OFFER_SEATS'') OR v_fallback_key=''seats'' THEN v_max:=7;v_integer:=true; END IF;');
 EXECUTE definition;
END $research$;

-- The corporate-driver preflight in 0099 is in the assertion function
-- (not in submit_configured_research_answer).
DO $corporate$
DECLARE fn regprocedure :=
  to_regprocedure('public.assert_corporate_research_driver(uuid,uuid,jsonb,jsonb)');
  definition text;
BEGIN
 IF fn IS NULL THEN RAISE EXCEPTION 'Configured survey submission function missing'; END IF;
 SELECT pg_get_functiondef(fn) INTO definition;
 IF strpos(definition,'^[1-4]
END $corporate$;
NOTIFY pgrst,'reload schema';
)>0 THEN
   EXECUTE replace(definition,'^[1-4]
END $corporate$;
NOTIFY pgrst,'reload schema';
,'^[1-7]
END $corporate$;
NOTIFY pgrst,'reload schema';
);
 ELSIF strpos(definition,'^[1-7]
END $corporate$;
NOTIFY pgrst,'reload schema';
)=0 THEN
   RAISE EXCEPTION 'Corporate seat rule differs from expected version';
 END IF;
END $corporate$;
NOTIFY pgrst,'reload schema';
