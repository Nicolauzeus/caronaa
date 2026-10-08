-- Migration 0038: Confirmação de carona presencial por QR Code seguro
CREATE TABLE IF NOT EXISTS public.ride_qr_tokens (
  token text PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id),
  passenger_user_id uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ride_qr_tokens_ride_idx ON public.ride_qr_tokens(ride_id);
CREATE INDEX IF NOT EXISTS ride_qr_tokens_driver_idx ON public.ride_qr_tokens(driver_user_id);

ALTER TABLE public.ride_qr_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ride_qr_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ride_qr_tokens TO service_role;

-- Função atômica para o motorista gerar token temporário do QR
CREATE OR REPLACE FUNCTION public.generate_ride_qr_token(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides%ROWTYPE;
  v_token text;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;

  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carona não encontrada.';
  END IF;

  IF r.driver_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o motorista da viagem pode gerar o QR de confirmação.';
  END IF;

  IF r.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'O QR Code só pode ser gerado para viagens confirmadas.';
  END IF;

  -- Token opaco único de 32 caracteres hexadecimais
  v_token := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_expires := clock_timestamp() + interval '10 minutes';

  INSERT INTO public.ride_qr_tokens (
    token,
    ride_id,
    driver_user_id,
    passenger_user_id,
    expires_at
  ) VALUES (
    v_token,
    p_ride_id,
    r.driver_user_id,
    r.passenger_user_id,
    v_expires
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires,
    'rideId', p_ride_id
  );
END;
$$;

-- Função atômica para o passageiro confirmar a carona lendo o token
CREATE OR REPLACE FUNCTION public.confirm_ride_by_qr(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.ride_qr_tokens%ROWTYPE;
  r public.rides%ROWTYPE;
  v_driver_name text;
  v_vehicle_model text;
  v_vehicle_plate text;
  v_destination text;
  v_departure_time text;
  v_plate_masked text := '';
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para confirmar a carona.';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Código ou QR Code inválido.';
  END IF;

  -- Bloqueio pessimista do token para evitar concorrência/replay
  SELECT * INTO t FROM public.ride_qr_tokens WHERE token = btrim(p_token) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR Code não encontrado ou inválido.';
  END IF;

  IF t.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este QR já foi utilizado.';
  END IF;

  IF t.expires_at < v_now THEN
    RAISE EXCEPTION 'Este QR expirou. Peça ao motorista para gerar um novo.';
  END IF;

  -- Bloqueio da corrida correspondente
  SELECT * INTO r FROM public.rides WHERE ride_id = t.ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem associada ao QR não encontrada.';
  END IF;

  IF r.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'A viagem não permite mais confirmação de embarque (status atual: %).', r.status;
  END IF;

  -- Valida se o usuário que está escaneando é o passageiro da viagem
  IF r.passenger_user_id IS DISTINCT FROM auth.uid() AND (t.passenger_user_id IS NOT NULL AND t.passenger_user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Você não é participante autorizado desta viagem.';
  END IF;

  -- Marca token como consumido imediatamente
  UPDATE public.ride_qr_tokens
  SET used_at = v_now
  WHERE token = t.token;

  -- Consome também o PIN de segurança caso exista
  UPDATE public.ride_boarding_codes
  SET consumed_at = v_now
  WHERE ride_id = r.ride_id AND consumed_at IS NULL;

  -- Atualiza a corrida para IN_PROGRESS
  UPDATE public.rides
  SET status = 'IN_PROGRESS',
      boarded_at = v_now,
      updated_at = v_now
  WHERE ride_id = r.ride_id;

  -- Registra no histórico de status
  INSERT INTO public.ride_status_history (
    ride_id,
    from_status,
    to_status,
    actor_user_id
  ) VALUES (
    r.ride_id,
    'CONFIRMED',
    'IN_PROGRESS',
    auth.uid()
  );

  -- Busca informações de retorno amigáveis e sanitizadas
  SELECT full_name INTO v_driver_name FROM public.profiles WHERE id = r.driver_user_id;

  -- Busca detalhes da oferta associada
  SELECT
    coalesce(ro.vehicle_model, 'Veículo cadastrado'),
    coalesce(ro.vehicle_plate, ''),
    coalesce(ro.destination_label, 'Destino confirmado'),
    coalesce(ro.departure_time, '')
  INTO
    v_vehicle_model,
    v_vehicle_plate,
    v_destination,
    v_departure_time
  FROM public.ride_matches rm
  JOIN public.ride_offers ro ON ro.offer_id = rm.offer_id
  WHERE rm.match_id = r.match_id;

  -- Mascaramento da placa para segurança (exibe apenas os últimos caracteres)
  IF length(v_vehicle_plate) >= 4 THEN
    v_plate_masked := '•••• ' || substr(v_vehicle_plate, length(v_vehicle_plate) - 3);
  ELSE
    v_plate_masked := '••••';
  END IF;

  RETURN jsonb_build_object(
    'confirmed', true,
    'rideId', r.ride_id,
    'driverName', coalesce(v_driver_name, 'Motorista'),
    'vehicleModel', coalesce(v_vehicle_model, 'Veículo confirmado'),
    'vehiclePlate', v_plate_masked,
    'destination', coalesce(v_destination, 'Destino da viagem'),
    'departureTime', coalesce(v_departure_time, 'Horário combinado')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_ride_qr_token(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_ride_by_qr(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_ride_qr_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ride_by_qr(text) TO authenticated;

