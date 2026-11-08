CREATE OR REPLACE FUNCTION public.get_admin_driver_debts_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(d ORDER BY (d->>'pendingCount')::int DESC, (d->>'pendingAmount')::numeric DESC),'[]'::jsonb) INTO r
 FROM (
  SELECT jsonb_build_object(
   'driverId', f.driver_id,
   'name', coalesce(p.full_name,'Sem nome'),
   'email', u.email,
   'vehicle', nullif(trim(concat_ws(' ', p.vehicle_brand, p.vehicle_description)),''),
   'plate', p.vehicle_plate,
   'pendingCount', count(*),
   'openCount', count(*) FILTER (WHERE f.status='OPEN'),
   'claimedCount', count(*) FILTER (WHERE f.status='CLAIMED'),
   'pendingAmount', coalesce(sum(f.fee_amount),0),
   'blocked', count(*) >= 3,
   'oldestAt', min(f.created_at),
   'items', jsonb_agg(jsonb_build_object('rideId',f.ride_id,'status',f.status,'gross',f.gross_amount,'fee',f.fee_amount,'createdAt',f.created_at,'claimReference',f.claim_reference) ORDER BY f.created_at)
  ) d
  FROM public.driver_platform_fees f
  LEFT JOIN public.profiles p ON p.id=f.driver_id
  LEFT JOIN auth.users u ON u.id=f.driver_id
  WHERE f.status <> 'SETTLED'
  GROUP BY f.driver_id, p.full_name, u.email, p.vehicle_brand, p.vehicle_description, p.vehicle_plate
 ) s;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_driver_debts_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_driver_debts_overview() TO authenticated;