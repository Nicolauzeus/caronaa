-- Keep one defaulted signature per RPC so PostgREST can resolve omitted arguments.
DROP FUNCTION IF EXISTS public.create_ride_offer(text,text,date,time,integer);
DROP FUNCTION IF EXISTS public.create_ride_offer(text,text,date,time,integer,integer);
DROP FUNCTION IF EXISTS public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision);
DROP FUNCTION IF EXISTS public.create_ride_request(text,text,date,time,integer);
DROP FUNCTION IF EXISTS public.create_ride_request(text,text,date,time,integer,integer);
DROP FUNCTION IF EXISTS public.create_ride_request(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision);
DROP FUNCTION IF EXISTS public.search_available_ride_offers(text,text,date,time,integer,integer);
DROP FUNCTION IF EXISTS public.search_available_ride_offers(text,text,date,time,integer,integer,integer);

REVOKE ALL ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_ride_request(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_request(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric) TO authenticated;
NOTIFY pgrst, 'reload schema';
