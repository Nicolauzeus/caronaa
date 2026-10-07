-- Internal recalculation must only run through authorized application functions.
REVOKE ALL ON FUNCTION public.recalculate_ride_cost_split(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_ride_total_cost(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ride_total_cost(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_ride_total_cost(p_ride_id uuid, p_total_price numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ride_row public.rides%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_total_price IS NULL OR NOT (p_total_price >= 0 AND p_total_price <= 99999999.99) THEN
    RAISE EXCEPTION 'Invalid ride price';
  END IF;

  -- Share the matching lock and lock every sibling before changing the offer price.
  PERFORM pg_advisory_xact_lock(74120391);
  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF caller <> ride_row.driver_user_id THEN
    RAISE EXCEPTION 'Only the driver can update the ride price';
  END IF;
  PERFORM 1 FROM public.rides WHERE offer_id = ride_row.offer_id ORDER BY ride_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.rides WHERE offer_id = ride_row.offer_id
    AND (status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
      OR (ride_id = p_ride_id AND status <> 'MATCHED'))
  ) THEN
    RAISE EXCEPTION 'Cannot update ride cost after confirmation';
  END IF;
  UPDATE public.ride_offers SET total_price = round(p_total_price, 2)
  WHERE offer_id = ride_row.offer_id;
  PERFORM public.recalculate_ride_cost_split(ride_row.offer_id);
  RETURN round(p_total_price, 2);
END;
$$;
