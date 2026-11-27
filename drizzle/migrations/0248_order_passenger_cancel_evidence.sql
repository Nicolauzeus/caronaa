-- 0248 | F07/F09: passenger cancellation evidence and optional reason.
-- Keep the existing cancellation state machine; do not rewrite past orders.
BEGIN;
CREATE TABLE public.caronaa_order_passenger_cancellations (
 service text NOT NULL CHECK (service IN ('flash','shared')),
 request_id uuid NOT NULL,
 passenger_id uuid NOT NULL,
 previous_status text NOT NULL,
 cancelled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason_code text CHECK (reason_code IN ('WAIT_TOO_LONG','CHANGED_PLANS','PRICE','FOUND_ALTERNATIVE','WRONG_ROUTE','TECHNICAL_PROBLEM','OTHER','PREFER_NOT_TO_SAY')),
 reason_recorded_at timestamptz,
 PRIMARY KEY(service,request_id)
);
ALTER TABLE public.caronaa_order_passenger_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_order_passenger_cancellations FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.caronaa_capture_passenger_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $capture$
DECLARE v_service text; v_request uuid; v_passenger uuid;
BEGIN
 IF upper(NEW.status) NOT IN ('CANCELLED','CANCELED')
    OR upper(OLD.status) IN ('CANCELLED','CANCELED') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='professional_quick_rides' THEN
  v_service:='flash'; v_request:=NEW.id; v_passenger:=NEW.passenger_id;
 ELSE
  v_service:='shared'; v_request:=NEW.request_id; v_passenger:=NEW.user_id;
 END IF;
 -- Never infer an actor from the request owner on an automated/admin update.
 IF auth.uid() IS DISTINCT FROM v_passenger OR v_passenger IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.caronaa_order_passenger_cancellations(service,request_id,passenger_id,previous_status)
 VALUES(v_service,v_request,v_passenger,OLD.status)
 ON CONFLICT(service,request_id) DO NOTHING;
 RETURN NEW;
END;
$capture$;
REVOKE ALL ON FUNCTION public.caronaa_capture_passenger_cancellation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER caronaa_capture_flash_passenger_cancel
 AFTER UPDATE OF status ON public.professional_quick_rides
 FOR EACH ROW EXECUTE FUNCTION public.caronaa_capture_passenger_cancellation();
CREATE TRIGGER caronaa_capture_shared_passenger_cancel
 AFTER UPDATE OF status ON public.ride_requests
 FOR EACH ROW EXECUTE FUNCTION public.caronaa_capture_passenger_cancellation();
-- Optional reason after a successful cancellation. No new cancellation permission.
-- Only the recorded actor may attach a reason, and only the first choice is stored.
CREATE OR REPLACE FUNCTION public.caronaa_record_passenger_cancel_reason(
 p_service text,p_request_id uuid,p_reason_code text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $reason$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_service IS NULL OR p_service NOT IN ('flash','shared') OR p_request_id IS NULL
   OR p_reason_code IS NULL OR p_reason_code NOT IN ('WAIT_TOO_LONG','CHANGED_PLANS','PRICE','FOUND_ALTERNATIVE','WRONG_ROUTE','TECHNICAL_PROBLEM','OTHER','PREFER_NOT_TO_SAY')
 THEN RAISE EXCEPTION 'Invalid cancellation reason' USING ERRCODE='22023'; END IF;
 UPDATE public.caronaa_order_passenger_cancellations
 SET reason_code=p_reason_code,reason_recorded_at=clock_timestamp()
 WHERE service=p_service AND request_id=p_request_id AND passenger_id=auth.uid()
   AND reason_code IS NULL;
 RETURN EXISTS(SELECT 1 FROM public.caronaa_order_passenger_cancellations
  WHERE service=p_service AND request_id=p_request_id AND passenger_id=auth.uid()
    AND reason_code=p_reason_code);
END;
$reason$;
REVOKE ALL ON FUNCTION public.caronaa_record_passenger_cancel_reason(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_record_passenger_cancel_reason(text,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
