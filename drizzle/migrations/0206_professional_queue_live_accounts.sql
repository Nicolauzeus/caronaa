-- CARONAA: a fila operacional lista apenas contas atualmente existentes,
-- deduplicadas por user_id. Historico permanece intocado para auditoria.
-- Nao revoga, autoriza ou exclui contas/solicitacoes.
CREATE OR REPLACE FUNCTION public.admin_professional_access_queue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $queue$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'user_id', q.user_id,
        'status', q.status,
        'snapshot', coalesce(q.snapshot, '{}'::jsonb) ||
          jsonb_build_object(
            'email', u.email,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
          ),
        'submitted_at', q.submitted_at,
        'reviewed_at', q.reviewed_at,
        'review_reason', q.review_reason,
        'current_missing', to_jsonb(m.missing),
        'currently_ready', (
          q.status = 'APPROVED'
          AND a.approved IS TRUE
          AND a.vehicle_type = q.vehicle_type
          AND u.email_confirmed_at IS NOT NULL
          AND cardinality(m.missing) = 0
        )
      )
      ORDER BY (q.status = 'PENDING') DESC, q.submitted_at DESC, q.id DESC
    )
    FROM (
      SELECT *
      FROM (
        SELECT DISTINCT ON (request.user_id) request.*
        FROM public.professional_access_requests request
        JOIN auth.users existing ON existing.id = request.user_id
        JOIN public.profiles existing_profile ON existing_profile.id = request.user_id
        ORDER BY request.user_id, request.submitted_at DESC, request.id DESC
      ) latest_per_user
      ORDER BY (status = 'PENDING') DESC, submitted_at DESC, id DESC
      LIMIT 50
    ) q
    JOIN auth.users u ON u.id = q.user_id
    JOIN public.profiles p ON p.id = q.user_id
    LEFT JOIN public.professional_driver_authorizations a ON a.user_id = q.user_id
    CROSS JOIN LATERAL (
      SELECT coalesce(public.professional_access_missing(
        q.user_id, q.vehicle_type, q.car_category, q.passenger_seats, q.municipality
      ), ARRAY[]::text[]) AS missing
    ) m
  ), '[]'::jsonb);
END
$queue$;

REVOKE ALL ON FUNCTION public.admin_professional_access_queue()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_professional_access_queue()
  TO authenticated;

COMMENT ON FUNCTION public.admin_professional_access_queue() IS
  'Fila operacional por conta ativa: oculta cadastros excluidos e versoes antigas; historico permanece preservado. Exibe aptidao atual independentemente de aprovacao historica.';
NOTIFY pgrst, 'reload schema';
