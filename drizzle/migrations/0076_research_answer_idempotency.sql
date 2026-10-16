-- Idempotent public submissions. Existing historical STS responses remain untouched.
ALTER TABLE public.research_answers ADD COLUMN IF NOT EXISTS client_submission_key uuid DEFAULT gen_random_uuid();
UPDATE public.research_answers SET client_submission_key=gen_random_uuid() WHERE client_submission_key IS NULL;
ALTER TABLE public.research_answers ALTER COLUMN client_submission_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS research_answers_idempotency_unique
ON public.research_answers(form_id,client_submission_key);
