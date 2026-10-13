-- Store server-generated road geometry with the trusted offer route quote.
-- Existing offers and passenger quote rows remain valid with NULL geometry.
ALTER TABLE public.offer_route_quotes
  ADD COLUMN IF NOT EXISTS route_path jsonb,
  ADD COLUMN IF NOT EXISTS route_duration_minutes numeric(10,2);

ALTER TABLE public.ride_offers
  ADD COLUMN IF NOT EXISTS route_path jsonb,
  ADD COLUMN IF NOT EXISTS route_duration_minutes numeric(10,2);

CREATE OR REPLACE FUNCTION public.has_valid_route_path(p_path jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE point jsonb; latitude double precision; longitude double precision;
BEGIN
  IF p_path IS NULL OR jsonb_typeof(p_path) <> 'array'
    OR jsonb_array_length(p_path) < 2 OR jsonb_array_length(p_path) > 10000 THEN
    RETURN false;
  END IF;
  FOR point IN SELECT value FROM jsonb_array_elements(p_path) AS item(value) LOOP
    IF jsonb_typeof(point) IS DISTINCT FROM 'object'
      OR jsonb_typeof(point->'lat') IS DISTINCT FROM 'number'
      OR jsonb_typeof(point->'lng') IS DISTINCT FROM 'number' THEN
      RETURN false;
    END IF;
    latitude := (point->>'lat')::double precision;
    longitude := (point->>'lng')::double precision;
    IF latitude < -90 OR latitude > 90 OR longitude < -180 OR longitude > 180
      OR latitude::text IN ('NaN', 'Infinity', '-Infinity')
      OR longitude::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.has_valid_route_path(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_route_path(jsonb) TO authenticated, service_role;

DO $route_geometry_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.offer_route_quotes'::regclass
    AND conname = 'offer_route_quotes_route_geometry_check') THEN
    ALTER TABLE public.offer_route_quotes ADD CONSTRAINT offer_route_quotes_route_geometry_check CHECK (
      (route_path IS NULL AND route_duration_minutes IS NULL)
      OR (public.has_valid_route_path(route_path) AND route_duration_minutes > 0
        AND route_duration_minutes::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ride_offers'::regclass
    AND conname = 'ride_offers_route_geometry_check') THEN
    ALTER TABLE public.ride_offers ADD CONSTRAINT ride_offers_route_geometry_check CHECK (
      (route_path IS NULL AND route_duration_minutes IS NULL)
      OR (public.has_valid_route_path(route_path) AND route_duration_minutes > 0
        AND route_duration_minutes::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    );
  END IF;
END
$route_geometry_constraints$;

-- Runs after the existing publication trigger, which resolves the quote id and
-- validates ownership, tariff, and the offer's textual route.
CREATE OR REPLACE FUNCTION public.copy_trusted_offer_route_geometry()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE quote_row public.offer_route_quotes%ROWTYPE;
BEGIN
  IF NEW.route_quote_id IS NULL THEN
    IF NEW.route_path IS NOT NULL OR NEW.route_duration_minutes IS NOT NULL THEN
      RAISE EXCEPTION 'A geometria da oferta deve vir de uma cotação confiável';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO quote_row FROM public.offer_route_quotes
  WHERE quote_id = NEW.route_quote_id AND user_id = auth.uid()
    AND expires_at > clock_timestamp();
  IF NOT FOUND OR NOT public.has_valid_route_path(quote_row.route_path)
    OR quote_row.route_duration_minutes IS NULL OR quote_row.route_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'A cotação não contém geometria rodoviária válida. Calcule novamente.';
  END IF;
  NEW.route_path := quote_row.route_path;
  NEW.route_duration_minutes := quote_row.route_duration_minutes;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.copy_trusted_offer_route_geometry() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS z_offer_route_geometry_before_insert ON public.ride_offers;
CREATE TRIGGER z_offer_route_geometry_before_insert
  BEFORE INSERT ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.copy_trusted_offer_route_geometry();

CREATE OR REPLACE FUNCTION public.guard_offer_route_geometry_update()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.route_path IS DISTINCT FROM OLD.route_path
    OR NEW.route_duration_minutes IS DISTINCT FROM OLD.route_duration_minutes THEN
    RAISE EXCEPTION 'A geometria da oferta é imutável após a publicação';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_offer_route_geometry_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS offer_route_geometry_immutable ON public.ride_offers;
CREATE TRIGGER offer_route_geometry_immutable
  BEFORE UPDATE OF route_path, route_duration_minutes ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.guard_offer_route_geometry_update();

NOTIFY pgrst, 'reload schema';