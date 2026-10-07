-- A form response is a lead, never an activated account by itself.
CREATE TABLE IF NOT EXISTS public.form_submission_account_links (
  submission_id uuid PRIMARY KEY REFERENCES public.form_submissions(submission_id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  onboarding_completed_at timestamptz
);

ALTER TABLE public.form_submission_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.form_submission_account_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.form_submission_account_links TO service_role;

CREATE INDEX IF NOT EXISTS form_submissions_identity_lookup_idx
  ON public.form_submissions ((lower(trim(email))), (regexp_replace(whatsapp, '\\D', '', 'g')))
  WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_form_account_activation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_matches uuid[];
  v_submission public.form_submissions%ROWTYPE;
  v_link public.form_submission_account_links%ROWTYPE;
  v_phone text;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  v_phone := coalesce(v_user.phone, v_user.raw_user_meta_data ->> 'whatsapp');

  SELECT * INTO v_link FROM public.form_submission_account_links WHERE user_id = v_user.id;
  IF FOUND AND v_link.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'confirmed');
  END IF;

  SELECT array_agg(submission_id) INTO v_matches
  FROM public.form_submissions WHERE user_id = v_user.id;
  IF coalesce(array_length(v_matches, 1), 0) = 1 THEN
    SELECT * INTO v_submission FROM public.form_submissions WHERE submission_id = v_matches[1];
  ELSIF coalesce(array_length(v_matches, 1), 0) > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous');
  ELSE
    -- E-mail takes precedence over phone. A collision at either stage is not linked silently.
    SELECT array_agg(submission_id) INTO v_matches FROM (
      SELECT submission_id FROM public.form_submissions
      WHERE user_id IS NULL AND v_user.email IS NOT NULL AND lower(trim(email)) = lower(trim(v_user.email))
    ) candidates;
    IF coalesce(array_length(v_matches, 1), 0) = 0 AND v_phone IS NOT NULL THEN
      SELECT array_agg(submission_id) INTO v_matches FROM (
        SELECT submission_id FROM public.form_submissions WHERE user_id IS NULL
          AND regexp_replace(whatsapp, '\\D', '', 'g') = regexp_replace(v_phone, '\\D', '', 'g')
      ) candidates;
    END IF;
    IF coalesce(array_length(v_matches, 1), 0) = 0 THEN RETURN jsonb_build_object('status', 'none'); END IF;
    IF array_length(v_matches, 1) > 1 THEN RETURN jsonb_build_object('status', 'ambiguous'); END IF;
    SELECT * INTO v_submission FROM public.form_submissions WHERE submission_id = v_matches[1];
  END IF;

  RETURN jsonb_build_object('status', 'ready', 'submission', jsonb_build_object(
    'submissionId', v_submission.submission_id, 'name', v_submission.nome,
    'email', v_submission.email, 'whatsapp', v_submission.whatsapp,
    'intent', v_submission.tipo_usuario, 'origin', v_submission.origem_trajeto,
    'destination', v_submission.destino_trajeto, 'departureWindow', v_submission.faixa_horario,
    'transport', v_submission.transporte_atual
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_form_account_activation(p_submission_id uuid, p_changes jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user auth.users%ROWTYPE; v_submission public.form_submissions%ROWTYPE; v_matches uuid[]; v_phone text;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  v_phone := coalesce(v_user.phone, v_user.raw_user_meta_data ->> 'whatsapp');
  SELECT * INTO v_submission FROM public.form_submissions WHERE submission_id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Form submission not found' USING ERRCODE = 'P0002'; END IF;

  IF v_submission.user_id IS DISTINCT FROM v_user.id THEN
    SELECT array_agg(submission_id) INTO v_matches FROM (
      SELECT submission_id FROM public.form_submissions WHERE user_id IS NULL
        AND v_user.email IS NOT NULL AND lower(trim(email)) = lower(trim(v_user.email))
    ) candidates;
    IF coalesce(array_length(v_matches, 1), 0) = 0 AND v_phone IS NOT NULL THEN
      SELECT array_agg(submission_id) INTO v_matches FROM (
        SELECT submission_id FROM public.form_submissions WHERE user_id IS NULL
          AND regexp_replace(whatsapp, '\\D', '', 'g') = regexp_replace(v_phone, '\\D', '', 'g')
      ) candidates;
    END IF;
    IF coalesce(array_length(v_matches, 1), 0) <> 1 OR v_matches[1] <> p_submission_id THEN
      RAISE EXCEPTION 'Form submission cannot be linked to this account' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.form_submissions SET user_id = v_user.id,
    nome = coalesce(nullif(trim(p_changes->>'name'), ''), nome),
    whatsapp = coalesce(nullif(trim(p_changes->>'whatsapp'), ''), whatsapp),
    origem_trajeto = coalesce(nullif(trim(p_changes->>'origin'), ''), origem_trajeto),
    destino_trajeto = coalesce(nullif(trim(p_changes->>'destination'), ''), destino_trajeto),
    faixa_horario = coalesce(nullif(trim(p_changes->>'departureWindow'), ''), faixa_horario)
  WHERE submission_id = p_submission_id;

  INSERT INTO public.form_submission_account_links (submission_id, user_id, confirmed_at, onboarding_completed_at)
  VALUES (p_submission_id, v_user.id, now(), now())
  ON CONFLICT (submission_id) DO UPDATE SET
    confirmed_at = coalesce(public.form_submission_account_links.confirmed_at, EXCLUDED.confirmed_at),
    onboarding_completed_at = coalesce(public.form_submission_account_links.onboarding_completed_at, EXCLUDED.onboarding_completed_at);
  RETURN jsonb_build_object('status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_account_activation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_form_account_activation(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_account_activation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_form_account_activation(uuid,jsonb) TO authenticated, service_role;
