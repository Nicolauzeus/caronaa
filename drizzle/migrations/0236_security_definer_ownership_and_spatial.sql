-- 0236: F01/F02/F03 security hardening, verified against deployed function signatures.
-- Explicitly preserves published survey link ownership, R$6/11km subroute price,
-- historical ride_offer status 'available', and all existing client result shapes.
BEGIN;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon,authenticated,PUBLIC;

CREATE OR REPLACE FUNCTION public.find_on_route_matches(p_origin_lat double precision, p_origin_lng double precision, p_destination_lat double precision, p_destination_lng double precision, p_ride_date date, p_departure_time time without time zone, p_passenger_count integer DEFAULT 1, p_women_only boolean DEFAULT false)
 RETURNS TABLE(offer_id uuid, driver_id uuid, driver_name text, driver_avatar text, driver_gender text, vehicle_model text, vehicle_plate text, vehicle_color text, ride_date date, departure_time time without time zone, seats_remaining integer, pickup_lat double precision, pickup_lng double precision, pickup_walk_m integer, dropoff_lat double precision, dropoff_lng double precision, dropoff_walk_m integer, total_price numeric, proportional_price numeric, travel_preferences jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_gender text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_ride_date IS NULL OR p_ride_date<(now() AT TIME ZONE 'America/Fortaleza')::date
    OR p_passenger_count NOT BETWEEN 1 AND 3
    OR p_origin_lat NOT BETWEEN -90 AND 90 OR p_destination_lat NOT BETWEEN -90 AND 90
    OR p_origin_lng NOT BETWEEN -180 AND 180 OR p_destination_lng NOT BETWEEN -180 AND 180
  THEN RETURN; END IF;
  IF p_women_only THEN
    SELECT gender INTO v_user_gender FROM public.profiles WHERE id = auth.uid();
    IF v_user_gender IS DISTINCT FROM 'FEMININO' THEN
      RAISE EXCEPTION 'A modalidade Carona Mulher é exclusiva para usuárias verificadas.';
    END IF;
  END IF;

  RETURN QUERY
  WITH candidate_offers AS (
    SELECT
      o.offer_id,
      o.user_id AS driver_id,
      o.ride_date,
      o.departure_time,
      o.seats_remaining,
      o.total_price,
      NULL::jsonb AS travel_preferences,
      o.passenger_gender_preference,
      p.full_name AS driver_name,
      p.avatar_url AS driver_avatar,
      NULL::text AS driver_gender,
      p.vehicle_model,
      NULL::text AS vehicle_plate,
      p.vehicle_color,
      snap_pickup.meeting_lat AS p_lat,
      snap_pickup.meeting_lng AS p_lng,
      snap_pickup.walk_distance_m AS p_walk,
      snap_pickup.fraction AS p_fraction,
      snap_dropoff.meeting_lat AS d_lat,
      snap_dropoff.meeting_lng AS d_lng,
      snap_dropoff.walk_distance_m AS d_walk,
      snap_dropoff.fraction AS d_fraction
    FROM public.ride_offers o
    JOIN public.profiles p ON p.id = o.user_id
    CROSS JOIN LATERAL public.snap_to_route(p_origin_lat, p_origin_lng, o.route_geom, o.corridor_radius_m) snap_pickup
    CROSS JOIN LATERAL public.snap_to_route(p_destination_lat, p_destination_lng, o.route_geom, o.corridor_radius_m) snap_dropoff
    WHERE o.status IN ('ACTIVE','available')
      AND (o.ride_date>(now() AT TIME ZONE 'America/Fortaleza')::date OR
           (o.ride_date=(now() AT TIME ZONE 'America/Fortaleza')::date AND
            o.departure_time>(now() AT TIME ZONE 'America/Fortaleza')::time))
      AND o.route_geom IS NOT NULL
      AND o.ride_date = p_ride_date
      AND o.seats_remaining >= p_passenger_count
      AND o.departure_time BETWEEN (p_departure_time - interval '45 minutes') AND (p_departure_time + interval '45 minutes')
      AND snap_pickup.is_within_corridor = true
      AND snap_dropoff.is_within_corridor = true
      AND snap_pickup.fraction < snap_dropoff.fraction -- Garante mesmo sentido da viagem
      AND (
        NOT p_women_only 
        OR (p.gender = 'FEMININO' AND o.passenger_gender_preference IN ('FEMALE_ONLY', 'WOMEN_ONLY', 'ANY'))
      )
  )
  SELECT
    co.offer_id,
    co.driver_id,
    co.driver_name,
    co.driver_avatar,
    co.driver_gender,
    co.vehicle_model,
    co.vehicle_plate,
    co.vehicle_color,
    co.ride_date,
    co.departure_time,
    co.seats_remaining,
    co.p_lat AS pickup_lat,
    co.p_lng AS pickup_lng,
    co.p_walk AS pickup_walk_m,
    co.d_lat AS dropoff_lat,
    co.d_lng AS dropoff_lng,
    co.d_walk AS dropoff_walk_m,
    co.total_price,
    ROUND(
      GREATEST(
        6.00,
        (co.total_price * (co.d_fraction - co.p_fraction))
      ), 2
    ) AS proportional_price,
    co.travel_preferences
  FROM candidate_offers co
  ORDER BY (co.p_walk + co.d_walk) ASC, co.departure_time ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_on_route_matches(double precision,double precision,double precision,double precision,date,time without time zone,integer,boolean) FROM anon,PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_on_route_matches(double precision,double precision,double precision,double precision,date,time without time zone,integer,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_driver_ready(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prof record;
  v_has_brand boolean;
  v_has_model boolean;
  v_has_color boolean;
  v_has_plate boolean;
  v_is_ready boolean;
  v_is_already_eligible boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ready', false, 'error', 'INVALID_USER_ID');
  END IF;

  IF auth.uid() IS NULL OR
     (auth.uid() IS DISTINCT FROM p_user_id AND
      NOT coalesce(public.has_role(auth.uid(),'admin'),false)) THEN
    RETURN jsonb_build_object('ready',false);
  END IF;
  SELECT * INTO v_prof FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  v_has_brand := COALESCE(TRIM(v_prof.vehicle_brand), '') <> '';
  v_has_model := COALESCE(TRIM(v_prof.vehicle_model), '') <> '' 
                 OR COALESCE(TRIM(v_prof.vehicle_description), '') <> '';
  v_has_color := COALESCE(TRIM(v_prof.vehicle_color), '') <> '';
  v_has_plate := COALESCE(TRIM(v_prof.vehicle_plate), '') <> '';

  v_is_already_eligible := COALESCE(v_prof.is_driver_eligible, false);

  -- Apto se tem os 4 campos preenchidos OU já era elegível/piloto
  v_is_ready := (v_has_brand AND v_has_model AND v_has_color AND v_has_plate) OR v_is_already_eligible;

  RETURN jsonb_build_object(
    'ready', v_is_ready,
    'vehicle_type', COALESCE(v_prof.vehicle_type, 'car'),
    'vehicle_seats', CASE WHEN v_prof.vehicle_type = 'moto' THEN 1 ELSE COALESCE(v_prof.vehicle_seats, 3) END,
    'missing_fields', jsonb_build_object(
      'brand', NOT v_has_brand,
      'model', NOT v_has_model,
      'color', NOT v_has_color,
      'plate', NOT v_has_plate
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.is_driver_ready(uuid) FROM anon,PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_driver_ready(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_form_pain_analysis(p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_event text DEFAULT NULL::text, p_tipo_usuario form_tipo_usuario DEFAULT NULL::form_tipo_usuario, p_ocupacao text DEFAULT NULL::text, p_sort_by text DEFAULT 'frequency'::text, p_frequency_weight numeric DEFAULT 1, p_intensity_weight numeric DEFAULT 1, p_primary_weight numeric DEFAULT 1, p_interest_weight numeric DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Acesso negado: restrito a administradores.' USING ERRCODE='42501';
  END IF;
  RETURN (
  WITH authorized AS (
    SELECT public.has_role(auth.uid(), 'admin') AS is_admin
  ),
  pain_catalog AS (
    SELECT *
    FROM (VALUES
      ('DOR_01'::public.form_dor_codigo, 'Acesso a uma opção adequada para determinado trajeto'),
      ('DOR_02'::public.form_dor_codigo, 'Lotação e desconforto em horários de pico'),
      ('DOR_03'::public.form_dor_codigo, 'Preço elevado de alternativas individuais'),
      ('DOR_04'::public.form_dor_codigo, 'Tempo e complexidade do deslocamento'),
      ('DOR_05'::public.form_dor_codigo, 'Lugares disponíveis em carros que poderiam ser compartilhados'),
      ('DOR_06'::public.form_dor_codigo, 'Falta de confiança para pegar/oferecer carona a desconhecidos')
    ) AS catalog(codigo_dor, label)
  ),
  filtered_submissions AS (
    SELECT fs.*
    FROM public.form_submissions fs
    CROSS JOIN authorized
    WHERE authorized.is_admin
      AND (p_period_start IS NULL OR fs.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fs.created_at < p_period_end)
      AND (p_source IS NULL OR fs.source = p_source)
      AND (p_campaign IS NULL OR fs.raw_payload ->> 'campaign' = p_campaign)
      AND (p_event IS NULL OR fs.campaign_event = p_event)
      AND (p_tipo_usuario IS NULL OR fs.tipo_usuario = p_tipo_usuario)
      AND (p_ocupacao IS NULL OR fs.ocupacao = p_ocupacao)
  ),
  sample AS (
    SELECT count(*)::numeric AS total
    FROM filtered_submissions
  ),
  selected_pains AS (
    SELECT fpp.*, fs.intencao_passageiro, fs.intencao_motorista
    FROM public.form_submission_pain_points fpp
    INNER JOIN filtered_submissions fs ON fs.submission_id = fpp.submission_id
    WHERE fpp.selecionada
  ),
  pain_counts AS (
    SELECT
      codigo_dor,
      count(*) AS selected_count,
      count(*) FILTER (WHERE principal) AS principal_count,
      round(avg(intensidade) FILTER (WHERE intensidade IS NOT NULL), 2) AS average_intensity,
      count(*) FILTER (WHERE intensidade = 1) AS intensity_1,
      count(*) FILTER (WHERE intensidade = 2) AS intensity_2,
      count(*) FILTER (WHERE intensidade = 3) AS intensity_3,
      count(*) FILTER (WHERE intensidade = 4) AS intensity_4,
      count(*) FILTER (WHERE intensidade = 5) AS intensity_5
    FROM selected_pains
    GROUP BY codigo_dor
  ),
  interest_by_pain AS (
    SELECT
      selected_pains.codigo_dor,
      round(avg(interest.value), 2) AS average_interest
    FROM selected_pains
    CROSS JOIN LATERAL (
      VALUES
        (CASE selected_pains.intencao_passageiro
          WHEN 'HOJE' THEN 5
          WHEN 'PROVAVELMENTE' THEN 4
          WHEN 'TALVEZ' THEN 3
          WHEN 'PROVAVELMENTE_NAO' THEN 2
          WHEN 'NAO' THEN 1
          ELSE NULL
        END),
        (CASE selected_pains.intencao_motorista
          WHEN 'HOJE' THEN 5
          WHEN 'PROVAVELMENTE' THEN 4
          WHEN 'TALVEZ' THEN 3
          WHEN 'PROVAVELMENTE_NAO' THEN 2
          WHEN 'NAO' THEN 1
          ELSE NULL
        END)
    ) AS interest(value)
    WHERE interest.value IS NOT NULL
    GROUP BY selected_pains.codigo_dor
  ),
  weights AS (
    SELECT
      greatest(COALESCE(p_frequency_weight, 0), 0) AS frequency_weight,
      greatest(COALESCE(p_intensity_weight, 0), 0) AS intensity_weight,
      greatest(COALESCE(p_primary_weight, 0), 0) AS primary_weight,
      greatest(COALESCE(p_interest_weight, 0), 0) AS interest_weight
  ),
  normalized AS (
    SELECT
      pain_catalog.codigo_dor,
      pain_catalog.label,
      COALESCE(pain_counts.selected_count, 0)::numeric AS selected_count,
      CASE WHEN sample.total = 0 THEN 0 ELSE round((COALESCE(pain_counts.selected_count, 0)::numeric / sample.total) * 100, 2) END AS selected_percentage,
      COALESCE(pain_counts.principal_count, 0)::numeric AS principal_count,
      CASE WHEN sample.total = 0 THEN 0 ELSE round((COALESCE(pain_counts.principal_count, 0)::numeric / sample.total) * 100, 2) END AS principal_percentage,
      pain_counts.average_intensity,
      jsonb_build_object(
        '1', COALESCE(pain_counts.intensity_1, 0),
        '2', COALESCE(pain_counts.intensity_2, 0),
        '3', COALESCE(pain_counts.intensity_3, 0),
        '4', COALESCE(pain_counts.intensity_4, 0),
        '5', COALESCE(pain_counts.intensity_5, 0)
      ) AS intensity_distribution,
      interest_by_pain.average_interest
    FROM pain_catalog
    CROSS JOIN sample
    LEFT JOIN pain_counts ON pain_counts.codigo_dor = pain_catalog.codigo_dor
    LEFT JOIN interest_by_pain ON interest_by_pain.codigo_dor = pain_catalog.codigo_dor
  ),
  scored AS (
    SELECT
      normalized.*,
      normalized.selected_percentage AS frequency_score,
      round((COALESCE(normalized.average_intensity, 0) / 5) * 100, 2) AS intensity_score,
      normalized.principal_percentage AS primary_pain_score,
      round(((COALESCE(normalized.average_interest, 1) - 1) / 4) * 100, 2) AS interest_score
    FROM normalized
  ),
  final AS (
    SELECT
      scored.*,
      CASE
        WHEN weights.frequency_weight + weights.intensity_weight + weights.primary_weight + weights.interest_weight = 0 THEN 0
        ELSE round((
          scored.frequency_score * weights.frequency_weight +
          scored.intensity_score * weights.intensity_weight +
          scored.primary_pain_score * weights.primary_weight +
          scored.interest_score * weights.interest_weight
        ) / (
          weights.frequency_weight + weights.intensity_weight + weights.primary_weight + weights.interest_weight
        ), 2)
      END AS opportunity_score
    FROM scored
    CROSS JOIN weights
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'periodStart', p_period_start,
      'periodEnd', p_period_end,
      'source', p_source,
      'campaign', p_campaign,
      'event', p_event,
      'tipoUsuario', p_tipo_usuario,
      'ocupacao', p_ocupacao
    ),
    'sampleSize', (SELECT total FROM sample),
    'formula', jsonb_build_object(
      'description', 'Opportunity Score = média ponderada de frequencyScore, intensityScore, primaryPainScore e interestScore, normalizada para 0-100.',
      'frequencyScore', 'percentual da amostra que selecionou a dor',
      'intensityScore', 'intensidade média / 5 * 100',
      'primaryPainScore', 'percentual da amostra que marcou a dor como principal',
      'interestScore', 'média de interesse convertida para 1-5 e normalizada: (média - 1) / 4 * 100',
      'interestScale', jsonb_build_object('NAO', 1, 'PROVAVELMENTE_NAO', 2, 'TALVEZ', 3, 'PROVAVELMENTE', 4, 'HOJE', 5),
      'weights', jsonb_build_object(
        'frequency', greatest(COALESCE(p_frequency_weight, 0), 0),
        'intensity', greatest(COALESCE(p_intensity_weight, 0), 0),
        'primaryPain', greatest(COALESCE(p_primary_weight, 0), 0),
        'interest', greatest(COALESCE(p_interest_weight, 0), 0)
      )
    ),
    'sortBy', CASE
      WHEN p_sort_by IN ('frequency', 'intensity', 'primaryPain', 'interest') THEN p_sort_by
      ELSE 'frequency'
    END,
    'painPoints', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'codigoDor', final.codigo_dor,
          'label', final.label,
          'selectedCount', final.selected_count,
          'selectedPercentage', final.selected_percentage,
          'principalCount', final.principal_count,
          'principalPercentage', final.principal_percentage,
          'averageIntensity', final.average_intensity,
          'intensityDistribution', final.intensity_distribution,
          'averageInterest', final.average_interest,
          'scores', jsonb_build_object(
            'frequencyScore', final.frequency_score,
            'intensityScore', final.intensity_score,
            'primaryPainScore', final.primary_pain_score,
            'interestScore', final.interest_score,
            'opportunityScore', final.opportunity_score
          )
        )
        ORDER BY
          CASE WHEN p_sort_by = 'intensity' THEN final.intensity_score END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'primaryPain' THEN final.primary_pain_score END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'interest' THEN final.interest_score END DESC NULLS LAST,
          CASE WHEN p_sort_by NOT IN ('intensity', 'primaryPain', 'interest') THEN final.frequency_score END DESC NULLS LAST,
          final.codigo_dor ASC
      )
      FROM final
    ), '[]'::jsonb)
  )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_form_pain_analysis(timestamptz,timestamptz,text,text,text,public.form_tipo_usuario,text,text,numeric,numeric,numeric,numeric) FROM anon,PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_pain_analysis(timestamptz,timestamptz,text,text,text,public.form_tipo_usuario,text,text,numeric,numeric,numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_form_account_activation(p_submission_id uuid, p_changes jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE u auth.users%ROWTYPE; s public.form_submissions%ROWTYPE; activation jsonb;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.form_submissions WHERE submission_id=p_submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Form submission not found' USING ERRCODE='P0002'; END IF;
 IF s.user_id IS DISTINCT FROM u.id THEN
  activation:=public.get_form_account_activation();
  IF s.user_id IS NOT NULL OR activation->>'status' IS DISTINCT FROM 'ready' OR activation->'submission'->>'submissionId' IS DISTINCT FROM p_submission_id::text THEN RAISE EXCEPTION 'Form submission cannot be linked to this account' USING ERRCODE='42501'; END IF;
  -- Verified legacy submission claim is atomic and only allowed for unlinked rows.
  UPDATE public.form_submissions SET user_id=u.id
    WHERE submission_id=p_submission_id AND user_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission ownership changed' USING ERRCODE='42501';
  END IF;
 END IF;
 UPDATE public.form_submissions SET nome=coalesce(nullif(trim(p_changes->>'name'),''),nome),whatsapp=coalesce(nullif(trim(p_changes->>'whatsapp'),''),whatsapp),origem_trajeto=coalesce(nullif(trim(p_changes->>'origin'),''),origem_trajeto),destino_trajeto=coalesce(nullif(trim(p_changes->>'destination'),''),destino_trajeto),faixa_horario=coalesce(nullif(trim(p_changes->>'departureWindow'),''),faixa_horario) WHERE submission_id=p_submission_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Acesso negado à submissão' USING ERRCODE='42501'; END IF;
 INSERT INTO public.form_submission_account_links(submission_id,user_id,confirmed_at,onboarding_completed_at) VALUES(p_submission_id,u.id,now(),now()) ON CONFLICT(submission_id) DO UPDATE SET confirmed_at=coalesce(public.form_submission_account_links.confirmed_at,EXCLUDED.confirmed_at),onboarding_completed_at=coalesce(public.form_submission_account_links.onboarding_completed_at,EXCLUDED.onboarding_completed_at);
 RETURN jsonb_build_object('status','confirmed');
END; $function$;

REVOKE ALL ON FUNCTION public.confirm_form_account_activation(uuid,jsonb) FROM anon,PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_form_account_activation(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
