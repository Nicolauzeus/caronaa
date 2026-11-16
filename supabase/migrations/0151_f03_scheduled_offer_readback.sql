-- F03: read the driver's persisted scheduled offers, including an offer that
-- has no confirmed passengers yet. The former RPC referenced an absent CRM
-- table and legacy match statuses, making every scheduled-list request fail.
-- Do not change matching, acceptance, contact consent or any F07 function.
CREATE OR REPLACE FUNCTION public.get_driver_scheduled_trips()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_results jsonb;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  -- Supabase previews may install this RPC before the Drizzle domain schema.
  IF to_regclass('public.ride_offers') IS NULL
     OR to_regclass('public.rides') IS NULL
     OR to_regclass('public.ride_requests') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_SCHEMA_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'offer_id', o.offer_id,
      'origin', o.origin,
      'destination', o.destination,
      'ride_date', o.ride_date,
      'departure_time', o.departure_time,
      'departure_at', (o.ride_date + o.departure_time) AT TIME ZONE 'America/Fortaleza',
      'status', o.status,
      'available_seats', o.available_seats,
      'seats_remaining', o.seats_remaining,
      'total_price', o.total_price,
      'booking_mode', o.booking_mode,
      'vehicle_type', o.vehicle_type,
      'passengers', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'passenger_id', p.id,
            'ride_id', r.ride_id,
            'match_id', r.match_id,
            'name', coalesce(nullif(btrim(p.full_name), ''), 'Passageiro'),
            'passenger_name', coalesce(nullif(btrim(p.full_name), ''), 'Passageiro'),
            'avatar_url', p.avatar_url,
            'passenger_avatar', p.avatar_url,
            'passenger_count', q.passenger_count,
            'meeting_name', coalesce(nullif(btrim(q.pickup_point), ''),
              nullif(btrim(o.meeting_point), ''), 'Ponto combinado'),
            'pickup_point', q.pickup_point,
            'agreed_fare', coalesce(r.passenger_group_total, r.passenger_contribution),
            'price', coalesce(r.passenger_group_total, r.passenger_contribution),
            -- There is no authorized operational WhatsApp source in the
            -- deployed schema. Research/CRM or auth data is not ride consent.
            'whatsapp', NULL
          ) ORDER BY r.created_at, r.ride_id
        ), '[]'::jsonb)
        FROM public.rides r
        JOIN public.ride_requests q ON q.request_id = r.request_id
          AND q.user_id = r.passenger_user_id
        JOIN public.profiles p ON p.id = r.passenger_user_id
        WHERE r.offer_id = o.offer_id
          AND r.driver_user_id = v_driver_id
          AND r.status IN ('CONFIRMED', 'IN_PROGRESS')
          AND r.passenger_accepted_at IS NOT NULL
          AND r.driver_accepted_at IS NOT NULL
      )
    ) ORDER BY o.ride_date, o.departure_time, o.offer_id
  ), '[]'::jsonb) INTO v_results
  FROM public.ride_offers o
  WHERE o.user_id = v_driver_id
    AND coalesce(o.service_tier, 'SCHEDULED') = 'SCHEDULED'
    AND o.status IN ('available', 'full')
    AND o.ride_date >= (current_timestamp AT TIME ZONE 'America/Fortaleza')::date;

  RETURN v_results;
END;
$$;
REVOKE ALL ON FUNCTION public.get_driver_scheduled_trips() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_scheduled_trips() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_driver_scheduled_trips() IS
  'F03 own scheduled-offer readback with canonical confirmed participants. No CRM contacts, matching writes or F07 changes.';
NOTIFY pgrst, 'reload schema';
