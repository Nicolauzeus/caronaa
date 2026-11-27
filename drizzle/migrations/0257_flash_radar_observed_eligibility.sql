-- 0257 | F07/F09: observe results of the existing authorized driver radar.
-- No new dispatch predicate, no client-supplied recipient, no GPS stored in receipts.
-- This is an observed eligible radar result, NOT eligibility at request creation,
-- a notification send, provider acceptance, delivery or a card view.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_flash_driver_radar_orders_observed(p_max_distance_m integer DEFAULT 15000)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $radar$
DECLARE v_driver uuid:=auth.uid(); v_rows jsonb; v_old_timeout text;
BEGIN
 IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'ordinality' ORDER BY r.ordinality),'[]'::jsonb)
 INTO v_rows FROM public.get_flash_driver_radar_orders(p_max_distance_m) WITH ORDINALITY r;
 IF jsonb_array_length(v_rows)>0 THEN
  -- A telemetry error must not invalidate an already-authorized radar response.
  BEGIN
   v_old_timeout:=current_setting('lock_timeout');
   PERFORM set_config('lock_timeout','150ms',true);
   INSERT INTO public.caronaa_order_notification_receipts(service,request_id,driver_id,channel,dispatch_key,stage)
   SELECT 'flash',(j->>'ride_id')::uuid,v_driver,'in_app','radar_query_observed_v1','eligible'
   FROM jsonb_array_elements(v_rows) j
   WHERE NOT EXISTS(SELECT 1 FROM public.caronaa_order_notification_receipts n
    WHERE n.service='flash' AND n.request_id=(j->>'ride_id')::uuid AND n.driver_id=v_driver
     AND n.channel='in_app' AND n.dispatch_key='radar_query_observed_v1' AND n.stage='eligible')
   ON CONFLICT(service,request_id,driver_id,channel,dispatch_key,stage) DO NOTHING;
   PERFORM set_config('lock_timeout',v_old_timeout,true);
  EXCEPTION WHEN OTHERS THEN
   -- Subtransaction rolls back the partial receipt and local setting.
   RAISE WARNING 'CARONAA radar observation unavailable';
  END;
 END IF;
 RETURN v_rows;
END;
$radar$;
REVOKE ALL ON FUNCTION public.get_flash_driver_radar_orders_observed(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_flash_driver_radar_orders_observed(integer) TO authenticated;
COMMENT ON FUNCTION public.get_flash_driver_radar_orders_observed(integer) IS 'Same authorized radar result as original RPC; best-effort distinct observed eligibility per order/driver; no delivery proof.';
NOTIFY pgrst,'reload schema';
COMMIT;
