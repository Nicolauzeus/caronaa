\set ON_ERROR_STOP on
-- Reapply to verify publication membership is idempotent.
\ir ../../drizzle/migrations/0031_enable_ride_realtime.sql
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['ride_requests', 'ride_offers', 'rides', 'ride_matches'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target) THEN
      RAISE EXCEPTION 'Table not published: %', target;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', target)::regclass) THEN
      RAISE EXCEPTION 'RLS disabled: %', target;
    END IF;
    RAISE NOTICE 'PASS: published with RLS: %', target;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('ride_boarding_codes', 'ride_locations')) THEN
    RAISE EXCEPTION 'Private safety data published';
  END IF;
  RAISE NOTICE 'PASS: boarding codes and GPS remain private';
END;
$$;
