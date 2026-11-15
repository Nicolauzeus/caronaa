CREATE TABLE public.google_public_daily_budget (
  budget_day date PRIMARY KEY,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 2000)
);
REVOKE ALL ON public.google_public_daily_budget FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_public_daily_budget TO service_role;
ALTER TABLE public.google_public_daily_budget ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_public_session_buckets (
  session_hash text NOT NULL CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  operation text NOT NULL CHECK (operation IN ('autocomplete','quote','details')),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 30),
  PRIMARY KEY (session_hash, operation, window_started_at)
);
REVOKE ALL ON public.google_public_session_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_public_session_buckets TO service_role;
ALTER TABLE public.google_public_session_buckets ENABLE ROW LEVEL SECURITY;
CREATE INDEX google_public_session_buckets_expiry_idx
  ON public.google_public_session_buckets(window_started_at);

CREATE FUNCTION public.consume_google_public_request_limit(
  p_session_hash text, p_operation text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $budget$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now AT TIME ZONE 'America/Fortaleza')::date;
  v_window timestamptz := date_trunc('minute', v_now);
  v_max integer;
  v_daily integer;
  v_session integer;
BEGIN
  IF p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid anonymous session hash' USING ERRCODE='22023';
  END IF;
  v_max := CASE p_operation
    WHEN 'autocomplete' THEN 30
    WHEN 'quote' THEN 10
    WHEN 'details' THEN 20
    ELSE NULL END;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
  END IF;

  -- Short transaction-wide lock makes the two budget checks atomic.
  PERFORM pg_advisory_xact_lock(718042, 2000);
  SELECT request_count INTO v_daily
    FROM public.google_public_daily_budget WHERE budget_day = v_day;
  IF coalesce(v_daily, 0) >= 2000 THEN RETURN 'DAILY_LIMIT'; END IF;
  SELECT request_count INTO v_session
    FROM public.google_public_session_buckets
    WHERE session_hash = p_session_hash AND operation = p_operation
      AND window_started_at = v_window;
  IF coalesce(v_session, 0) >= v_max THEN RETURN 'SESSION_LIMIT'; END IF;

  INSERT INTO public.google_public_daily_budget AS b (budget_day, request_count)
    VALUES (v_day, 1)
    ON CONFLICT (budget_day) DO UPDATE SET request_count = b.request_count + 1;
  INSERT INTO public.google_public_session_buckets AS b
    (session_hash, operation, window_started_at, request_count)
    VALUES (p_session_hash, p_operation, v_window, 1)
    ON CONFLICT (session_hash, operation, window_started_at)
    DO UPDATE SET request_count = b.request_count + 1;
  RETURN 'ALLOWED';
END
$budget$;
REVOKE ALL ON FUNCTION public.consume_google_public_request_limit(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_public_request_limit(text,text)
  TO service_role;

CREATE FUNCTION public.purge_google_public_request_budgets()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $purge$
  DELETE FROM public.google_public_session_buckets
    WHERE window_started_at < now() - interval '1 day';
  DELETE FROM public.google_public_daily_budget
    WHERE budget_day < (now() AT TIME ZONE 'America/Fortaleza')::date - 7;
$purge$;
REVOKE ALL ON FUNCTION public.purge_google_public_request_budgets()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_google_public_request_budgets()
  TO service_role;