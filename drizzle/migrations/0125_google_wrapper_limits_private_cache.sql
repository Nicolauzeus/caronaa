-- PROPOSTA NÃO APLICADA. Requer aprovação explícita.
-- Grants/policies só nas tabelas de custo, sem mudar radar ou pagamentos.
REVOKE ALL ON public.pilot_areas FROM anon, authenticated;
GRANT SELECT ON public.pilot_areas TO anon, authenticated;
GRANT ALL ON public.pilot_areas TO service_role;

DROP POLICY IF EXISTS geocoding_cache_read ON public.geocoding_cache;
REVOKE ALL ON public.geocoding_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.geocoding_cache TO service_role;

ALTER VIEW public.v_google_api_daily_usage
  SET (security_invoker = true);
REVOKE ALL ON public.v_google_api_daily_usage FROM PUBLIC, anon;
GRANT SELECT ON public.v_google_api_daily_usage TO authenticated;
GRANT ALL ON public.v_google_api_daily_usage TO service_role;

REVOKE ALL ON public.google_api_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_api_usage TO authenticated;
GRANT ALL ON public.google_api_usage TO service_role;
ALTER TABLE public.google_api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_usage_admin ON public.google_api_usage;
CREATE POLICY api_usage_admin ON public.google_api_usage
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role = 'admin'
  ));

CREATE TABLE public.google_request_rate_buckets (
  user_id uuid NOT NULL,
  operation text NOT NULL CHECK (
    operation IN ('autocomplete','quote','details')
  ),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (user_id, operation, window_started_at)
);
GRANT ALL ON public.google_request_rate_buckets TO service_role;
ALTER TABLE public.google_request_rate_buckets ENABLE ROW LEVEL SECURITY;
-- Sem policies de cliente: contadores privados do servidor.

CREATE TABLE public.google_response_cache (
  user_id uuid NOT NULL,
  cache_kind text NOT NULL CHECK (
    cache_kind IN ('places_search_text','route_quote')
  ),
  request_hash text NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, cache_kind, request_hash),
  CHECK (expires_at > created_at),
  CHECK (
    (cache_kind = 'places_search_text'
      AND expires_at <= created_at + interval '30 days')
    OR
    (cache_kind = 'route_quote'
      AND expires_at <= created_at + interval '10 minutes')
  )
);
GRANT ALL ON public.google_response_cache TO service_role;
ALTER TABLE public.google_response_cache ENABLE ROW LEVEL SECURITY;
-- Cache por usuário, sem acesso direto do navegador.
CREATE INDEX google_response_cache_expiry_idx
  ON public.google_response_cache (expires_at);

CREATE OR REPLACE FUNCTION public.consume_google_request_limit(
  p_user_id uuid, p_operation text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $limit$
DECLARE
  v_max integer;
  v_count integer;
  v_window timestamptz := date_trunc('minute', clock_timestamp());
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required' USING ERRCODE='22023';
  END IF;
  v_max := CASE p_operation
    WHEN 'autocomplete' THEN 30
    WHEN 'quote' THEN 10
    WHEN 'details' THEN 20
    ELSE NULL
  END;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.google_request_rate_buckets AS bucket
    (user_id, operation, window_started_at, request_count)
  VALUES (p_user_id, p_operation, v_window, 1)
  ON CONFLICT (user_id, operation, window_started_at)
  DO UPDATE SET request_count = bucket.request_count + 1
    WHERE bucket.request_count < v_max
  RETURNING request_count INTO v_count;
  RETURN v_count IS NOT NULL;
END
$limit$;
REVOKE ALL ON FUNCTION public.consume_google_request_limit(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_request_limit(uuid,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_google_wrapper_tables()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $purge$
  DELETE FROM public.google_response_cache WHERE expires_at < now();
  DELETE FROM public.google_request_rate_buckets
    WHERE window_started_at < now() - interval '1 day';
$purge$;
REVOKE ALL ON FUNCTION public.purge_google_wrapper_tables()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_google_wrapper_tables()
  TO service_role;