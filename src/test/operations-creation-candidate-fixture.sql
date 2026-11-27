\set ON_ERROR_STOP on
-- Only in the disposable local fixture. Real geospatial verification is optional
-- because a stock PostgreSQL installation may not provide PostGIS.
SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='postgis') AS have_postgis \gset
\if :have_postgis
 CREATE EXTENSION postgis WITH SCHEMA public;
 ALTER TABLE public.professional_quick_rides ADD COLUMN vehicle_type text DEFAULT 'CAR',
  ADD COLUMN origin_lat double precision DEFAULT -4.22, ADD COLUMN origin_lng double precision DEFAULT -38.73,
  ADD COLUMN meeting_point_lat double precision, ADD COLUMN meeting_point_lng double precision,
  ADD COLUMN seats_requested integer DEFAULT 1;
 ALTER TABLE public.flash_driver_presence ADD COLUMN last_sampled_at timestamptz,ADD COLUMN last_accuracy_m double precision,
  ADD COLUMN available_seats integer,ADD COLUMN dispatch_mode text,ADD COLUMN last_lat double precision,
  ADD COLUMN last_lng double precision,ADD COLUMN route_geom public.geometry;
 CREATE TABLE public.professional_driver_authorizations(user_id uuid PRIMARY KEY,approved boolean,vehicle_type text);
 CREATE TABLE public.professional_driver_locations(user_id uuid PRIMARY KEY,accuracy_m double precision,sampled_at timestamptz,updated_at timestamptz);
 CREATE FUNCTION public.driver_platform_access_allowed(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
\else
 -- Only the candidate source is substituted, never the capture trigger or evidence RPC.
 -- The runner explicitly reports that the spatial predicate was NOT validated.
 CREATE OR REPLACE FUNCTION public.caronaa_flash_creation_candidate_ids(p_request_id uuid)
 RETURNS uuid[] LANGUAGE plpgsql STABLE SET search_path='' AS $stub$
 BEGIN
  IF p_request_id='81000000-0000-4000-8000-000000000003'::uuid THEN RAISE EXCEPTION 'Synthetic spatial failure'; END IF;
  IF p_request_id='81000000-0000-4000-8000-000000000001'::uuid THEN
   RETURN ARRAY['00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000005'::uuid];
  END IF;
  RETURN '{}'::uuid[];
 END;
 $stub$;
 \echo 'SKIP: actual PostGIS candidate predicates (extension unavailable); testing snapshot storage with explicit synthetic source.'
\endif
