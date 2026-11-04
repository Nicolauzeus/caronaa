CREATE OR REPLACE FUNCTION public.admin_quick_ride_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'regions', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.municipality) FROM public.professional_service_regions r), '[]'::jsonb),
    'drivers', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',p.full_name,'approved',a.approved,'vehicle_type',a.vehicle_type,'approved_at',a.approved_at) ORDER BY a.updated_at DESC)
       FROM public.professional_driver_authorizations a LEFT JOIN public.profiles p ON p.id=a.user_id), '[]'::jsonb),
    'rides', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',q.id,'municipality',q.municipality,'vehicle_type',q.vehicle_type,'status',q.status,'requested_at',q.requested_at) ORDER BY q.requested_at DESC)
       FROM (SELECT * FROM public.professional_quick_rides ORDER BY requested_at DESC LIMIT 30) q), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_quick_ride_region(p_municipality text, p_discovery boolean, p_dispatch boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  IF length(btrim(coalesce(p_municipality,''))) < 2 THEN RAISE EXCEPTION 'Município inválido'; END IF;
  INSERT INTO public.professional_service_regions(municipality, public_discovery_enabled, dispatch_enabled, updated_at)
  VALUES (btrim(p_municipality), p_discovery, p_dispatch, now())
  ON CONFLICT (municipality) DO UPDATE SET public_discovery_enabled=EXCLUDED.public_discovery_enabled, dispatch_enabled=EXCLUDED.dispatch_enabled, updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_quick_ride_driver(p_email text, p_approved boolean, p_vehicle_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  IF p_vehicle_type NOT IN ('CAR','MOTO') THEN RAISE EXCEPTION 'Veículo inválido'; END IF;
  SELECT u.id INTO v_id FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE lower(u.email)=lower(btrim(p_email));
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  INSERT INTO public.professional_driver_authorizations(user_id, approved, vehicle_type, approved_at, updated_at)
  VALUES (v_id, p_approved, p_vehicle_type, CASE WHEN p_approved THEN now() END, now())
  ON CONFLICT (user_id) DO UPDATE SET approved=EXCLUDED.approved, vehicle_type=EXCLUDED.vehicle_type,
    approved_at=CASE WHEN EXCLUDED.approved THEN now() END, updated_at=now();
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_quick_ride_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_quick_ride_region(text,boolean,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_quick_ride_driver(text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quick_ride_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_quick_ride_region(text,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_quick_ride_driver(text,boolean,text) TO authenticated;