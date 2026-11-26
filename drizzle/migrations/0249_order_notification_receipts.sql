-- 0249 | F07/F09: durable view history and explicit transport receipts.
-- Do not change dispatch, live viewers, permissions or notification preferences.
BEGIN;
CREATE TABLE public.caronaa_flash_driver_view_history (
 ride_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 first_viewed_at timestamptz NOT NULL,
 last_viewed_at timestamptz NOT NULL,
 PRIMARY KEY(ride_id,driver_id),
 CHECK(last_viewed_at>=first_viewed_at)
);
ALTER TABLE public.caronaa_flash_driver_view_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_flash_driver_view_history FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.caronaa_archive_flash_driver_view()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $view$
BEGIN
 INSERT INTO public.caronaa_flash_driver_view_history AS h
  (ride_id,driver_id,first_viewed_at,last_viewed_at)
 VALUES(NEW.ride_id,NEW.driver_id,NEW.first_viewed_at,NEW.last_viewed_at)
 ON CONFLICT(ride_id,driver_id) DO UPDATE SET
  first_viewed_at=least(h.first_viewed_at,excluded.first_viewed_at),
  last_viewed_at=greatest(h.last_viewed_at,excluded.last_viewed_at);
 RETURN NEW;
END;
$view$;
REVOKE ALL ON FUNCTION public.caronaa_archive_flash_driver_view() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER caronaa_archive_flash_driver_view
 AFTER INSERT OR UPDATE ON public.quick_ride_driver_views
 FOR EACH ROW EXECUTE FUNCTION public.caronaa_archive_flash_driver_view();
-- Preserve only receipts still present at deployment, not previously deleted ones.
INSERT INTO public.caronaa_flash_driver_view_history
 SELECT ride_id,driver_id,first_viewed_at,last_viewed_at
 FROM public.quick_ride_driver_views ON CONFLICT DO NOTHING;

CREATE TABLE public.caronaa_order_notification_receipts (
 receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service text NOT NULL CHECK(service IN ('flash','shared')),
 request_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('push','in_app')),
 dispatch_key text NOT NULL CHECK(char_length(dispatch_key) BETWEEN 1 AND 128),
 stage text NOT NULL CHECK(stage IN ('eligible','send_attempted','provider_accepted','delivery_confirmed','send_failed')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(service,request_id,driver_id,channel,dispatch_key,stage)
);
CREATE INDEX caronaa_order_notification_receipts_request_idx
 ON public.caronaa_order_notification_receipts(service,request_id,recorded_at);
ALTER TABLE public.caronaa_order_notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_order_notification_receipts FROM PUBLIC,anon,authenticated;
-- Only trusted dispatch infrastructure may attest these stages. Provider
-- acceptance is NOT delivery. delivery_confirmed requires independent evidence.
CREATE OR REPLACE FUNCTION public.caronaa_record_notification_receipt(
 p_service text,p_request_id uuid,p_driver_id uuid,p_channel text,
 p_dispatch_key text,p_stage text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $receipt$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Service authorization required' USING ERRCODE='42501';
 END IF;
 IF p_service IS NULL OR p_service NOT IN ('flash','shared') OR p_request_id IS NULL
 OR p_driver_id IS NULL OR p_channel IS NULL OR p_channel NOT IN ('push','in_app')
 OR p_dispatch_key IS NULL OR char_length(p_dispatch_key) NOT BETWEEN 1 AND 128
 OR p_stage IS NULL OR p_stage NOT IN ('eligible','send_attempted','provider_accepted','delivery_confirmed','send_failed')
 THEN RAISE EXCEPTION 'Invalid receipt' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_driver_id) OR
  NOT (CASE WHEN p_service='flash' THEN EXISTS(SELECT 1 FROM public.professional_quick_rides
   WHERE id=p_request_id AND passenger_id<>p_driver_id)
  ELSE EXISTS(SELECT 1 FROM public.ride_requests WHERE request_id=p_request_id AND user_id<>p_driver_id) END)
 THEN RAISE EXCEPTION 'Unknown request or recipient' USING ERRCODE='22023'; END IF;
 INSERT INTO public.caronaa_order_notification_receipts
  (service,request_id,driver_id,channel,dispatch_key,stage)
 VALUES(p_service,p_request_id,p_driver_id,p_channel,p_dispatch_key,p_stage)
 ON CONFLICT(service,request_id,driver_id,channel,dispatch_key,stage) DO NOTHING;
 RETURN true;
END;
$receipt$;
REVOKE ALL ON FUNCTION public.caronaa_record_notification_receipt(text,uuid,uuid,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_record_notification_receipt(text,uuid,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
