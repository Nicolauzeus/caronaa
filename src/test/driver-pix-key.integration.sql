-- Run against a migrated, disposable test database. The fixture rolls back.
BEGIN;
WITH fixture AS (
  INSERT INTO auth.users(id, email)
  VALUES (gen_random_uuid(), gen_random_uuid()::text || '@example.test')
  RETURNING id
)
SELECT set_config('request.jwt.claim.sub', id::text, true) FROM fixture;
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  sample record;
BEGIN
  FOR sample IN SELECT * FROM (VALUES
    (' Pix@Example.TEST ', 'pix@example.test'),
    ('(85) 99999-0101', '+5585999990101'),
    ('+55 (55) 99999-0101', '+5555999990101'),
    ('+244 900 000 001', '+244900000001'),
    ('+1 (202) 555-0100', '+12025550100'),
    ('5585999990101', '+5585999990101'),
    ('123.456.789-01', '12345678901'),
    ('12345678901', '12345678901'),
    ('12.345.678/0001-90', '12345678000190'),
    ('a1.b2c.3d4/e5f6-78', 'A1B2C3D4E5F678'),
    ('123E4567-E89B-12D3-A456-426655440000', '123e4567-e89b-12d3-a456-426655440000')
  ) AS samples(input, normalized)
  LOOP
    PERFORM public.save_my_pix_key(sample.input);
    IF public.get_my_pix_key() IS DISTINCT FROM sample.normalized THEN
      RAISE EXCEPTION 'Normalization mismatch';
    END IF;
  END LOOP;

  PERFORM public.save_my_pix_key('preserve@example.test');
  FOR sample IN SELECT * FROM (VALUES (''), ('+05585999990101'), ('me@-example.com'), ('á@example.com')) AS bad(input)
  LOOP
    BEGIN
      PERFORM public.save_my_pix_key(sample.input);
      RAISE EXCEPTION 'Invalid key was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    IF public.get_my_pix_key() IS DISTINCT FROM 'preserve@example.test' THEN
      RAISE EXCEPTION 'Previous key was overwritten';
    END IF;
  END LOOP;
END;
$test$;

ROLLBACK;
