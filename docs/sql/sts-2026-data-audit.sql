-- CARONAA / STS historical inventory - READ ONLY.
-- Results contain counts only, no personally identifiable data.
SELECT
 (SELECT count(*) FROM public.form_submissions) AS submissions,
 (SELECT count(*) FROM public.form_submissions WHERE research_form_id =
   (SELECT id FROM public.research_forms WHERE code='STS-2026')) AS sts_associated,
 (SELECT count(*) FROM public.form_submission_pain_points) AS pain_rows,
 (SELECT count(DISTINCT submission_id) FROM public.form_submission_pain_points WHERE selecionada) AS respondents_with_selected_pains,
 (SELECT count(*) FROM public.form_starts) AS start_events;

-- Compare canonical pain table with STS raw JSON signals without modifying records.
SELECT
 count(*) AS total_responses,
 count(*) FILTER (WHERE raw_payload ? 'painPoints') AS has_pain_points_field,
 count(*) FILTER (WHERE jsonb_typeof(raw_payload -> 'painPoints')='array') AS pain_points_as_array,
 count(*) FILTER (WHERE raw_payload ? 'mainPainPoint') AS has_main_pain_field,
 count(*) FILTER (WHERE raw_payload ? 'passengerDifficulties') AS has_passenger_difficulties_field,
 count(*) FILTER (WHERE raw_payload ? 'driverBarriers') AS has_driver_barriers_field
FROM public.form_submissions;

-- Identify without exposing individual responses whether a response has pain data in either storage.
SELECT
 count(*) FILTER (WHERE EXISTS (
   SELECT 1 FROM public.form_submission_pain_points p
   WHERE p.submission_id=s.submission_id AND p.selecionada
 )) AS with_canonical_pains,
 count(*) FILTER (WHERE jsonb_typeof(s.raw_payload->'painPoints')='array'
   AND jsonb_array_length(s.raw_payload->'painPoints')>0) AS with_raw_pain_arrays,
 count(*) FILTER (WHERE NOT EXISTS (
   SELECT 1 FROM public.form_submission_pain_points p WHERE p.submission_id=s.submission_id
 )) AS without_pain_rows
FROM public.form_submissions s;
