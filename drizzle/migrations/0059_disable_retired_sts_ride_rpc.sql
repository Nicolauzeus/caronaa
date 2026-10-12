-- The event-specific signup/publication flow has ended. Preserve its records and
-- verification seals, but prevent browsers from calling its SECURITY DEFINER RPCs.
REVOKE ALL ON FUNCTION public.get_sts_ride_seed()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.publish_sts_ride(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
