CREATE TABLE IF NOT EXISTS public.driver_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_push_subscriptions TO authenticated;
GRANT ALL ON public.driver_push_subscriptions TO service_role;
ALTER TABLE public.driver_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS driver_push_subscriptions_user_idx ON public.driver_push_subscriptions(user_id);
-- endpoint already indexed by its UNIQUE constraint.
CREATE POLICY "push_select_own" ON public.driver_push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_insert_own" ON public.driver_push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_update_own" ON public.driver_push_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_delete_own" ON public.driver_push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.save_driver_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF coalesce(p_endpoint,'') !~ '^https://' OR length(p_endpoint) > 2048
     OR coalesce(p_p256dh,'') = '' OR coalesce(p_auth,'') = '' THEN
    RAISE EXCEPTION 'INVALID_SUBSCRIPTION' USING ERRCODE = '22023';
  END IF;
  -- Same device endpoint re-subscribed by another account moves to the current one.
  INSERT INTO public.driver_push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.delete_driver_push_subscription(p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.driver_push_subscriptions WHERE endpoint = p_endpoint AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.save_driver_push_subscription(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_driver_push_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_driver_push_subscription(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_driver_push_subscription(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
