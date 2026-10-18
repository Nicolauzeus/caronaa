-- Aggregated read-only financial reporting. Uses existing public.payments.
-- No payment updates, captures, transfers or payment policy changes.
CREATE OR REPLACE FUNCTION public.get_admin_finance_summary(p_since timestamptz DEFAULT NULL)
RETURNS TABLE(currency text,provider text,payment_status text,transactions bigint,total_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT p.currency,p.provider,p.status::text,count(*)::bigint,
   coalesce(sum(p.amount),0)::numeric
 FROM public.payments p
 WHERE p_since IS NULL OR p.created_at>=p_since
 GROUP BY p.currency,p.provider,p.status::text
 ORDER BY p.currency,p.provider,p.status::text;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_finance_summary(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_summary(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_finance_recent(p_since timestamptz DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS TABLE(payment_id uuid,created_at timestamptz,currency text,provider text,payment_status text,amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT p.payment_id,p.created_at,p.currency,p.provider,p.status::text,p.amount
 FROM public.payments p WHERE p_since IS NULL OR p.created_at>=p_since
 ORDER BY p.created_at DESC LIMIT LEAST(GREATEST(coalesce(p_limit,50),1),100);
END $$;
REVOKE ALL ON FUNCTION public.get_admin_finance_recent(timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_recent(timestamptz,integer) TO authenticated;
NOTIFY pgrst,'reload schema';