DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.get_admin_operation_data()'::regprocedure) INTO definition;
 IF position('''raw_payload'', f.raw_payload' IN definition) = 0 THEN
  IF position('''driverPrice'', f.raw_payload->>''driverPrice''' IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected admin function definition'; END IF;
  definition := replace(definition, '''driverPrice'', f.raw_payload->>''driverPrice''', '''driverPrice'', f.raw_payload->>''driverPrice'', ''raw_payload'', f.raw_payload, ''consentimento'', f.consentimento');
  EXECUTE definition;
 END IF;
END;
$migration$;
REVOKE ALL ON FUNCTION public.get_admin_operation_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operation_data() TO authenticated;
NOTIFY pgrst, 'reload schema';