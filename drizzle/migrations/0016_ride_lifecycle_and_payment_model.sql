-- Operational rides are distinct from matches. A match creates one ride in MATCHED.
CREATE TABLE public.rides (
  ride_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.ride_matches(match_id) ON DELETE RESTRICT,
  request_id uuid NOT NULL REFERENCES public.ride_requests(request_id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES public.ride_offers(offer_id) ON DELETE RESTRICT,
  passenger_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (passenger_user_id <> driver_user_id),
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE TABLE public.ride_status_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ride_completion_confirmations (
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, user_id)
);

ALTER TABLE public.product_events
  ADD COLUMN trusted_source boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_id uuid;

-- Preserve historic events only when they can be tied back to persisted domain rows.
UPDATE public.product_events pe SET trusted_source = true, request_id = rr.request_id
FROM public.ride_requests rr
WHERE pe.event_name = 'RIDE_REQUEST_CREATED' AND pe.ride_id = rr.request_id::text
  AND pe.user_id = rr.user_id;
UPDATE public.product_events pe SET trusted_source = true, offer_id = ro.offer_id
FROM public.ride_offers ro
WHERE pe.event_name = 'RIDE_OFFER_CREATED' AND pe.ride_id = ro.offer_id::text
  AND pe.user_id = ro.user_id;
UPDATE public.product_events pe SET trusted_source = true
FROM public.ride_matches rm
WHERE pe.event_name = 'MATCH_CREATED' AND pe.match_id = rm.match_id::text
  AND pe.user_id = rm.passenger_user_id AND pe.request_id = rm.request_id AND pe.offer_id = rm.offer_id;

-- Backfill operational rides for matches that predate this migration.
INSERT INTO public.rides (match_id, request_id, offer_id, passenger_user_id, driver_user_id, status)
SELECT match_id, request_id, offer_id, passenger_user_id, driver_user_id, 'MATCHED'
FROM public.ride_matches
ON CONFLICT (match_id) DO NOTHING;
UPDATE public.ride_matches rm SET ride_id = r.ride_id::text FROM public.rides r WHERE r.match_id = rm.match_id;
UPDATE public.product_events pe SET ride_id = r.ride_id::text, trusted_source = true
FROM public.rides r JOIN public.ride_matches rm ON rm.match_id = r.match_id
WHERE pe.event_name = 'MATCH_CREATED' AND pe.match_id = r.match_id::text
  AND pe.user_id = rm.passenger_user_id AND pe.request_id = rm.request_id AND pe.offer_id = rm.offer_id;
INSERT INTO public.ride_status_history (ride_id, from_status, to_status, created_at)
SELECT r.ride_id, NULL, 'MATCHED', r.created_at FROM public.rides r
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX product_events_ride_completed_once_idx
  ON public.product_events (ride_id)
  WHERE event_name = 'RIDE_COMPLETED' AND trusted_source AND ride_id IS NOT NULL;

CREATE TYPE public.payment_status AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TABLE public.payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  payer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider text NOT NULL CHECK (length(btrim(provider)) > 0),
  provider_reference text,
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK ((status IN ('PAID', 'REFUNDED')) = (paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX payments_provider_reference_once_idx
  ON public.payments (provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX product_events_payment_completed_once_idx
  ON public.product_events (payment_id)
  WHERE event_name = 'PAYMENT_COMPLETED' AND trusted_source AND payment_id IS NOT NULL;
ALTER TABLE public.product_events ADD CONSTRAINT product_events_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(payment_id) ON DELETE RESTRICT;

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_completion_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rides, public.ride_status_history, public.ride_completion_confirmations, public.payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rides, public.ride_status_history, public.ride_completion_confirmations, public.payments FROM anon, authenticated;
GRANT ALL ON public.rides, public.ride_status_history, public.ride_completion_confirmations, public.payments TO service_role;

CREATE POLICY "Ride participants read rides" ON public.rides FOR SELECT TO authenticated
  USING (auth.uid() = passenger_user_id OR auth.uid() = driver_user_id);
CREATE POLICY "Ride participants read status history" ON public.ride_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.ride_id = ride_status_history.ride_id AND auth.uid() IN (r.passenger_user_id, r.driver_user_id)));
CREATE POLICY "Participants read completion confirmations" ON public.ride_completion_confirmations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.ride_id = ride_completion_confirmations.ride_id AND auth.uid() IN (r.passenger_user_id, r.driver_user_id)));
CREATE POLICY "Payment participants read payments" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = payer_user_id OR EXISTS (SELECT 1 FROM public.rides r WHERE r.ride_id = payments.ride_id AND auth.uid() = r.driver_user_id));

-- Domain events (including request/offer/match events) cannot be forged from a browser.
DROP POLICY IF EXISTS "Users register their own non-match product events" ON public.product_events;
DROP POLICY IF EXISTS "Users register their own product events" ON public.product_events;
CREATE POLICY "Users register their own non-operational product events" ON public.product_events
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND event_name NOT IN (
      'RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED', 'MATCH_CREATED',
      'RIDE_STARTED', 'RIDE_COMPLETED', 'PAYMENT_COMPLETED', 'RIDE_REPEATED'
    )
  );

CREATE OR REPLACE FUNCTION public.track_ride_creation_product_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE event_kind public.product_event_name; prior_count integer; domain_ride_id text; event_metadata jsonb;
BEGIN
  IF TG_TABLE_NAME = 'ride_requests' THEN
    event_kind := 'RIDE_REQUEST_CREATED';
    SELECT count(*) INTO prior_count FROM public.ride_requests WHERE user_id = NEW.user_id;
    domain_ride_id := NEW.request_id::text;
    event_metadata := jsonb_build_object('requestId', NEW.request_id, 'origin', NEW.origin, 'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', 'PASSAGEIRO', 'passengerCount', NEW.passenger_count);
  ELSE
    event_kind := 'RIDE_OFFER_CREATED';
    SELECT count(*) INTO prior_count FROM public.ride_offers WHERE user_id = NEW.user_id;
    domain_ride_id := NEW.offer_id::text;
    event_metadata := jsonb_build_object('offerId', NEW.offer_id, 'origin', NEW.origin, 'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', 'MOTORISTA', 'availableSeats', NEW.available_seats);
  END IF;
  INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at, trusted_source)
  VALUES (event_kind, NEW.user_id, domain_ride_id, NEW.status, 'direct', event_metadata, NEW.created_at, true);
  IF prior_count > 1 THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at, trusted_source)
    VALUES ('RIDE_REPEATED', NEW.user_id, domain_ride_id, NEW.status, 'direct', jsonb_build_object('domainEvent', event_kind), NEW.created_at, true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_persisted_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE passenger_count integer; created_ride_id uuid;
BEGIN
  SELECT rr.passenger_count INTO passenger_count FROM public.ride_requests rr WHERE rr.request_id = NEW.request_id;
  INSERT INTO public.rides (match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at)
  VALUES (NEW.match_id, NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, 'MATCHED', NEW.created_at)
  ON CONFLICT (match_id) DO UPDATE SET match_id = EXCLUDED.match_id
  RETURNING ride_id INTO created_ride_id;
  UPDATE public.ride_matches SET ride_id = created_ride_id::text WHERE match_id = NEW.match_id;
  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, created_at)
  VALUES (created_ride_id, NULL, 'MATCHED', NEW.created_at)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.product_events (
    event_name, user_id, ride_id, match_id, status, source, created_at,
    request_id, offer_id, passenger_user_id, driver_user_id, metadata, trusted_source
  ) VALUES (
    'MATCH_CREATED', NEW.passenger_user_id, created_ride_id::text, NEW.match_id::text,
    NEW.status, 'direct', NEW.created_at, NEW.request_id, NEW.offer_id,
    NEW.passenger_user_id, NEW.driver_user_id,
    jsonb_build_object('requestId', NEW.request_id, 'offerId', NEW.offer_id, 'passengerUserId', NEW.passenger_user_id, 'driverUserId', NEW.driver_user_id, 'rideId', created_ride_id, 'seatsOccupied', passenger_count), true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- One-sided operational transitions are participant-authenticated. COMPLETED requires
-- both passenger and driver to confirm while the ride is IN_PROGRESS.
CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ride_row public.rides%ROWTYPE; caller uuid := auth.uid(); valid_transition boolean := false;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (ride_row.passenger_user_id, ride_row.driver_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  valid_transition :=
    (ride_row.status = 'MATCHED' AND p_next_status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'CONFIRMED' AND p_next_status IN ('IN_PROGRESS', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'IN_PROGRESS' AND p_next_status IN ('CANCELLED', 'NO_SHOW'));
  IF p_next_status = 'COMPLETED' AND ride_row.status = 'IN_PROGRESS' THEN
    INSERT INTO public.ride_completion_confirmations (ride_id, user_id)
    VALUES (p_ride_id, caller) ON CONFLICT (ride_id, user_id) DO NOTHING;
    IF (SELECT count(*) FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id) < 2 THEN
      RETURN 'AWAITING_OTHER_PARTICIPANT';
    END IF;
    valid_transition := true;
  END IF;
  IF NOT valid_transition THEN RAISE EXCEPTION 'Invalid ride transition: % -> %', ride_row.status, p_next_status; END IF;
  UPDATE public.rides SET status = p_next_status, updated_at = now(),
    completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN now() ELSE NULL END
  WHERE ride_id = p_ride_id;
  UPDATE public.ride_matches SET status = CASE WHEN p_next_status = 'COMPLETED' THEN 'completed' WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled' ELSE status END
  WHERE match_id = ride_row.match_id;
  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, ride_row.status, p_next_status, caller);
  RETURN p_next_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_ride_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'COMPLETED' THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, match_id, status, source, created_at, request_id, offer_id, passenger_user_id, driver_user_id, trusted_source, metadata)
    VALUES ('RIDE_COMPLETED', NEW.passenger_user_id, NEW.ride_id::text, NEW.match_id::text, NEW.status, 'domain', NEW.completed_at, NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, true, jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id))
    ON CONFLICT DO NOTHING;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'IN_PROGRESS' THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, match_id, status, source, created_at, request_id, offer_id, passenger_user_id, driver_user_id, trusted_source, metadata)
    VALUES ('RIDE_STARTED', NEW.driver_user_id, NEW.ride_id::text, NEW.match_id::text, NEW.status, 'domain', now(), NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, true, jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ride_status_event AFTER UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.track_ride_status_event();

-- No provider or webhook exists yet. This trigger is ready for trusted provider integration,
-- while client roles are denied all writes to payments and product_events.
CREATE OR REPLACE FUNCTION public.track_payment_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'PAID' THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, payment_id, status, source, created_at, trusted_source, metadata)
    VALUES ('PAYMENT_COMPLETED', NEW.payer_user_id, NEW.ride_id::text, NEW.payment_id, NEW.status, NEW.provider, NEW.paid_at, true,
      jsonb_build_object('paymentId', NEW.payment_id, 'rideId', NEW.ride_id, 'amount', NEW.amount, 'currency', NEW.currency, 'provider', NEW.provider, 'providerReference', NEW.provider_reference, 'paidAt', NEW.paid_at))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_status_event AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.track_payment_completed();

CREATE OR REPLACE FUNCTION public.prevent_direct_paid_payment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'Payments must start in PENDING'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rides r WHERE r.ride_id = NEW.ride_id
      AND NEW.payer_user_id IN (r.passenger_user_id, r.driver_user_id)
  ) THEN RAISE EXCEPTION 'Payment payer must participate in the ride'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_start_unpaid BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_paid_payment_insert();

CREATE OR REPLACE FUNCTION public.enforce_payment_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('PROCESSING', 'FAILED', 'CANCELLED')) OR
    (OLD.status = 'PROCESSING' AND NEW.status IN ('PAID', 'FAILED', 'CANCELLED')) OR
    (OLD.status = 'PAID' AND NEW.status = 'REFUNDED')
  ) THEN RAISE EXCEPTION 'Invalid payment status transition: % -> %', OLD.status, NEW.status; END IF;
  IF NEW.status = 'PAID' THEN NEW.paid_at := coalesce(NEW.paid_at, now()); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_status_transition BEFORE UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_status_transition();

-- Retention counts only database-verified completions. Old browser-inserted
-- events remain stored for audit but cannot become operational truth.
CREATE OR REPLACE FUNCTION public.get_retention_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH authorized AS (SELECT public.has_role(auth.uid(), 'admin') AS is_admin),
  completed AS (
    SELECT participant.user_id, pe.ride_id AS completed_ride_id, min(pe.created_at) AS completed_at
    FROM public.product_events pe CROSS JOIN authorized a
    CROSS JOIN LATERAL (VALUES (pe.passenger_user_id), (pe.driver_user_id)) AS participant(user_id)
    WHERE a.is_admin AND pe.event_name = 'RIDE_COMPLETED' AND pe.trusted_source AND pe.ride_id IS NOT NULL AND participant.user_id IS NOT NULL
      AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR pe.created_at < p_period_end)
      AND (p_source IS NULL OR pe.source = p_source)
      AND (p_campaign IS NULL OR pe.campaign = p_campaign)
    GROUP BY participant.user_id, pe.ride_id
  ),
  roles AS (
    SELECT pe.user_id,
      bool_or(pe.event_name = 'RIDE_REQUEST_CREATED') AS is_passenger,
      bool_or(pe.event_name = 'RIDE_OFFER_CREATED') AS is_driver
    FROM public.product_events pe WHERE pe.trusted_source AND pe.event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED')
    GROUP BY pe.user_id
  ),
  per_user AS (
    SELECT c.user_id, count(*)::int AS ride_count, min(c.completed_at) AS first_completed_at,
      CASE WHEN coalesce(r.is_passenger, false) AND coalesce(r.is_driver, false) THEN 'AMBOS'::public.form_tipo_usuario
           WHEN coalesce(r.is_driver, false) THEN 'MOTORISTA'::public.form_tipo_usuario
           ELSE 'PASSAGEIRO'::public.form_tipo_usuario END AS profile
    FROM completed c LEFT JOIN roles r ON r.user_id = c.user_id
    GROUP BY c.user_id, r.is_passenger, r.is_driver
  ),
  users AS (
    SELECT pu.user_id, pu.ride_count, pu.first_completed_at, pu.profile,
      (SELECT min(c.completed_at) FROM completed c WHERE c.user_id = pu.user_id AND c.completed_at > pu.first_completed_at) AS second_completed_at
    FROM per_user pu
  ),
  scoped AS (SELECT * FROM users WHERE p_tipo_usuario IS NULL OR profile = p_tipo_usuario),
  profile_distribution AS (
    SELECT profile, count(*) FILTER (WHERE ride_count = 1)::int AS one,
      count(*) FILTER (WHERE ride_count = 2)::int AS two,
      count(*) FILTER (WHERE ride_count >= 3)::int AS "threeOrMore"
    FROM scoped GROUP BY profile
  )
  SELECT jsonb_build_object(
    'usersWith1Ride', count(*) FILTER (WHERE ride_count = 1),
    'usersWith2Rides', count(*) FILTER (WHERE ride_count = 2),
    'usersWith3OrMoreRides', count(*) FILTER (WHERE ride_count >= 3),
    'repeatRate7d', coalesce(round(100.0 * count(*) FILTER (WHERE second_completed_at <= first_completed_at + interval '7 days') / nullif(count(*), 0), 2), 0),
    'repeatRate30d', coalesce(round(100.0 * count(*) FILTER (WHERE second_completed_at <= first_completed_at + interval '30 days') / nullif(count(*), 0), 2), 0),
    'distribution', jsonb_build_object('one', count(*) FILTER (WHERE ride_count = 1), 'two', count(*) FILTER (WHERE ride_count = 2), 'threeToFive', count(*) FILTER (WHERE ride_count BETWEEN 3 AND 5), 'sixOrMore', count(*) FILTER (WHERE ride_count >= 6)),
    'byProfile', coalesce((SELECT jsonb_object_agg(profile, jsonb_build_object('one', one, 'two', two, 'threeOrMore', "threeOrMore")) FROM profile_distribution), '{}'::jsonb)
  ) FROM scoped;
$$;
REVOKE ALL ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.track_ride_creation_product_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_persisted_match_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_ride_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.track_ride_status_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_payment_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_direct_paid_payment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_status_transition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_ride_status(uuid, text) TO authenticated;
