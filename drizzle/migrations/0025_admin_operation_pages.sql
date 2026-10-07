-- Administrative operations keep domain writes inside role-checked transactions.
ALTER TABLE public.ride_offers DROP CONSTRAINT ride_offers_status_check;
ALTER TABLE public.ride_offers ADD CONSTRAINT ride_offers_status_check CHECK (status IN ('available', 'full', 'cancelled'));
ALTER TABLE public.ride_requests DROP CONSTRAINT ride_requests_status_check;
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_status_check CHECK (status IN ('open', 'matched', 'cancelled'));

CREATE TABLE public.admin_driver_reviews (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  document_verified boolean NOT NULL DEFAULT false,
  vehicle_verified boolean NOT NULL DEFAULT false,
  evidence_note text NOT NULL CHECK (length(btrim(evidence_note)) >= 10),
  reviewed_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_driver_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_driver_reviews FROM anon, authenticated;

CREATE FUNCTION public.get_admin_operation_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'offers', (SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC), '[]') FROM public.ride_offers o),
    'requests', (SELECT coalesce(jsonb_agg(r ORDER BY r.created_at DESC), '[]') FROM public.ride_requests r),
    'matches', (SELECT coalesce(jsonb_agg(m ORDER BY m.created_at DESC), '[]') FROM public.ride_matches m),
    'rides', (SELECT coalesce(jsonb_agg(r ORDER BY r.created_at DESC), '[]') FROM public.rides r),
    'history', (SELECT coalesce(jsonb_agg(h), '[]') FROM public.ride_status_history h WHERE h.to_status = 'CONFIRMED'),
    'reviews', (SELECT coalesce(jsonb_agg(r), '[]') FROM public.admin_driver_reviews r),
    'users', public.get_admin_users(),
    'contacts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'phone', u.phone, 'phoneConfirmed', u.phone_confirmed_at IS NOT NULL, 'disabled', coalesce(u.banned_until > now(), false))), '[]') FROM auth.users u),
    'forms', (SELECT coalesce(jsonb_agg(jsonb_build_object('submission_id', f.submission_id, 'user_id', f.user_id, 'nome', f.nome, 'email', f.email, 'whatsapp', f.whatsapp, 'tipo_usuario', f.tipo_usuario, 'created_at', f.created_at, 'destino_trajeto', f.destino_trajeto, 'vehicleType', f.raw_payload->>'vehicleType', 'availableSeats', f.raw_payload->>'availableSeats', 'driverPrice', f.raw_payload->>'driverPrice') ORDER BY f.created_at DESC), '[]') FROM public.form_submissions f)
  );
END;
$$;

CREATE FUNCTION public.admin_operate_ride(p_action text, p_id uuid, p_offer_id uuid DEFAULT NULL, p_note text DEFAULT NULL, p_document boolean DEFAULT false, p_vehicle boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_offer uuid; target_request uuid; item public.rides%ROWTYPE; created_match uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(74120391);
  IF p_action = 'review' THEN
    IF p_note IS NULL OR length(btrim(p_note)) < 10 THEN RAISE EXCEPTION 'Informe a evidencia da revisao (minimo 10 caracteres).'; END IF;
    INSERT INTO public.admin_driver_reviews(user_id, document_verified, vehicle_verified, evidence_note, reviewed_by)
    VALUES(p_id, p_document, p_vehicle, btrim(p_note), auth.uid())
    ON CONFLICT(user_id) DO UPDATE SET document_verified = EXCLUDED.document_verified, vehicle_verified = EXCLUDED.vehicle_verified, evidence_note = EXCLUDED.evidence_note, reviewed_by = auth.uid(), reviewed_at = now();
    RETURN 'reviewed';
  ELSIF p_action = 'match' THEN
    IF EXISTS (SELECT 1 FROM public.ride_requests WHERE request_id = p_id AND target_offer_id IS NOT NULL AND (p_offer_id IS NULL OR target_offer_id <> p_offer_id)) THEN
      RAISE EXCEPTION 'Este pedido esta direcionado a outra oferta.';
    END IF;
    created_match := public.try_match_ride_request(p_id, p_offer_id);
    IF created_match IS NULL THEN RAISE EXCEPTION 'Nenhuma oferta compativel disponivel. Atualize os dados.'; END IF;
    RETURN created_match::text;
  ELSIF p_action = 'cancel_offer' THEN
    SELECT offer_id INTO target_offer FROM public.ride_offers WHERE offer_id = p_id AND status IN ('available', 'full') FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Oferta indisponivel para cancelamento.'; END IF;
  ELSIF p_action = 'cancel_request' THEN
    SELECT request_id INTO target_request FROM public.ride_requests WHERE request_id = p_id AND status IN ('open', 'matched') FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido indisponvel para cancelamento.'; END IF;
  ELSE
    RAISE EXCEPTION 'Acao administrativa invalida.';
  END IF;
  PERFORM ride_id FROM public.rides WHERE offer_id = target_offer OR request_id = target_request ORDER BY ride_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.rides WHERE (offer_id = target_offer OR request_id = target_request) AND status = 'COMPLETED') THEN
    RAISE EXCEPTION 'Nao e possivel cancelar um registro com viagem concluida.';
  END IF;
  FOR item IN SELECT * FROM public.rides WHERE (offer_id = target_offer OR request_id = target_request) AND status IN ('MATCHED', 'CONFIRMED', 'IN_PROGRESS') FOR UPDATE LOOP
    UPDATE public.rides SET status = 'CANCELLED', updated_at = now() WHERE ride_id = item.ride_id;
    UPDATE public.ride_matches SET status = 'cancelled' WHERE match_id = item.match_id;
    UPDATE public.ride_requests SET status = 'cancelled' WHERE request_id = item.request_id;
    UPDATE public.ride_offers SET seats_remaining = least(available_seats, seats_remaining + (SELECT passenger_count FROM public.ride_requests WHERE request_id = item.request_id)), status = CASE WHEN status = 'cancelled' THEN status ELSE 'available' END WHERE offer_id = item.offer_id;
    INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id) VALUES(item.ride_id, item.status, 'CANCELLED', auth.uid());
  END LOOP;
  IF target_offer IS NOT NULL THEN UPDATE public.ride_offers SET status = 'cancelled' WHERE offer_id = target_offer; END IF;
  IF target_request IS NOT NULL THEN UPDATE public.ride_requests SET status = 'cancelled' WHERE request_id = target_request; END IF;
  RETURN 'cancelled';
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_operation_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_operate_ride(text, uuid, uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operation_data(), public.admin_operate_ride(text, uuid, uuid, text, boolean, boolean) TO authenticated;
