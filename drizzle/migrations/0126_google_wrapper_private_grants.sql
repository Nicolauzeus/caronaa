REVOKE ALL ON public.google_request_rate_buckets
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_request_rate_buckets TO service_role;

REVOKE ALL ON public.google_response_cache
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_response_cache TO service_role;