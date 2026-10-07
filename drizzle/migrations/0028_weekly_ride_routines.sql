CREATE TABLE public.ride_routines (
  routine_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('offer', 'request')),
  origin text NOT NULL CHECK (length(btrim(origin)) BETWEEN 1 AND 160),
  destination text NOT NULL CHECK (length(btrim(destination)) BETWEEN 1 AND 160),
  origin_lat double precision CHECK (origin_lat BETWEEN -90 AND 90),
  origin_lng double precision CHECK (origin_lng BETWEEN -180 AND 180),
  destination_lat double precision CHECK (destination_lat BETWEEN -90 AND 90),
  destination_lng double precision CHECK (destination_lng BETWEEN -180 AND 180),
  days smallint[] NOT NULL CHECK (cardinality(days) BETWEEN 1 AND 7 AND days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  departure_time time NOT NULL CHECK (departure_time < '24:00'::time),
  start_date date NOT NULL,
  end_date date,
  seat_count integer NOT NULL CHECK (seat_count BETWEEN 1 AND 6),
  time_tolerance_minutes integer NOT NULL DEFAULT 15 CHECK (time_tolerance_minutes IN (5,15,30,60)),
  total_price numeric(10,2) NOT NULL DEFAULT 30 CHECK (total_price BETWEEN 0 AND 1000),
  active boolean NOT NULL DEFAULT true,
  generated_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lower(btrim(origin)) <> lower(btrim(destination))),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK ((origin_lat IS NULL) = (origin_lng IS NULL)),
  CHECK ((destination_lat IS NULL) = (destination_lng IS NULL))
);
ALTER TABLE public.ride_routines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_routines FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ride_routines TO service_role;
CREATE INDEX ride_routines_generation_idx ON public.ride_routines(generated_on) WHERE active;

ALTER TABLE public.ride_offers
  ADD COLUMN routine_id uuid REFERENCES public.ride_routines(routine_id),
  ADD COLUMN routine_date date,
  ADD COLUMN routine_override boolean NOT NULL DEFAULT false,
  ADD COLUMN routine_suppressed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ride_offers_routine_slot UNIQUE (routine_id, routine_date),
  ADD CONSTRAINT ride_offers_routine_date_check CHECK ((routine_id IS NULL) = (routine_date IS NULL)),
  ADD CONSTRAINT ride_offers_routine_coordinates_check CHECK (routine_id IS NULL OR (
    (origin_lat IS NULL) = (origin_lng IS NULL) AND (destination_lat IS NULL) = (destination_lng IS NULL)
    AND (origin_lat IS NULL OR origin_lat BETWEEN -90 AND 90) AND (origin_lng IS NULL OR origin_lng BETWEEN -180 AND 180)
    AND (destination_lat IS NULL OR destination_lat BETWEEN -90 AND 90) AND (destination_lng IS NULL OR destination_lng BETWEEN -180 AND 180)));
ALTER TABLE public.ride_requests
  ADD COLUMN routine_id uuid REFERENCES public.ride_routines(routine_id),
  ADD COLUMN routine_date date,
  ADD COLUMN routine_override boolean NOT NULL DEFAULT false,
  ADD COLUMN routine_suppressed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ride_requests_routine_slot UNIQUE (routine_id, routine_date),
  ADD CONSTRAINT ride_requests_routine_date_check CHECK ((routine_id IS NULL) = (routine_date IS NULL)),
  ADD CONSTRAINT ride_requests_routine_coordinates_check CHECK (routine_id IS NULL OR (
    (origin_lat IS NULL) = (origin_lng IS NULL) AND (destination_lat IS NULL) = (destination_lng IS NULL)
    AND (origin_lat IS NULL OR origin_lat BETWEEN -90 AND 90) AND (origin_lng IS NULL OR origin_lng BETWEEN -180 AND 180)
    AND (destination_lat IS NULL OR destination_lat BETWEEN -90 AND 90) AND (destination_lng IS NULL OR destination_lng BETWEEN -180 AND 180)));

-- Original slot dates remain stable even when an individual departure is rescheduled.
CREATE UNIQUE INDEX ride_offers_routine_departure_idx ON public.ride_offers(routine_id,ride_date,departure_time) WHERE routine_id IS NOT NULL AND status<>'cancelled';
CREATE UNIQUE INDEX ride_requests_routine_departure_idx ON public.ride_requests(routine_id,ride_date,departure_time) WHERE routine_id IS NOT NULL AND status<>'cancelled';
CREATE FUNCTION public.materialize_ride_routine(p_routine_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ride_routines%ROWTYPE; day date; stamp timestamptz := clock_timestamp();
  today date := (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
  SELECT * INTO r FROM public.ride_routines WHERE routine_id = p_routine_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.ride_offers o SET status = 'cancelled', routine_suppressed = true
  WHERE o.routine_id = r.routine_id AND o.status IN ('available','full')
    AND (o.ride_date + o.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
    AND (NOT r.active OR (NOT o.routine_override AND (
      NOT (extract(isodow FROM o.routine_date)::smallint = ANY(r.days)) OR o.routine_date < r.start_date OR (r.end_date IS NOT NULL AND o.routine_date > r.end_date))));
  UPDATE public.ride_requests q SET status = 'cancelled', routine_suppressed = true
  WHERE q.routine_id = r.routine_id AND q.status = 'open'
    AND (q.ride_date + q.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
    AND (NOT r.active OR (NOT q.routine_override AND (
      NOT (extract(isodow FROM q.routine_date)::smallint = ANY(r.days)) OR q.routine_date < r.start_date OR (r.end_date IS NOT NULL AND q.routine_date > r.end_date))));
  IF NOT r.active THEN RETURN; END IF;
  -- Restore paused exceptions and reserved offers without changing their agreed route.
  UPDATE public.ride_offers o SET status = CASE WHEN seats_remaining > 0 THEN 'available' ELSE 'full' END, routine_suppressed = false
  WHERE o.routine_id = r.routine_id AND o.routine_suppressed
    AND (o.ride_date + o.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
    AND (o.routine_override OR (o.routine_date >= r.start_date AND (r.end_date IS NULL OR o.routine_date <= r.end_date) AND extract(isodow FROM o.routine_date)::smallint = ANY(r.days)));
  UPDATE public.ride_requests q SET status = 'open', routine_suppressed = false
  WHERE q.routine_id = r.routine_id AND q.routine_suppressed AND q.routine_override
    AND (q.ride_date + q.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
    AND NOT EXISTS(SELECT 1 FROM public.ride_matches m WHERE m.request_id = q.request_id);
  FOR day IN SELECT d::date FROM generate_series(greatest(today,r.start_date)::timestamp, least(today + 27,coalesce(r.end_date,today + 27))::timestamp, interval '1 day') d
    WHERE extract(isodow FROM d)::smallint = ANY(r.days)
      AND (d::date + r.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
  LOOP
    IF (r.kind='offer' AND EXISTS(SELECT 1 FROM public.ride_offers o WHERE o.routine_id=r.routine_id AND o.routine_override AND o.routine_date<>day AND o.ride_date=day AND o.departure_time=r.departure_time))
      OR (r.kind='request' AND EXISTS(SELECT 1 FROM public.ride_requests q WHERE q.routine_id=r.routine_id AND q.routine_override AND q.routine_date<>day AND q.ride_date=day AND q.departure_time=r.departure_time)) THEN CONTINUE; END IF;
    IF r.kind = 'offer' THEN
      INSERT INTO public.ride_offers(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,ride_date,departure_time,available_seats,seats_remaining,time_tolerance_minutes,total_price,routine_id,routine_date)
      VALUES(r.user_id,r.origin,r.destination,r.origin_lat,r.origin_lng,r.destination_lat,r.destination_lng,day,r.departure_time,r.seat_count,r.seat_count,r.time_tolerance_minutes,r.total_price,r.routine_id,day)
      ON CONFLICT (routine_id,routine_date) DO UPDATE SET
        origin=EXCLUDED.origin,destination=EXCLUDED.destination,origin_lat=EXCLUDED.origin_lat,origin_lng=EXCLUDED.origin_lng,destination_lat=EXCLUDED.destination_lat,destination_lng=EXCLUDED.destination_lng,
        departure_time=EXCLUDED.departure_time,available_seats=EXCLUDED.available_seats,seats_remaining=EXCLUDED.available_seats,time_tolerance_minutes=EXCLUDED.time_tolerance_minutes,total_price=EXCLUDED.total_price,status='available',routine_suppressed=false
      WHERE NOT ride_offers.routine_override AND (ride_offers.status <> 'cancelled' OR ride_offers.routine_suppressed)
        AND (ride_offers.ride_date + ride_offers.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
        AND NOT EXISTS(SELECT 1 FROM public.ride_matches m WHERE m.offer_id=ride_offers.offer_id);
    ELSE
      INSERT INTO public.ride_requests(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,ride_date,departure_time,passenger_count,time_tolerance_minutes,routine_id,routine_date)
      VALUES(r.user_id,r.origin,r.destination,r.origin_lat,r.origin_lng,r.destination_lat,r.destination_lng,day,r.departure_time,r.seat_count,r.time_tolerance_minutes,r.routine_id,day)
      ON CONFLICT (routine_id,routine_date) DO UPDATE SET
        origin=EXCLUDED.origin,destination=EXCLUDED.destination,origin_lat=EXCLUDED.origin_lat,origin_lng=EXCLUDED.origin_lng,destination_lat=EXCLUDED.destination_lat,destination_lng=EXCLUDED.destination_lng,
        departure_time=EXCLUDED.departure_time,passenger_count=EXCLUDED.passenger_count,time_tolerance_minutes=EXCLUDED.time_tolerance_minutes,status='open',routine_suppressed=false
      WHERE NOT ride_requests.routine_override AND (ride_requests.status <> 'cancelled' OR ride_requests.routine_suppressed)
        AND (ride_requests.ride_date + ride_requests.departure_time) AT TIME ZONE 'America/Fortaleza' > stamp
        AND NOT EXISTS(SELECT 1 FROM public.ride_matches m WHERE m.request_id=ride_requests.request_id);
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.refresh_ride_routine_occurrences()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; request_row record; changed boolean := false;
  today date := (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(74120391);
  FOR r IN SELECT routine_id FROM public.ride_routines WHERE active AND generated_on IS DISTINCT FROM today ORDER BY kind,routine_id LOOP
    PERFORM public.materialize_ride_routine(r.routine_id);
    UPDATE public.ride_routines SET generated_on=today WHERE routine_id=r.routine_id;
    changed := true;
  END LOOP;
  IF changed THEN
    FOR request_row IN SELECT request_id FROM public.ride_requests WHERE status='open' AND ride_date BETWEEN today AND today+27 ORDER BY created_at LOOP
      PERFORM public.try_match_ride_request(request_row.request_id);
    END LOOP;
  END IF;
END;
$$;

CREATE FUNCTION public.save_ride_routine(p_definition jsonb, p_routine_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved uuid; old_kind text; selected_days smallint[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(74120391);
  IF p_routine_id IS NOT NULL THEN
    SELECT kind INTO old_kind FROM public.ride_routines WHERE routine_id=p_routine_id AND user_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Routine not found'; END IF;
    IF old_kind <> p_definition->>'kind' THEN RAISE EXCEPTION 'Routine kind cannot change'; END IF;
  END IF;
  SELECT array_agg(value ORDER BY value) INTO selected_days FROM (SELECT DISTINCT value::smallint FROM jsonb_array_elements_text(p_definition->'days')) days;
  INSERT INTO public.ride_routines(routine_id,user_id,kind,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,days,departure_time,start_date,end_date,seat_count,time_tolerance_minutes,total_price,active)
  VALUES(coalesce(p_routine_id,gen_random_uuid()),auth.uid(),p_definition->>'kind',btrim(p_definition->>'origin'),btrim(p_definition->>'destination'),
    (p_definition->>'originLat')::double precision,(p_definition->>'originLng')::double precision,(p_definition->>'destinationLat')::double precision,(p_definition->>'destinationLng')::double precision,
    selected_days,(p_definition->>'departureTime')::time,(p_definition->>'startDate')::date,(p_definition->>'endDate')::date,(p_definition->>'seats')::integer,coalesce((p_definition->>'timeToleranceMinutes')::integer,15),coalesce((p_definition->>'totalPrice')::numeric,30),coalesce((p_definition->>'active')::boolean,true))
  ON CONFLICT(routine_id) DO UPDATE SET origin=EXCLUDED.origin,destination=EXCLUDED.destination,origin_lat=EXCLUDED.origin_lat,origin_lng=EXCLUDED.origin_lng,destination_lat=EXCLUDED.destination_lat,destination_lng=EXCLUDED.destination_lng,
    days=EXCLUDED.days,departure_time=EXCLUDED.departure_time,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,seat_count=EXCLUDED.seat_count,time_tolerance_minutes=EXCLUDED.time_tolerance_minutes,total_price=EXCLUDED.total_price,active=EXCLUDED.active,generated_on=NULL,updated_at=now()
  RETURNING routine_id INTO saved;
  PERFORM public.materialize_ride_routine(saved);
  PERFORM public.refresh_ride_routine_occurrences();
  RETURN saved;
END;
$$;

CREATE FUNCTION public.set_ride_routine_active(p_routine_id uuid,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(74120391);
  UPDATE public.ride_routines SET active=p_active,generated_on=NULL,updated_at=now() WHERE routine_id=p_routine_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Routine not found'; END IF;
  PERFORM public.materialize_ride_routine(p_routine_id);
  PERFORM public.refresh_ride_routine_occurrences();
END;
$$;

CREATE FUNCTION public.change_ride_routine_occurrence(p_kind text,p_id uuid,p_cancel boolean DEFAULT false,p_changes jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE source jsonb; trip public.rides%ROWTYPE; count_seats integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(74120391);
  IF p_kind='offer' THEN SELECT to_jsonb(o) INTO source FROM public.ride_offers o WHERE offer_id=p_id AND user_id=auth.uid() AND routine_id IS NOT NULL FOR UPDATE;
  ELSIF p_kind='request' THEN SELECT to_jsonb(q) INTO source FROM public.ride_requests q WHERE request_id=p_id AND user_id=auth.uid() AND routine_id IS NOT NULL FOR UPDATE;
  ELSE RAISE EXCEPTION 'Invalid occurrence kind'; END IF;
  IF source IS NULL THEN RAISE EXCEPTION 'Occurrence not found'; END IF;
  IF ((source->>'ride_date')::date + (source->>'departure_time')::time) AT TIME ZONE 'America/Fortaleza' <= clock_timestamp() THEN RAISE EXCEPTION 'Past occurrences cannot change'; END IF;
  IF p_cancel THEN
    PERFORM ride_id FROM public.rides WHERE (p_kind='offer' AND offer_id=p_id) OR (p_kind='request' AND request_id=p_id) ORDER BY ride_id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.rides WHERE ((p_kind='offer' AND offer_id=p_id) OR (p_kind='request' AND request_id=p_id)) AND status IN ('IN_PROGRESS','COMPLETED')) THEN RAISE EXCEPTION 'Running or completed rides cannot be cancelled as occurrences'; END IF;
    FOR trip IN SELECT * FROM public.rides WHERE ((p_kind='offer' AND offer_id=p_id) OR (p_kind='request' AND request_id=p_id)) AND status IN ('MATCHED','CONFIRMED') LOOP
      PERFORM public.transition_ride_status(trip.ride_id,'CANCELLED');
      SELECT passenger_count INTO count_seats FROM public.ride_requests WHERE request_id=trip.request_id;
      UPDATE public.ride_requests SET status='cancelled' WHERE request_id=trip.request_id;
      UPDATE public.ride_offers SET seats_remaining=least(available_seats,seats_remaining+count_seats),status=CASE WHEN status='cancelled' THEN status ELSE 'available' END WHERE offer_id=trip.offer_id;
    END LOOP;
    IF p_kind='offer' THEN UPDATE public.ride_offers SET status='cancelled',routine_override=true,routine_suppressed=false WHERE offer_id=p_id;
    ELSE UPDATE public.ride_requests SET status='cancelled',routine_override=true,routine_suppressed=false WHERE request_id=p_id; END IF;
    RETURN;
  END IF;
  IF source->>'status'='cancelled' OR (source->>'routine_suppressed')::boolean THEN RAISE EXCEPTION 'Cancelled occurrences cannot be edited'; END IF;
  IF EXISTS(SELECT 1 FROM public.ride_matches WHERE (p_kind='offer' AND offer_id=p_id) OR (p_kind='request' AND request_id=p_id)) THEN RAISE EXCEPTION 'Matched occurrences cannot be edited'; END IF;
  IF p_changes IS NULL OR ((p_changes->>'rideDate')::date + (p_changes->>'departureTime')::time) AT TIME ZONE 'America/Fortaleza' <= clock_timestamp() THEN RAISE EXCEPTION 'A future departure is required'; END IF;
  IF (p_changes->>'departureTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid departure time'; END IF;
  IF (p_changes->>'timeToleranceMinutes')::integer NOT IN (5,15,30,60) OR (p_changes->>'totalPrice')::numeric NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Invalid occurrence defaults'; END IF;
  IF (p_kind='offer' AND EXISTS(SELECT 1 FROM public.ride_offers o WHERE o.routine_id=(source->>'routine_id')::uuid AND o.offer_id<>p_id AND o.status<>'cancelled' AND o.ride_date=(p_changes->>'rideDate')::date AND o.departure_time=(p_changes->>'departureTime')::time))
    OR (p_kind='request' AND EXISTS(SELECT 1 FROM public.ride_requests q WHERE q.routine_id=(source->>'routine_id')::uuid AND q.request_id<>p_id AND q.status<>'cancelled' AND q.ride_date=(p_changes->>'rideDate')::date AND q.departure_time=(p_changes->>'departureTime')::time)) THEN RAISE EXCEPTION 'Already scheduled occurrence'; END IF;
  IF p_kind='offer' THEN
    UPDATE public.ride_offers SET origin=btrim(p_changes->>'origin'),destination=btrim(p_changes->>'destination'),origin_lat=(p_changes->>'originLat')::double precision,origin_lng=(p_changes->>'originLng')::double precision,destination_lat=(p_changes->>'destinationLat')::double precision,destination_lng=(p_changes->>'destinationLng')::double precision,
      ride_date=(p_changes->>'rideDate')::date,departure_time=(p_changes->>'departureTime')::time,available_seats=(p_changes->>'seats')::integer,seats_remaining=(p_changes->>'seats')::integer,total_price=(p_changes->>'totalPrice')::numeric,time_tolerance_minutes=(p_changes->>'timeToleranceMinutes')::integer,routine_override=true WHERE offer_id=p_id;
    FOR source IN SELECT to_jsonb(q) FROM public.ride_requests q WHERE status='open' AND ride_date=(p_changes->>'rideDate')::date LOOP
      PERFORM public.try_match_ride_request((source->>'request_id')::uuid,p_id);
    END LOOP;
  ELSE
    UPDATE public.ride_requests SET origin=btrim(p_changes->>'origin'),destination=btrim(p_changes->>'destination'),origin_lat=(p_changes->>'originLat')::double precision,origin_lng=(p_changes->>'originLng')::double precision,destination_lat=(p_changes->>'destinationLat')::double precision,destination_lng=(p_changes->>'destinationLng')::double precision,
      ride_date=(p_changes->>'rideDate')::date,departure_time=(p_changes->>'departureTime')::time,passenger_count=(p_changes->>'seats')::integer,time_tolerance_minutes=(p_changes->>'timeToleranceMinutes')::integer,routine_override=true WHERE request_id=p_id;
    PERFORM public.try_match_ride_request(p_id);
  END IF;
END;
$$;

CREATE FUNCTION public.get_my_ride_routines()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_ride_routine_occurrences();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.routine_id,'kind',r.kind,'origin',r.origin,'destination',r.destination,'originLat',r.origin_lat,'originLng',r.origin_lng,'destinationLat',r.destination_lat,'destinationLng',r.destination_lng,
    'days',r.days,'departureTime',to_char(r.departure_time,'HH24:MI'),'startDate',r.start_date,'endDate',r.end_date,'seats',r.seat_count,'timeToleranceMinutes',r.time_tolerance_minutes,'totalPrice',r.total_price,'active',r.active,
    'occurrences',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'rideDate',s.ride_date,'departureTime',to_char(s.departure_time,'HH24:MI'),'origin',s.origin,'destination',s.destination,'originLat',s.origin_lat,'originLng',s.origin_lng,'destinationLat',s.destination_lat,'destinationLng',s.destination_lng,'seats',s.seats,'totalPrice',s.total_price,'timeToleranceMinutes',s.time_tolerance_minutes,'status',s.status,'overridden',s.routine_override,
      'canEdit',s.status <> 'cancelled' AND NOT EXISTS(SELECT 1 FROM public.ride_matches m WHERE (r.kind='offer' AND m.offer_id=s.id) OR (r.kind='request' AND m.request_id=s.id)),
      'canCancel',s.status <> 'cancelled' AND NOT EXISTS(SELECT 1 FROM public.rides t WHERE ((r.kind='offer' AND t.offer_id=s.id) OR (r.kind='request' AND t.request_id=s.id)) AND t.status IN ('IN_PROGRESS','COMPLETED'))
    ) ORDER BY s.ride_date,s.departure_time),'[]') FROM (
      SELECT offer_id id,ride_date,departure_time,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,available_seats seats,total_price,time_tolerance_minutes,status,routine_override FROM public.ride_offers WHERE routine_id=r.routine_id
      UNION ALL
      SELECT request_id,ride_date,departure_time,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,passenger_count,0,time_tolerance_minutes,status,routine_override FROM public.ride_requests WHERE routine_id=r.routine_id
    ) s WHERE (s.ride_date+s.departure_time) AT TIME ZONE 'America/Fortaleza' > clock_timestamp())
  ) ORDER BY r.created_at DESC),'[]') FROM public.ride_routines r WHERE r.user_id=auth.uid());
END;
$$;

CREATE FUNCTION public.get_offer_schedule_types(p_offer_ids uuid[])
RETURNS TABLE(offer_id uuid,is_recurring boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN QUERY SELECT o.offer_id,o.routine_id IS NOT NULL FROM public.ride_offers o
    WHERE o.offer_id=ANY(p_offer_ids) AND o.user_id<>auth.uid() AND o.status IN ('available','full')
      AND (o.ride_date+o.departure_time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION public.get_offer_schedule_types(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_offer_schedule_types(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.materialize_ride_routine(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refresh_ride_routine_occurrences(),public.save_ride_routine(jsonb,uuid),public.set_ride_routine_active(uuid,boolean),public.change_ride_routine_occurrence(text,uuid,boolean,jsonb),public.get_my_ride_routines() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_ride_routine_occurrences(),public.save_ride_routine(jsonb,uuid),public.set_ride_routine_active(uuid,boolean),public.change_ride_routine_occurrence(text,uuid,boolean,jsonb),public.get_my_ride_routines() TO authenticated;
