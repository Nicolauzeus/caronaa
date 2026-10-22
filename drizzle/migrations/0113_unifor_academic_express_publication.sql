-- 0113 | UNIFOR: publish a new, shorter university survey version, preserve v1/v2 and all answers.
-- This is a deliberate product release: new responders see v3; historical BI retains each version.
-- Safe to retry; fails if the published version changed unexpectedly.
-- Allow an institution to configure domain hints. This only affects UI hints,
-- never identity verification, access authorization or the corporate gate.
DO $academic_domain_config$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.validate_research_configuration(jsonb)'::regprocedure)
 INTO definition;
 IF definition IS NULL THEN RAISE EXCEPTION 'Configuration validator missing'; END IF;
 IF strpos(definition, '''institutionalEmailDomains''')=0 THEN
   IF strpos(definition, '''emailCaptureEnabled'')')=0
      OR strpos(definition, 'FOR k IN SELECT jsonb_object_keys(p) LOOP')=0 THEN
     RAISE EXCEPTION 'Unexpected configuration validator revision';
   END IF;
   definition:=replace(definition,'''emailCaptureEnabled'')','''emailCaptureEnabled'',''institutionalEmailDomains'')');
   definition:=replace(definition,
     'FOR k IN SELECT jsonb_object_keys(p) LOOP',
     $checks$IF p ? 'institutionalEmailDomains' THEN
       IF jsonb_typeof(p->'institutionalEmailDomains') IS DISTINCT FROM 'array'
         OR jsonb_array_length(p->'institutionalEmailDomains')>8
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(p->'institutionalEmailDomains') d(domain)
           WHERE domain.domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+
DECLARE target_form_id uuid; latest_version integer; previous_schema jsonb;
BEGIN
 SELECT id INTO target_form_id FROM public.research_forms WHERE code='0K9K09K'
   AND status='PUBLICADO' AND is_enabled=true
 FOR UPDATE;
 IF target_form_id IS NULL THEN
   RAISE EXCEPTION 'Published UNIFOR survey 0K9K09K not found';
 END IF;
 SELECT version_number,schema_json INTO latest_version,previous_schema
   FROM public.research_form_versions WHERE form_id=target_form_id
   AND published_at IS NOT NULL ORDER BY version_number DESC LIMIT 1;
 IF previous_schema->>'experience'='ACADEMIC_EXPRESS_V1' THEN RETURN; END IF;
 IF latest_version IS DISTINCT FROM 2 THEN
   RAISE EXCEPTION 'Unexpected UNIFOR version %, expected v2 before express migration',latest_version;
 END IF;
 IF EXISTS (SELECT 1 FROM public.research_form_versions
   WHERE form_id = target_form_id AND published_at IS NULL) THEN
   RAISE EXCEPTION 'Unpublished UNIFOR draft exists; resolve before changing the live version';
 END IF;
 INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
 VALUES(target_form_id,latest_version+1,$academic${"experience":"ACADEMIC_EXPRESS_V1","sections":[{"id":"academic_identity","title":"Sua comunidade","questions":[{"id":"academic_full_name","label":"Como podemos chamar você?","type":"short_text","required":true,"options":[],"semanticCode":"ACADEMIC_PARTICIPANT_NAME","minLength":2,"maxLength":80},{"id":"academic_affiliation","label":"Qual é seu vínculo com a universidade?","type":"single_choice","required":true,"options":["ESTUDANTE","ESTUDANTE_TRABALHADOR","PROFESSOR","COLABORADOR","TERCEIRIZADO","OUTRO"],"semanticCode":"ACADEMIC_ROLE"},{"id":"research_participant_role","label":"Como pretende participar?","type":"single_choice","required":true,"options":["PASSAGEIRO","MOTORISTA","AMBOS"],"semanticCode":"RESEARCH_PARTICIPANT_ROLE"}]},{"id":"academic_passenger","title":"Sua experiência como passageiro","questions":[{"id":"academic_transport","label":"Como você costuma se deslocar?","type":"multiple_choice","required":true,"options":["ONIBUS","APLICATIVO","CARONA","CARRO","MOTO","BICICLETA","A_PE","OUTRO"],"semanticCode":"TRANSPORT_MODE","minValue":1,"maxValue":1,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_current_cost","label":"Quanto gasta hoje, por trecho? (R$)","type":"number","required":false,"options":[],"semanticCode":"COST_PER_TRIP","minValue":0,"maxValue":10000,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_passenger_priority","label":"O que é indispensável para pegar uma carona?","type":"single_choice","required":true,"options":["PREFERENCIA_MULHERES","PONTO_NO_CAMPUS","PERFIL_VERIFICADO","ECONOMIA"],"semanticCode":"ACADEMIC_PASSENGER_PRIORITY","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}}]},{"id":"academic_driver","title":"Sua disponibilidade como motorista","questions":[{"id":"academic_vehicle","label":"Qual veículo usaria para oferecer carona?","type":"single_choice","required":true,"options":["CARRO","MOTO"],"semanticCode":"URBAN_OFFER_VEHICLE","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_seats","label":"Quantas vagas livres para passageiros?","type":"number","required":true,"options":[],"semanticCode":"SEATS_AVAILABLE","minValue":1,"maxValue":7,"integerOnly":true,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_driver_priority","label":"O que lhe daria mais tranquilidade ao dirigir?","type":"single_choice","required":true,"options":["SEM_DESVIOS","PAGAMENTO_VERIFICADO","MESMA_UNIVERSIDADE"],"semanticCode":"ACADEMIC_DRIVER_PRIORITY","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}}]}]}$academic$::jsonb,now());
END $academic_release$;
NOTIFY pgrst,'reload schema';

         )
       THEN RAISE EXCEPTION 'Domínios institucionais inválidos'; END IF;
     END IF;
     FOR k IN SELECT jsonb_object_keys(p) LOOP$checks$);
   EXECUTE definition;
 END IF;
END $academic_domain_config$;

DO $academic_release$
DECLARE target_form_id uuid; latest_version integer; previous_schema jsonb;
BEGIN
 SELECT id INTO target_form_id FROM public.research_forms WHERE code='0K9K09K'
   AND status='PUBLICADO' AND is_enabled=true
 FOR UPDATE;
 IF target_form_id IS NULL THEN
   RAISE EXCEPTION 'Published UNIFOR survey 0K9K09K not found';
 END IF;
 SELECT version_number,schema_json INTO latest_version,previous_schema
   FROM public.research_form_versions WHERE form_id=target_form_id
   AND published_at IS NOT NULL ORDER BY version_number DESC LIMIT 1;
 IF previous_schema->>'experience'='ACADEMIC_EXPRESS_V1' THEN RETURN; END IF;
 IF latest_version IS DISTINCT FROM 2 THEN
   RAISE EXCEPTION 'Unexpected UNIFOR version %, expected v2 before express migration',latest_version;
 END IF;
 IF EXISTS (SELECT 1 FROM public.research_form_versions
   WHERE form_id = target_form_id AND published_at IS NULL) THEN
   RAISE EXCEPTION 'Unpublished UNIFOR draft exists; resolve before changing the live version';
 END IF;
 INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
 VALUES(target_form_id,latest_version+1,$academic${"experience":"ACADEMIC_EXPRESS_V1","sections":[{"id":"academic_identity","title":"Sua comunidade","questions":[{"id":"academic_full_name","label":"Como podemos chamar você?","type":"short_text","required":true,"options":[],"semanticCode":"ACADEMIC_PARTICIPANT_NAME","minLength":2,"maxLength":80},{"id":"academic_affiliation","label":"Qual é seu vínculo com a universidade?","type":"single_choice","required":true,"options":["ESTUDANTE","ESTUDANTE_TRABALHADOR","PROFESSOR","COLABORADOR","TERCEIRIZADO","OUTRO"],"semanticCode":"ACADEMIC_ROLE"},{"id":"research_participant_role","label":"Como pretende participar?","type":"single_choice","required":true,"options":["PASSAGEIRO","MOTORISTA","AMBOS"],"semanticCode":"RESEARCH_PARTICIPANT_ROLE"}]},{"id":"academic_passenger","title":"Sua experiência como passageiro","questions":[{"id":"academic_transport","label":"Como você costuma se deslocar?","type":"multiple_choice","required":true,"options":["ONIBUS","APLICATIVO","CARONA","CARRO","MOTO","BICICLETA","A_PE","OUTRO"],"semanticCode":"TRANSPORT_MODE","minValue":1,"maxValue":1,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_current_cost","label":"Quanto gasta hoje, por trecho? (R$)","type":"number","required":false,"options":[],"semanticCode":"COST_PER_TRIP","minValue":0,"maxValue":10000,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_passenger_priority","label":"O que é indispensável para pegar uma carona?","type":"single_choice","required":true,"options":["PREFERENCIA_MULHERES","PONTO_NO_CAMPUS","PERFIL_VERIFICADO","ECONOMIA"],"semanticCode":"ACADEMIC_PASSENGER_PRIORITY","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"PASSAGEIRO"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}}]},{"id":"academic_driver","title":"Sua disponibilidade como motorista","questions":[{"id":"academic_vehicle","label":"Qual veículo usaria para oferecer carona?","type":"single_choice","required":true,"options":["CARRO","MOTO"],"semanticCode":"URBAN_OFFER_VEHICLE","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_seats","label":"Quantas vagas livres para passageiros?","type":"number","required":true,"options":[],"semanticCode":"SEATS_AVAILABLE","minValue":1,"maxValue":7,"integerOnly":true,"condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}},{"id":"academic_driver_priority","label":"O que lhe daria mais tranquilidade ao dirigir?","type":"single_choice","required":true,"options":["SEM_DESVIOS","PAGAMENTO_VERIFICADO","MESMA_UNIVERSIDADE"],"semanticCode":"ACADEMIC_DRIVER_PRIORITY","condition":{"op":"ANY","rules":[{"questionId":"research_participant_role","comparison":"EQ","value":"MOTORISTA"},{"questionId":"research_participant_role","comparison":"EQ","value":"AMBOS"}]}}]}]}$academic$::jsonb,now());
END $academic_release$;
NOTIFY pgrst,'reload schema';
