-- This deferred constraint is evaluated at the transaction boundary, after the
-- RPC has inserted every pain row. Raising here aborts the complete RPC call,
-- including the previously inserted form_submissions row.
CREATE OR REPLACE FUNCTION public.enforce_form_submission_pain_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_submission_id uuid;
  v_selected_count integer;
  v_principal_count integer;
  v_invalid_intensity_count integer;
BEGIN
  v_submission_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.submission_id ELSE NEW.submission_id END;

  SELECT
    count(*) FILTER (WHERE selecionada),
    count(*) FILTER (WHERE principal),
    count(*) FILTER (WHERE principal AND (intensidade IS NULL OR intensidade NOT BETWEEN 1 AND 5))
  INTO v_selected_count, v_principal_count, v_invalid_intensity_count
  FROM public.form_submission_pain_points
  WHERE submission_id = v_submission_id;

  IF (v_selected_count = 0 AND v_principal_count <> 0)
     OR (v_selected_count > 0 AND v_principal_count <> 1)
     OR v_invalid_intensity_count <> 0 THEN
    RAISE EXCEPTION 'Selected pains require exactly one principal pain with intensity from 1 to 5'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS form_submission_pain_integrity_trigger ON public.form_submission_pain_points;
CREATE CONSTRAINT TRIGGER form_submission_pain_integrity_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.form_submission_pain_points
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_form_submission_pain_integrity();
