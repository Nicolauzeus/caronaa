-- 0110 | Independent research response window and optional CARONAA launch date.
-- Legacy surveys remain nullable and keep their existing availability.
-- New forms use the atomic, admin-scoped scheduled creation RPC.
ALTER TABLE public.research_forms
 ADD COLUMN IF NOT EXISTS survey_starts_on date,
 ADD COLUMN IF NOT EXISTS survey_ends_on date,
 ADD COLUMN IF NOT EXISTS caronaa_presence_on date;

ALTER TABLE public.research_forms
 DROP CONSTRAINT IF EXISTS research_survey_window_order;
ALTER TABLE public.research_forms
 ADD CONSTRAINT research_survey_window_order
 CHECK (
   (survey_starts_on IS NULL AND survey_ends_on IS NULL)
   OR (survey_starts_on IS NOT NULL AND survey_ends_on IS NOT NULL
       AND survey_ends_on >= survey_starts_on)
 );

COMMENT ON COLUMN public.research_forms.survey_starts_on IS
 'First local calendar day on which the research accepts submissions (America/Fortaleza).';
COMMENT ON COLUMN public.research_forms.caronaa_presence_on IS
 'Optional predicted CARONAA availability, distinct from research intake and not an access grant.';
COMMENT ON COLUMN public.research_forms.survey_ends_on IS
 'Last local calendar day on which the research accepts submissions, inclusive.';

CREATE OR REPLACE FUNCTION public.create_scheduled_research_form(
 p_metadata jsonb, p_schema jsonb, p_settings jsonb,
 p_starts_on date, p_ends_on date, p_caronaa_on date
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $scheduled$
DECLARE result_id uuid;
BEGIN
 IF p_starts_on IS NULL OR p_ends_on IS NULL
    OR p_ends_on < p_starts_on
 THEN
   RAISE EXCEPTION 'Informe datas de início e encerramento válidas para a pesquisa'
     USING ERRCODE='22023';
 END IF;
 -- Both legacy creator RPCs enforce the admin role and perform all inserts
 -- in this same transaction. A failure here rolls back the entire creation.
 IF p_settings IS NULL THEN
   result_id := public.create_research_form_draft(
     p_metadata->>'title', p_metadata->>'code',p_metadata->>'nature',
     p_metadata->>'audience',p_metadata->>'municipality',p_schema);
 ELSE
   result_id := public.create_configured_research_form(
     p_metadata,p_schema,p_settings);
 END IF;
 UPDATE public.research_forms
    SET survey_starts_on=p_starts_on,survey_ends_on=p_ends_on,
        caronaa_presence_on=p_caronaa_on
  WHERE id=result_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'A pesquisa não foi criada'; END IF;
 RETURN result_id;
END $scheduled$;

REVOKE ALL ON FUNCTION public.create_scheduled_research_form(
 jsonb,jsonb,jsonb,date,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_scheduled_research_form(
 jsonb,jsonb,jsonb,date,date,date) TO authenticated;

-- Enforce actual intake dates on both configured and ordinary questionnaires.
-- No effect on already stored answers or existing undated legacy surveys.
CREATE OR REPLACE FUNCTION public.enforce_research_answer_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $window$
DECLARE started date; finished date;
  local_today date := (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 SELECT f.survey_starts_on,f.survey_ends_on INTO started,finished
 FROM public.research_forms f WHERE f.id=NEW.form_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Pesquisa não encontrada' USING ERRCODE='23503';
 END IF;
 IF started IS NOT NULL AND local_today < started THEN
   RAISE EXCEPTION 'Esta pesquisa ainda não começou. Consulte a data de abertura.'
     USING ERRCODE='22023';
 END IF;
 IF finished IS NOT NULL AND local_today > finished THEN
   RAISE EXCEPTION 'O período de respostas desta pesquisa foi encerrado.'
     USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $window$;
REVOKE ALL ON FUNCTION public.enforce_research_answer_window()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS research_answer_window_guard ON public.research_answers;
CREATE TRIGGER research_answer_window_guard
 BEFORE INSERT ON public.research_answers
 FOR EACH ROW EXECUTE FUNCTION public.enforce_research_answer_window();

-- Explicit server-side check available to the public client, without PII.
CREATE OR REPLACE FUNCTION public.get_research_window_state(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $window_state$
 SELECT jsonb_build_object(
   'startsOn',f.survey_starts_on,
   'endsOn',f.survey_ends_on,
   'caronaaPresenceOn',f.caronaa_presence_on,
   'state',CASE
     WHEN f.survey_starts_on IS NOT NULL AND
       (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date < f.survey_starts_on
       THEN 'AGENDADO'
     WHEN f.survey_ends_on IS NOT NULL AND
       (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date > f.survey_ends_on
       THEN 'ENCERRADO'
     ELSE 'ABERTO' END
 ) FROM public.research_forms f
 WHERE f.code=upper(btrim(p_code))
   AND f.status='PUBLICADO' AND f.is_enabled AND f.trashed_at IS NULL
 LIMIT 1;
$window_state$;
REVOKE ALL ON FUNCTION public.get_research_window_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_research_window_state(text)
 TO anon,authenticated;
NOTIFY pgrst,'reload schema';
