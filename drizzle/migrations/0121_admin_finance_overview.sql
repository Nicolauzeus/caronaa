CREATE OR REPLACE FUNCTION public.get_admin_finance_overview(p_since timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object(
  'quotes', (SELECT jsonb_build_object(
     'count', count(*),
     'booked', count(*) FILTER (WHERE ride_id IS NOT NULL),
     'customer_cents', coalesce(sum(customer_pays_cents) FILTER (WHERE ride_id IS NOT NULL),0),
     'driver_cents', coalesce(sum(driver_receives_cents) FILTER (WHERE ride_id IS NOT NULL),0),
     'commission_cents', coalesce(sum(platform_commission_cents) FILTER (WHERE ride_id IS NOT NULL),0),
     'processing_cents', coalesce(sum(platform_processing_fee_cents) FILTER (WHERE ride_id IS NOT NULL),0))
   FROM public.caronaa_quick_fare_quotes WHERE p_since IS NULL OR issued_at>=p_since),
  'fees', (SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'count',n,'gross',g,'fee',f)),'[]'::jsonb)
   FROM (SELECT status::text, count(*) n, coalesce(sum(gross_amount),0) g, coalesce(sum(fee_amount),0) f
         FROM public.driver_platform_fees WHERE p_since IS NULL OR created_at>=p_since GROUP BY 1) x)
 ) INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_finance_overview(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_overview(timestamptz) TO authenticated;