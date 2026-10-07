-- Preserve existing RLS; publish only the operational tables, never PINs or GPS.
DO $$
DECLARE target text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH target IN ARRAY ARRAY['ride_requests', 'ride_offers', 'rides', 'ride_matches'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
    END IF;
  END LOOP;
END;
$$;
