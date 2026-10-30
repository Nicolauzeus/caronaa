-- Secure read-only onboarding suggestions derived ONLY from verified research badges.
-- Does not change research answers, historical versions, CRM permissions or launch rules.
CREATE OR REPLACE FUNCTION public.get_my_onboarding_research_suggestions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'form_code', f.code,
    'institution', coalesce(c.settings->>'institutionName', f.title),
    'region', c.settings->>'region',
    'profile', nullif(j.journey->>'profile',''),
    'origin', nullif(j.journey->>'originArea',''),
    'destination', nullif(j.journey->>'destinationArea',''),
    'outbound_time', nullif(j.journey->>'outboundTime','')
  ) ORDER BY b.verified_at DESC), '[]'::jsonb)
  FROM public.research_participation_badges b
  JOIN public.research_forms f ON f.id=b.form_id
  LEFT JOIN public.research_configurations c ON c.form_id=b.form_id
  LEFT JOIN public.research_journeys j ON j.answer_id=b.answer_id
  WHERE b.user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=b.user_id AND u.email_confirmed_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.get_my_onboarding_research_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_research_suggestions() TO authenticated;
COMMENT ON FUNCTION public.get_my_onboarding_research_suggestions() IS 'Read-only hints for proven owned submissions; never verifies affiliation or creates a trip';
