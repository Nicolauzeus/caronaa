-- 0156: audited manual resolution for contested F07 dropoffs.
-- Never finalize a contest using the automatic timeout path.
BEGIN;

ALTER TABLE public.quick_ride_dropoff_reviews
 ADD COLUMN IF NOT EXISTS admin_decision text,
 ADD COLUMN IF NOT EXISTS admin_resolved_at timestamptz,
 ADD COLUMN IF NOT EXISTS admin_resolved_by uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS admin_reason text;
ALTER TABLE public.quick_ride_dropoff_reviews
 DROP CONSTRAINT IF EXISTS quick_dropoff_admin_decision_check;
ALTER TABLE public.quick_ride_dropoff_reviews
 ADD CONSTRAINT quick_dropoff_admin_decision_check
 CHECK (admin_decision IS NULL OR admin_decision IN ('COMPLETE','CANCEL'));

CREATE TABLE IF NOT EXISTS public.quick_ride_dispute_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL CHECK (action IN ('COMPLETE','CANCEL')),
 previous_ride_status text NOT NULL,
 new_ride_status text NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 20 AND 2000),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quick_ride_dispute_one_decision
 ON public.quick_ride_dispute_audit(ride_id);
CREATE INDEX IF NOT EXISTS quick_ride_dispute_audit_date
 ON public.quick_ride_dispute_audit(occurred_at DESC);
ALTER TABLE public.quick_ride_dispute_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_dispute_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.quick_ride_dropoff_reviews FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_quick_ride_disputes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
   'ride_id',q.id,'municipality',q.municipality,'vehicle_type',q.vehicle_type,
   'status',q.status,'requested_at',d.requested_at,
   'passenger_name',coalesce(pp.full_name,'Passageiro'),
   'driver_name',coalesce(dp.full_name,'Motorista'),
   'origin_label',q.origin_label,'destination_label',q.destination_label,
   'passenger_response',d.passenger_response,
   'admin_decision',d.admin_decision,'admin_reason',d.admin_reason,
   'admin_resolved_at',d.admin_resolved_at,
   'admin_resolved_by',d.admin_resolved_by,
   'audit_at',a.occurred_at
  ) ORDER BY d.requested_at DESC)
  FROM public.quick_ride_dropoff_reviews d
  JOIN public.professional_quick_rides q ON q.id=d.ride_id
  LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
  LEFT JOIN public.profiles dp ON dp.id=q.driver_id
  LEFT JOIN public.quick_ride_dispute_audit a ON a.ride_id=q.id
  WHERE d.passenger_response='CONTESTED'
 ),'[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_resolve_quick_ride_dispute(
 p_ride_id uuid,p_decision text,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE;
 d public.quick_ride_dropoff_reviews%ROWTYPE;
 v_new_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('COMPLETE','CANCEL')
    OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 2000 THEN
  RAISE EXCEPTION 'Decisao ou justificativa invalida (20 a 2000 caracteres)'
   USING ERRCODE='22023';
 END IF;
 -- Lock ride then review in the same order used by participant RPCs.
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_ride_id FOR UPDATE;
 IF NOT FOUND OR q.status<>'IN_PROGRESS' THEN
  RAISE EXCEPTION 'Corrida nao esta em andamento' USING ERRCODE='23514';
 END IF;
 SELECT * INTO d FROM public.quick_ride_dropoff_reviews
 WHERE ride_id=p_ride_id FOR UPDATE;
 IF NOT FOUND OR d.passenger_response IS DISTINCT FROM 'CONTESTED'
   OR d.admin_decision IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.quick_ride_dispute_audit WHERE ride_id=p_ride_id) THEN
  RAISE EXCEPTION 'Contestacao inexistente ou ja decidida' USING ERRCODE='23514';
 END IF;
 v_new_status:=CASE p_decision WHEN 'COMPLETE' THEN 'COMPLETED' ELSE 'CANCELLED' END;
 UPDATE public.professional_quick_rides
 SET status=v_new_status,
     completed_at=CASE WHEN p_decision='COMPLETE' THEN now() ELSE NULL END,
     updated_at=now()
 WHERE id=p_ride_id;
 UPDATE public.quick_ride_dropoff_reviews
 SET admin_decision=p_decision,admin_reason=btrim(p_reason),
     admin_resolved_by=auth.uid(),admin_resolved_at=now(),updated_at=now()
 WHERE ride_id=p_ride_id;
 INSERT INTO public.quick_ride_dispute_audit
  (ride_id,actor_id,action,previous_ride_status,new_ride_status,reason)
 VALUES(p_ride_id,auth.uid(),p_decision,q.status,v_new_status,btrim(p_reason));
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_quick_ride_disputes(),
 public.admin_resolve_quick_ride_dispute(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_quick_ride_disputes(),
 public.admin_resolve_quick_ride_dispute(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
