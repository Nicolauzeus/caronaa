-- 0132 | Append-only audit for manual driver-to-platform settlement decisions.
-- Keeps previous claim references on rejected claims for later reconciliation.
BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_platform_fee_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.driver_platform_fees(ride_id) ON DELETE RESTRICT,
  actor_id uuid,
  event_type text NOT NULL CHECK(event_type IN ('CREATED','CLAIMED','SETTLED','REJECTED','UPDATED')),
  old_status text,
  new_status text NOT NULL,
  old_reference text,
  new_reference text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS driver_platform_fee_events_ride_idx
  ON public.driver_platform_fee_events(ride_id,occurred_at DESC);
ALTER TABLE public.driver_platform_fee_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_platform_fee_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.audit_driver_platform_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $audit$
DECLARE v_old text; v_ref text; v_action text;
BEGIN
  IF TG_OP='INSERT' THEN
    v_action:='CREATED';
  ELSE
    v_old:=OLD.status;
    v_ref:=OLD.claim_reference;
    IF OLD.status IS NOT DISTINCT FROM NEW.status
      AND OLD.claim_reference IS NOT DISTINCT FROM NEW.claim_reference THEN
      RETURN NEW;
    END IF;
    v_action:=CASE
      WHEN OLD.status='CLAIMED' AND NEW.status='OPEN' THEN 'REJECTED'
      WHEN NEW.status='CLAIMED' THEN 'CLAIMED'
      WHEN NEW.status='SETTLED' THEN 'SETTLED'
      ELSE 'UPDATED'
    END;
  END IF;
  INSERT INTO public.driver_platform_fee_events(
    ride_id,actor_id,event_type,old_status,new_status,old_reference,new_reference
  ) VALUES (
    NEW.ride_id,auth.uid(),v_action,v_old,NEW.status,v_ref,NEW.claim_reference
  );
  RETURN NEW;
END $audit$;
REVOKE ALL ON FUNCTION public.audit_driver_platform_fee() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS driver_platform_fee_audit ON public.driver_platform_fees;
CREATE TRIGGER driver_platform_fee_audit AFTER INSERT OR UPDATE ON public.driver_platform_fees
FOR EACH ROW EXECUTE FUNCTION public.audit_driver_platform_fee();

CREATE OR REPLACE FUNCTION public.admin_driver_fee_audit(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $read$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance') THEN
    RAISE EXCEPTION 'Finance access required' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'eventType',event_type,'oldStatus',old_status,'newStatus',new_status,
      'oldReference',old_reference,'newReference',new_reference,
      'actorId',actor_id,'occurredAt',occurred_at
    ) ORDER BY occurred_at,id)
    FROM public.driver_platform_fee_events WHERE ride_id=p_ride_id
  ),'[]'::jsonb);
END $read$;
REVOKE ALL ON FUNCTION public.admin_driver_fee_audit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_driver_fee_audit(uuid) TO authenticated;

COMMENT ON TABLE public.driver_platform_fee_events IS
  'Append-only manual settlement audit, including driver claims, financial approval and rejection.';
NOTIFY pgrst,'reload schema';
COMMIT;
