-- 0244 | Distinguish last-30-day authenticated access by role at access time.
-- Access counts must match role_at_access; switching profiles must not move history.
-- Protects private data behind admin role, no GPS/phone exported.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operations_people_truth()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $people$
DECLARE v_report jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;

  WITH quick_driver AS (
    SELECT driver_id AS user_id,
      count(*)::int AS quick_assigned,
      count(*) FILTER(WHERE status='COMPLETED' AND completed_at IS NOT NULL)::int AS quick_completed
    FROM public.professional_quick_rides
    WHERE driver_id IS NOT NULL GROUP BY driver_id
  ), quick_passenger AS (
    SELECT passenger_id AS user_id,
      count(*)::int AS quick_requested,
      count(*) FILTER(WHERE status='COMPLETED' AND completed_at IS NOT NULL)::int AS quick_completed
    FROM public.professional_quick_rides GROUP BY passenger_id
  ), shared_driver AS (
    SELECT driver_user_id AS user_id,
      count(*) FILTER(WHERE status='COMPLETED' AND completed_at IS NOT NULL)::int AS shared_completed
    FROM public.rides GROUP BY driver_user_id
  ), shared_passenger AS (
    SELECT passenger_user_id AS user_id,
      count(*) FILTER(WHERE status='COMPLETED' AND completed_at IS NOT NULL)::int AS shared_completed
    FROM public.rides GROUP BY passenger_user_id
  ), shared_requests AS (
    SELECT user_id,count(*)::int AS requests
    FROM public.ride_requests GROUP BY user_id
  ), auth_activity AS (
    SELECT DISTINCT ON (user_id) user_id,last_seen_at,role_at_access
    FROM public.caronaa_app_access_days
    ORDER BY user_id,last_seen_at DESC
  ), auth_activity_30 AS (
    SELECT user_id,role_at_access,count(DISTINCT local_day)::int AS active_days_30
    FROM public.caronaa_app_access_days
    WHERE local_day >= (now() AT TIME ZONE 'America/Fortaleza')::date-29
      AND local_day <= (now() AT TIME ZONE 'America/Fortaleza')::date
    GROUP BY user_id,role_at_access
  ), people AS (
    SELECT u.id AS user_id,
      p.active_role AS role,
      coalesce(nullif(btrim(p.full_name),''),nullif(split_part(u.email,'@',1),''),'Conta cadastrada') AS display_name,
      u.email,
      p.avatar_url,
      u.created_at AS registered_at,
      (u.banned_until IS NOT NULL AND u.banned_until > now()) AS suspended,
      (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
      p.vehicle_type,
      p.vehicle_brand,
      p.vehicle_model,
      (coalesce(a.approved,false)) AS professional_authorized,
      coalesce(p.is_driver_eligible,false) AS shared_driver_eligible,
      (
        coalesce(a.approved,false) AND
        coalesce(pr.is_available,false) AND
        pr.last_seen_at>now()-interval '90 seconds' AND
        loc.sampled_at>now()-interval '90 seconds' AND
        loc.lat BETWEEN -90 AND 90 AND loc.lng BETWEEN -180 AND 180 AND
        loc.lat<>0 AND loc.lng<>0
      ) AS online_with_recent_gps,
      act.last_seen_at AS last_access_at,
      act.role_at_access AS last_access_role,
      coalesce(d30.active_days_30,0) AS active_days_30,
      coalesce(qd.quick_assigned,0) AS quick_assigned,
      coalesce(qd.quick_completed,0) AS quick_driven_completed,
      coalesce(qp.quick_requested,0) AS quick_requested,
      coalesce(qp.quick_completed,0) AS quick_passenger_completed,
      coalesce(sd.shared_completed,0) AS shared_driven_completed,
      coalesce(sp.shared_completed,0) AS shared_passenger_completed,
      coalesce(sr.requests,0) AS shared_requested
    FROM auth.users u
    JOIN public.profiles p ON p.id=u.id
    LEFT JOIN public.professional_driver_authorizations a ON a.user_id=u.id
    LEFT JOIN public.professional_presence pr ON pr.user_id=u.id
    LEFT JOIN public.professional_driver_locations loc ON loc.user_id=u.id
    LEFT JOIN auth_activity act ON act.user_id=u.id
    LEFT JOIN auth_activity_30 d30 ON d30.user_id=u.id AND d30.role_at_access=p.active_role
    LEFT JOIN quick_driver qd ON qd.user_id=u.id
    LEFT JOIN quick_passenger qp ON qp.user_id=u.id
    LEFT JOIN shared_driver sd ON sd.user_id=u.id
    LEFT JOIN shared_passenger sp ON sp.user_id=u.id
    LEFT JOIN shared_requests sr ON sr.user_id=u.id
    WHERE p.active_role IN ('MOTORISTA','PASSAGEIRO')
  ), totals AS (
    SELECT
      count(*)::int AS registered_accounts,
      count(*) FILTER(WHERE role='MOTORISTA')::int AS registered_drivers,
      count(*) FILTER(WHERE role='PASSAGEIRO')::int AS registered_passengers,
      count(*) FILTER(WHERE role='MOTORISTA' AND professional_authorized)::int AS authorized_drivers,
      count(*) FILTER(WHERE role='MOTORISTA' AND online_with_recent_gps)::int AS online_drivers,
      count(*) FILTER(WHERE role='MOTORISTA' AND (quick_driven_completed+shared_driven_completed)>0)::int AS drivers_completed_users,
      count(*) FILTER(WHERE role='PASSAGEIRO' AND (quick_requested+shared_requested)>0)::int AS passengers_requested_users,
      count(*) FILTER(WHERE role='PASSAGEIRO' AND active_days_30>0)::int AS passenger_accessed_30,
      count(*) FILTER(WHERE role='MOTORISTA' AND active_days_30>0)::int AS driver_accessed_30,
      coalesce(sum(quick_driven_completed+shared_driven_completed) FILTER(WHERE role='MOTORISTA'),0)::int AS driver_completed_rides,
      coalesce(sum(quick_requested+shared_requested) FILTER(WHERE role='PASSAGEIRO'),0)::int AS passenger_requests,
      coalesce(sum(quick_passenger_completed+shared_passenger_completed) FILTER(WHERE role='PASSAGEIRO'),0)::int AS passenger_completed_rides
    FROM people
  )
  SELECT jsonb_build_object(
    'generated_at',now(),
    'timezone','America/Fortaleza',
    'access_tracking_started_at',(SELECT min(first_seen_at) FROM public.caronaa_app_access_days),
    'summary',(SELECT to_jsonb(t) FROM totals t),
    'users',coalesce((
      SELECT jsonb_agg(to_jsonb(person) ORDER BY person.registered_at DESC,person.user_id)
      FROM people person
    ),'[]'::jsonb),
    'scope',jsonb_build_object(
      'registered','Contas em auth.users com profiles.active_role; exclui perfis sem conta e leads de formulario',
      'authorized','Autorizacao profissional Flash aprovada; distinta da revisao documental de caronas',
      'online','Autorizado, presenca ativa e localizacao GPS de ate 90 segundos; nao e garantia de despacho',
      'last_access','O ultimo acesso geral e o mais recente da conta; dias ativos de 30d sao contados apenas para o perfil ativo durante cada sinal, apos a coleta',
      'activity','Corridas F07 e compartilhadas efetivamente registradas, sem atribuir as de um papel a outro'
    )
  ) INTO v_report;
  RETURN v_report;
END;
$people$;

REVOKE ALL ON FUNCTION public.admin_operations_people_truth() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_people_truth() TO authenticated;
COMMENT ON FUNCTION public.admin_operations_people_truth() IS 'Admin-only account-backed driver and passenger overview with verified operational sources, not form-only activity lists';
NOTIFY pgrst,'reload schema';
COMMIT;