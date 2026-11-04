DO $allow_launch_time$
DECLARE
  definition text;
  old_key text := $o$'institutionalEmailDomains') THEN RAISE EXCEPTION 'Campo de configuração não reconhecido'$o$;
  new_key text := $n$'institutionalEmailDomains','launchTime') THEN RAISE EXCEPTION 'Campo de configuração não reconhecido'$n$;
  loop_key text := 'FOR k IN SELECT jsonb_object_keys(p) LOOP';
  loop_new text := $l$IF p ? 'launchTime' AND jsonb_typeof(p->'launchTime') <> 'null'
      AND (jsonb_typeof(p->'launchTime') <> 'string' OR (p->>'launchTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    THEN RAISE EXCEPTION 'Horário de lançamento inválido'; END IF;
    FOR k IN SELECT jsonb_object_keys(p) LOOP$l$;
BEGIN
  SELECT pg_get_functiondef('public.validate_research_configuration(jsonb)'::regprocedure) INTO definition;
  IF strpos(definition, new_key) > 0 THEN RETURN; END IF;
  IF strpos(definition, old_key) = 0 OR strpos(definition, loop_key) = 0 THEN
    RAISE EXCEPTION 'Unexpected configuration validator revision';
  END IF;
  definition := replace(definition, old_key, new_key);
  definition := replace(definition, loop_key, loop_new);
  EXECUTE definition;
END $allow_launch_time$;