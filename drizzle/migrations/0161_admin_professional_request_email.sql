-- 0161 | Expose authenticated account email only to the administrative
-- professional-approval queue. Historical requests need no backfill.
-- Never trust snapshot.email from browser submissions as identity evidence.

CREATE OR REPLACE FUNCTION public.admin_professional_access_queue()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $queue$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'user_id', q.user_id,
        'status', q.status,
        -- Auth is the authoritative source of the login email.
        -- Overwrite any stale/untrusted snapshot email.
        'snapshot', coalesce(q.snapshot, '{}'::jsonb)
          || jsonb_build_object('email', u.email),
        'submitted_at', q.submitted_at,
        'reviewed_at', q.reviewed_at,
        'review_reason', q.review_reason,
        'current_missing', to_jsonb(public.professional_access_missing(
          q.user_id, q.vehicle_type, q.car_category,
          q.passenger_seats, q.municipality
        ))
      )
      ORDER BY (q.status = 'PENDING') DESC, q.submitted_at DESC
    )
    FROM (
      SELECT *
      FROM public.professional_access_requests
      ORDER BY submitted_at DESC
      LIMIT 50
    ) q
    LEFT JOIN auth.users u ON u.id = q.user_id
  ), '[]'::jsonb);
END
$queue$;

REVOKE ALL ON FUNCTION public.admin_professional_access_queue()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_professional_access_queue()
  TO authenticated;

COMMENT ON FUNCTION public.admin_professional_access_queue() IS
  'Admin-only professional queue with verified login email from auth.users; historical snapshots are enriched on read.';
NOTIFY pgrst, 'reload schema';
