-- CARONAA F07 | 0155: idempotent bilateral ratings.
-- Apply AFTER 0151. No user data is deleted. Existing reviews remain intact.
-- Authenticated participants may retry or correct their own review only after completion.
BEGIN;

CREATE OR REPLACE FUNCTION public.quick_ride_rate(
  p_id uuid,
  p_score integer,
  p_comment text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  other_user uuid;
BEGIN
  SELECT * INTO q
  FROM public.professional_quick_rides
  WHERE id = p_id
  FOR UPDATE;

  IF auth.uid() IS NULL OR NOT FOUND
     OR q.status <> 'COMPLETED'
     OR auth.uid() NOT IN (q.driver_id, q.passenger_id) THEN
    RAISE EXCEPTION 'Completed participant ride required'
      USING ERRCODE = '42501';
  END IF;

  IF p_score IS NULL OR p_score NOT BETWEEN 1 AND 5
     OR char_length(coalesce(p_comment, '')) > 1000 THEN
    RAISE EXCEPTION 'Invalid rating' USING ERRCODE = '22023';
  END IF;

  other_user := CASE
    WHEN auth.uid() = q.driver_id THEN q.passenger_id
    ELSE q.driver_id
  END;

  INSERT INTO public.quick_ride_ratings
    (ride_id, reviewer_user_id, rated_user_id, score, comment)
  VALUES
    (p_id, auth.uid(), other_user, p_score, btrim(coalesce(p_comment, '')))
  ON CONFLICT (ride_id, reviewer_user_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    comment = EXCLUDED.comment
  WHERE public.quick_ride_ratings.rated_user_id = EXCLUDED.rated_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_ride_rate(uuid,integer,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_rate(uuid,integer,text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Postflight check: verifies signature, function privileges and table RLS.
SELECT
  to_regprocedure('public.quick_ride_rate(uuid,integer,text)') IS NOT NULL
    AS funcao_existe,
  has_function_privilege(
    'authenticated',
    'public.quick_ride_rate(uuid,integer,text)',
    'EXECUTE'
  ) AS authenticated_pode_executar,
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.quick_ride_ratings'::regclass) AS rls_ativo;
