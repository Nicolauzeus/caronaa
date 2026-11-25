-- Normalize new or edited Pix keys at the authenticated owner boundary.
BEGIN;

CREATE OR REPLACE FUNCTION public.caronaa_canonical_pix_key(p_key text)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = ''
AS $pix$
DECLARE
  k text := btrim(coalesce(p_key, ''), E' \t\r\n');
  compact_key text;
BEGIN
  -- Apply the same ASCII DICT formats used by src/lib/pix.ts.
  compact_key := translate(k, ' ()/.-', '');
  CASE
    WHEN k COLLATE "C" ~ '^[ -~]+$' AND length(k) <= 77 AND
      lower(k COLLATE "C") ~ $email$^[a-z0-9.!#$'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$$email$ THEN
      k := lower(k COLLATE "C");
    WHEN k COLLATE "C" ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
      k := lower(k COLLATE "C");
    WHEN k ~ '^(\([0-9]{2}\) *|[0-9]{2} +)[0-9]{4,5}[- ]?[0-9]{4}$' OR k ~ '^[0-9]{10}$' THEN
      k := '+55' || compact_key;
    WHEN k ~ '^\+[0-9 ().-]+$' AND compact_key ~ '^\+[1-9][0-9]{1,14}$' THEN
      k := compact_key;
    WHEN k ~ '^[0-9 ().-]+$' AND compact_key ~ '^55[0-9]{10,11}$' THEN
      k := '+' || compact_key;
    WHEN k ~ '^[0-9 ./-]+$' AND compact_key ~ '^([0-9]{11}|[0-9]{14})$' THEN
      k := compact_key;
    WHEN k COLLATE "C" ~* '^([a-z0-9]{12}[0-9]{2}|[a-z0-9]{2}\.[a-z0-9]{3}\.[a-z0-9]{3}/[a-z0-9]{4}-[0-9]{2})$' THEN
      k := upper(compact_key COLLATE "C");
    ELSE
      RETURN NULL;
  END CASE;

  RETURN k;
END;
$pix$;
REVOKE ALL ON FUNCTION public.caronaa_canonical_pix_key(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_my_pix_key(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $save$
DECLARE k text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_key, ''), E' \t\r\n') = '' THEN
    RAISE EXCEPTION 'Chave Pix vazia. Cadastro existente preservado.' USING ERRCODE = '22023';
  END IF;
  k := public.caronaa_canonical_pix_key(p_key);
  IF k IS NULL THEN
    RAISE EXCEPTION 'Chave Pix inválida. Confira o formato.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.driver_pix_settings(user_id, pix_key, updated_at) VALUES (auth.uid(), k, now())
  ON CONFLICT (user_id) DO UPDATE SET pix_key = EXCLUDED.pix_key, updated_at = EXCLUDED.updated_at
    WHERE driver_pix_settings.pix_key IS DISTINCT FROM EXCLUDED.pix_key;
END;
$save$;

REVOKE ALL ON FUNCTION public.save_my_pix_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_pix_key(text) TO authenticated;
-- Match declaration eligibility to the same completed-ride quote and key used for the BR Code.
CREATE OR REPLACE FUNCTION public.quick_ride_declare_manual_pix(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $declare$
DECLARE
  ride public.professional_quick_rides%ROWTYPE;
  charge jsonb;
BEGIN
  SELECT * INTO ride FROM public.professional_quick_rides WHERE id = p_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND OR ride.passenger_id IS DISTINCT FROM auth.uid() OR ride.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Pagamento indisponivel' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quick_ride_pix_declarations
             WHERE ride_id = p_id AND passenger_declared_at IS NOT NULL) THEN
    RETURN false;
  END IF;
  charge := public.get_completed_quick_ride_pix(p_id);
  IF public.caronaa_canonical_pix_key(charge->>'key') IS NULL THEN
    RAISE EXCEPTION 'Motorista precisa revisar a chave Pix' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.quick_ride_pix_declarations(ride_id,code_hash,salt,expires_at,passenger_declared_at)
  VALUES (p_id, encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
          gen_random_uuid(), now() + interval '24 hours', now())
  ON CONFLICT (ride_id) DO UPDATE SET passenger_declared_at = now()
    WHERE quick_ride_pix_declarations.passenger_declared_at IS NULL
      AND quick_ride_pix_declarations.driver_acknowledged_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.quick_ride_payment_events(ride_id,actor_id,event_type)
    VALUES (p_id, auth.uid(), 'PASSENGER_DECLARED') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$declare$;
REVOKE ALL ON FUNCTION public.quick_ride_declare_manual_pix(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_declare_manual_pix(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
