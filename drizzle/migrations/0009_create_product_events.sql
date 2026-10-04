CREATE TYPE public.product_event_name AS ENUM (
  'USER_REGISTERED', 'RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED',
  'MATCH_CREATED', 'RIDE_STARTED', 'RIDE_COMPLETED', 'PAYMENT_COMPLETED', 'RIDE_REPEATED'
);

CREATE TABLE public.product_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name public.product_event_name NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id text,
  match_id text,
  status text,
  source text,
  campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX product_events_funnel_idx ON public.product_events (event_name, created_at, user_id);
CREATE INDEX product_events_attribution_idx ON public.product_events (source, campaign, created_at);
CREATE UNIQUE INDEX product_events_user_registered_once_idx ON public.product_events (user_id) WHERE event_name = 'USER_REGISTERED';
GRANT INSERT ON public.product_events TO authenticated;
GRANT SELECT ON public.product_events TO authenticated;
GRANT ALL ON public.product_events TO service_role;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users register their own product events" ON public.product_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read product events" ON public.product_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.track_registered_user_product_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_events (event_name, user_id, status, source)
  VALUES ('USER_REGISTERED', NEW.id, 'registered', 'direct')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_profile_created_track_product_registration
AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.track_registered_user_product_event();
