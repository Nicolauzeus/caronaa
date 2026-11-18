-- Requisito único para ativar motorista de carona comum.
-- A conta básica pode existir sem veículo; active_role=MOTORISTA só após
-- foto, nome completo e TODOS os campos obrigatórios do veículo.
-- Não concede autorização profissional F07.
CREATE OR REPLACE FUNCTION public.validate_shared_driver_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $check$
DECLARE
  v_plate text;
  v_name text;
BEGIN
  IF NEW.active_role = 'MOTORISTA'
     AND OLD.active_role IS DISTINCT FROM NEW.active_role THEN
    v_plate := upper(regexp_replace(coalesce(NEW.vehicle_plate,''), '[^A-Za-z0-9]', '', 'g'));
    v_name := btrim(coalesce(NEW.full_name,''));
    IF v_name !~ '^\S{2,}(\s+\S+)+ THEN
      RAISE EXCEPTION 'Nome e sobrenome são obrigatórios para motoristas'
        USING ERRCODE='23514';
    END IF;
    IF coalesce(NEW.avatar_url,'') !~ '^https://' THEN
      RAISE EXCEPTION 'Foto obrigatória para motoristas'
        USING ERRCODE='23514';
    END IF;
    IF length(btrim(coalesce(NEW.vehicle_brand,'')))=0
       OR length(btrim(coalesce(NEW.vehicle_description,'')))=0
       OR length(btrim(coalesce(NEW.vehicle_color,'')))=0 THEN
      RAISE EXCEPTION 'Preencha marca, modelo e cor do veículo'
        USING ERRCODE='23514';
    END IF;
    IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$' THEN
      RAISE EXCEPTION 'Informe uma placa brasileira válida'
        USING ERRCODE='23514';
    END IF;
    IF NEW.vehicle_type NOT IN ('car','moto')
       OR NEW.vehicle_seats IS NULL
       OR (NEW.vehicle_type='moto' AND NEW.vehicle_seats<>1)
       OR (NEW.vehicle_type='car' AND (NEW.vehicle_seats<1 OR NEW.vehicle_seats>3)) THEN
      RAISE EXCEPTION 'Informe tipo de veículo e vagas válidos'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$check$;

REVOKE ALL ON FUNCTION public.validate_shared_driver_activation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_shared_driver_activation_guard ON public.profiles;
CREATE TRIGGER profile_shared_driver_activation_guard
BEFORE UPDATE OF active_role ON public.profiles
FOR EACH ROW
WHEN (NEW.active_role = 'MOTORISTA' AND OLD.active_role IS DISTINCT FROM NEW.active_role)
EXECUTE FUNCTION public.validate_shared_driver_activation();

COMMENT ON TRIGGER profile_shared_driver_activation_guard ON public.profiles IS
  'Perfil motorista tradicional exige foto, nome, veículo, cor, placa e vagas antes da ativação; não concede F07.';
 THEN
      RAISE EXCEPTION 'Nome e sobrenome são obrigatórios para motoristas'
        USING ERRCODE='23514';
    END IF;
    IF coalesce(NEW.avatar_url,'') !~ '^https://' THEN
      RAISE EXCEPTION 'Foto obrigatória para motoristas'
        USING ERRCODE='23514';
    END IF;
    IF length(btrim(coalesce(NEW.vehicle_brand,'')))=0
       OR length(btrim(coalesce(NEW.vehicle_description,'')))=0
       OR length(btrim(coalesce(NEW.vehicle_color,'')))=0 THEN
      RAISE EXCEPTION 'Preencha marca, modelo e cor do veículo'
        USING ERRCODE='23514';
    END IF;
    IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$' THEN
      RAISE EXCEPTION 'Informe uma placa brasileira válida'
        USING ERRCODE='23514';
    END IF;
    IF NEW.vehicle_type NOT IN ('car','moto')
       OR NEW.vehicle_seats IS NULL OR NEW.vehicle_seats <> trunc(NEW.vehicle_seats)
       OR (NEW.vehicle_type='moto' AND NEW.vehicle_seats<>1)
       OR (NEW.vehicle_type='car' AND (NEW.vehicle_seats<1 OR NEW.vehicle_seats>3)) THEN
      RAISE EXCEPTION 'Informe tipo de veículo e vagas válidos'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$check$;

REVOKE ALL ON FUNCTION public.validate_shared_driver_activation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_shared_driver_activation_guard ON public.profiles;
CREATE TRIGGER profile_shared_driver_activation_guard
BEFORE UPDATE OF active_role ON public.profiles
FOR EACH ROW
WHEN (NEW.active_role = 'MOTORISTA' AND OLD.active_role IS DISTINCT FROM NEW.active_role)
EXECUTE FUNCTION public.validate_shared_driver_activation();

COMMENT ON TRIGGER profile_shared_driver_activation_guard ON public.profiles IS
  'Perfil motorista tradicional exige foto, nome, veículo, cor, placa e vagas antes da ativação; não concede F07.';
