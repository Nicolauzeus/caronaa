-- 0101 — UNIFOR pilot prelaunch (4 November 2026, 00:00 America/Fortaleza)
-- The verified research participation badge identifies participation in this specific
-- pilot. It does NOT prove university enrollment or institutional endorsement.
-- No live rides, bookings or matches are generated from research data.

CREATE TABLE IF NOT EXISTS public.unifor_prelaunch_intents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.research_forms(id),
  answer_id uuid NOT NULL REFERENCES public.research_answers(id),
  intent_kind text NOT NULL CHECK (intent_kind IN ('PEDIDO','OFERTA','AMBOS')),
  scheduled_date date NOT NULL DEFAULT DATE '2026-11-04'
    CHECK (scheduled_date=DATE '2026-11-04'),
  origin_area text,
  destination_area text,
  departure_time text,
  status text NOT NULL DEFAULT 'VISUALIZACAO' CHECK (status='VISUALIZACAO'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unifor_prelaunch_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.unifor_prelaunch_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.unifor_prelaunch_intents TO authenticated;
DROP POLICY IF EXISTS unifor_prelaunch_read_self ON public.unifor_prelaunch_intents;
CREATE POLICY unifor_prelaunch_read_self ON public.unifor_prelaunch_intents
  FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_unifor_prelaunch_intent(
  p_user uuid,p_answer uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $unifor$
DECLARE j jsonb; r text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.research_participation_badges b
    WHERE b.user_id=p_user AND b.answer_id=p_answer
      AND b.form_id='8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid
  ) THEN RETURN; END IF;
  SELECT journey INTO j FROM public.research_journeys WHERE answer_id=p_answer ORDER BY created_at DESC LIMIT 1;
  IF j IS NULL THEN RETURN; END IF;
  r:=j->>'profile';
  IF r NOT IN ('PASSAGEIRO','MOTORISTA','AMBOS') THEN RETURN; END IF;
  INSERT INTO public.unifor_prelaunch_intents(
    user_id,form_id,answer_id,intent_kind,origin_area,destination_area,departure_time
  ) VALUES(
    p_user,'8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid,p_answer,
    CASE r WHEN 'PASSAGEIRO' THEN 'PEDIDO' WHEN 'MOTORISTA' THEN 'OFERTA' ELSE 'AMBOS' END,
    left(nullif(j->>'originArea',''),160),left(nullif(j->>'destinationArea',''),160),
    left(nullif(j->>'outboundTime',''),8)
  )
  ON CONFLICT(user_id) DO NOTHING;
END $unifor$;
REVOKE ALL ON FUNCTION public.upsert_unifor_prelaunch_intent(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.unifor_prelaunch_badge_to_intent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $unifor$
BEGIN
  IF NEW.form_id='8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid THEN
    PERFORM public.upsert_unifor_prelaunch_intent(NEW.user_id,NEW.answer_id);
  END IF;
  RETURN NEW;
END $unifor$;
DROP TRIGGER IF EXISTS trg_unifor_prelaunch_badge ON public.research_participation_badges;
CREATE TRIGGER trg_unifor_prelaunch_badge AFTER INSERT ON public.research_participation_badges
FOR EACH ROW EXECUTE FUNCTION public.unifor_prelaunch_badge_to_intent();

-- Backfill only genuinely linked research participation; do not synthesize
-- requests/offers or infer enrollment from a school name entered by the user.
DO $backfill$
DECLARE b record;
BEGIN
 FOR b IN SELECT user_id,answer_id FROM public.research_participation_badges
 WHERE form_id='8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid
 ORDER BY verified_at DESC LOOP
   PERFORM public.upsert_unifor_prelaunch_intent(b.user_id,b.answer_id);
 END LOOP;
END $backfill$;

CREATE OR REPLACE FUNCTION public.is_unifor_prelaunch_locked(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $unifor$
 SELECT p_user_id IS NOT NULL AND now()<timestamptz '2026-11-04 00:00:00-03'
 AND EXISTS (
  SELECT 1 FROM public.research_participation_badges
  WHERE user_id=p_user_id AND form_id='8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid
 )
 AND NOT EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id=p_user_id AND role='admin');
$unifor$;
REVOKE ALL ON FUNCTION public.is_unifor_prelaunch_locked(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_my_unifor_launch_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $unifor$
DECLARE locked boolean; preview jsonb;
BEGIN
 locked:=public.is_unifor_prelaunch_locked(auth.uid());
 IF locked THEN
   SELECT jsonb_build_object(
      'kind',intent_kind,'scheduledDate',scheduled_date,
      'origin',origin_area,'destination',destination_area,
      'departureTime',departure_time,'status',status
   ) INTO preview
   FROM public.unifor_prelaunch_intents WHERE user_id=auth.uid();
 END IF;
 RETURN jsonb_build_object(
  'locked',coalesce(locked,false),
  'launchAt','2026-11-04T00:00:00-03:00',
  'preview',coalesce(preview,'null'::jsonb)
 );
END $unifor$;
REVOKE ALL ON FUNCTION public.get_my_unifor_launch_state() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_unifor_launch_state() TO authenticated;

-- Mandatory database guard, independent from disabled UI controls.
-- Blocks a linked participant from creating or changing any live ride state
-- before launch, including calls through SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.guard_unifor_prelaunch_ride_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $unifor$
BEGIN
 IF public.is_unifor_prelaunch_locked(auth.uid()) THEN
   RAISE EXCEPTION 'UNIFOR_PRELAUNCH_LOCKED: pedidos, ofertas e reservas ficam disponíveis em 04/11/2026'
     USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $unifor$;

DO $triggers$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['ride_requests','ride_offers','ride_routines','ride_matches','rides'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS trg_unifor_prelaunch_guard ON public.%I',tab);
  EXECUTE format(
    'CREATE TRIGGER trg_unifor_prelaunch_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_unifor_prelaunch_ride_write()',tab);
 END LOOP;
END $triggers$;

-- Launch communication only; does not assert a formal university partnership.
UPDATE public.research_configurations
SET settings=jsonb_set(settings,'{launchDate}','"2026-11-04"'::jsonb,true),
    revision=revision+1,updated_at=now()
WHERE form_id='8eaec446-057b-430a-9ccf-3b3652cb9618'::uuid
AND settings->>'launchDate' IS DISTINCT FROM '2026-11-04';

NOTIFY pgrst,'reload schema';
