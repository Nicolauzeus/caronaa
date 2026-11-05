-- 0130: Manual Pix directly to the driver for a COMPLETED shared ride.
-- Confirmed prices are immutable. An inconsistent historical quote is blocked,
-- never silently recalculated. This routine never marks a payment as received.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_ride_pix(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $pix$
DECLARE
  r public.rides%ROWTYPE;
  rr public.ride_requests%ROWTYPE;
  v_total numeric(10,2);
  v_key text;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND OR (r.passenger_user_id IS DISTINCT FROM auth.uid()
    AND r.driver_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Pix indisponível para esta conta' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Pix disponível após conclusão por ambos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO rr FROM public.ride_requests WHERE request_id = r.request_id;
  IF NOT FOUND OR rr.user_id IS DISTINCT FROM r.passenger_user_id OR
     rr.passenger_count IS NULL OR rr.passenger_count NOT BETWEEN 1 AND 6 OR
     r.passenger_price IS NULL OR r.passenger_price <= 0 OR
     r.passenger_group_total IS NULL THEN
    RAISE EXCEPTION 'Preço ou ocupação da reserva não validado. Não realize o Pix.' USING ERRCODE = '22023';
  END IF;
  -- Only the passenger's requested seat quantity is chargeable.
  -- The driver's available_seats/seats_remaining must never be used here.
  v_total := round(r.passenger_price * rr.passenger_count, 2);
  IF r.passenger_group_total IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Valor histórico diverge das vagas solicitadas. Pagamento bloqueado para revisão.'
      USING ERRCODE = '22023';
  END IF;
  SELECT d.pix_key INTO v_key FROM public.driver_pix_settings d WHERE d.user_id = r.driver_user_id;
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = r.driver_user_id;
  RETURN jsonb_build_object(
    'key', v_key, 'name', coalesce(nullif(v_name,''), 'Motorista'),
    'amount', v_total, 'passengerCount', rr.passenger_count,
    'pricePerPassenger', r.passenger_price,
    'paymentMethod', 'MANUAL_DRIVER_PIX', 'automaticConfirmation', false
  );
END $pix$;
REVOKE ALL ON FUNCTION public.get_ride_pix(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ride_pix(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
