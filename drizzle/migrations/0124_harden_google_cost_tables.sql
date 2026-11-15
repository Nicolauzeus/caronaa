ALTER VIEW public.v_google_api_daily_usage SET (security_invoker = true);
REVOKE ALL ON public.v_google_api_daily_usage FROM anon;
DROP POLICY IF EXISTS "geocoding_cache_read" ON public.geocoding_cache;
REVOKE ALL ON public.geocoding_cache FROM anon, authenticated;
GRANT ALL ON public.geocoding_cache TO service_role;
GRANT ALL ON public.google_api_usage TO service_role;
GRANT SELECT ON public.pilot_areas TO anon, authenticated;
GRANT ALL ON public.pilot_areas TO service_role;
CREATE INDEX IF NOT EXISTS google_api_usage_date_service_idx ON public.google_api_usage (call_date, api_service);
CREATE INDEX IF NOT EXISTS geocoding_cache_expires_idx ON public.geocoding_cache (expires_at);
CREATE OR REPLACE FUNCTION public.purge_google_cost_tables()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.google_api_usage WHERE created_at < now() - interval '90 days';
  DELETE FROM public.geocoding_cache WHERE expires_at < now();
$$;
REVOKE ALL ON FUNCTION public.purge_google_cost_tables() FROM PUBLIC, anon, authenticated;