-- Run exclusively through scripts/test-research-infrastructure.mjs (ephemeral cluster).
CREATE FUNCTION pg_temp.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.assert_fails(command text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 PERFORM pg_temp.assert_true(rejected,label); END $$;
CREATE TEMP TABLE fixture(id uuid,version uuid,config jsonb,schema_json jsonb,journey jsonb);
INSERT INTO fixture(config,schema_json,journey) VALUES(
'{"schemaVersion":1,"templateKey":"TEST","institutionId":"INST_TEST","institutionName":"Instituição de teste","publicName":"Pesquisa de teste","campus":"Unidade A","region":"Fortaleza","address":"Local institucional","latitude":-3.73,"longitude":-38.52,"campaignName":"Teste","campaignType":"INSTITUCIONAL","acquisitionSource":"QR_TEST","launchDate":"2027-01-10","timezone":"America/Fortaleza","serviceState":"PLANEJADO","days":[1,2],"outboundTimes":["07:00"],"returnTimes":["18:00"],"flexibilityMinutes":15,"profiles":["PASSAGEIRO","MOTORISTA","AMBOS"],"modes":["CARONA"],"usagePolicy":"Pesquisa sem contratação automática.","priceReference":"","institutionalContact":"admin-private@example.test","partnershipDescription":"","partnershipConfirmed":false,"safeMeetingPoints":[],"profileSchedules":[]}',
'{"sections":[{"id":"s1","title":"Teste","questions":[{"id":"intent","label":"Tem interesse na solução?","type":"single_choice","required":true,"options":["SIM","NAO"],"semanticCode":"ADOPTION_INTENT"},{"id":"pay","label":"Você pagaria por trecho?","type":"yes_no","required":true,"options":[],"semanticCode":"WILLINGNESS_TO_PAY","showWhen":{"questionId":"intent","equals":"SIM"}},{"id":"email","label":"Contato opcional","type":"contact","required":false,"options":[]},{"id":"location","label":"Local aproximado","type":"location","required":false,"options":[]}]}]}',
'{"profile":"AMBOS","mode":"CARONA","direction":"IDA_E_VOLTA","days":[1],"outboundTime":"07:00","returnTime":"18:00","otherOutboundTime":false,"otherReturnTime":false,"flexibilityMinutes":10,"originArea":"Aldeota","originLat":-3.7324567,"originLng":-38.5212345,"destinationArea":"Unidade A","destinationLat":-3.74,"destinationLng":-38.53,"marketingConsent":false,"partnerSharingConsent":false}'
);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Execute RPCs as an actual authenticated role, not only a superuser.
GRANT SELECT,UPDATE ON fixture TO authenticated,anon;
SET ROLE authenticated;
UPDATE fixture SET id=public.create_configured_research_form('{"title":"Pesquisa teste","code":"INFRA-TEST","nature":"EDUCACAO","audience":"GERAL","municipality":"Fortaleza"}',schema_json,config);
UPDATE fixture SET version=(SELECT v.id FROM public.research_form_versions v WHERE v.form_id=fixture.id LIMIT 1);
SELECT pg_temp.assert_true((SELECT public.publish_research_form(id,version,schema_json) FROM fixture),'atomic publication');
WITH changed AS (UPDATE public.research_form_versions SET schema_json='{}' WHERE published_at IS NOT NULL RETURNING id)
 SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=0,'published versions hidden from draft updates');
SELECT pg_temp.assert_true((SELECT public.get_public_research_configuration('INFRA-TEST')#>>'{settings,institutionalContact}') IS NULL,'public configuration hides institutional contact');
SELECT pg_temp.assert_fails(format('SELECT public.save_research_configuration(%L,%L,0)',id,config),'stale revision rejected') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.save_research_configuration(%L,%L,1)',id,config||'{"outboundTimes":["27:00"]}'),'invalid institutional time rejected') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.create_configured_research_form(%L,%L,%L)','{"title":"Inválida","code":"BADCONFIG","nature":"EDUCACAO","audience":"GERAL","municipality":"Fortaleza"}',schema_json,config||'{"launchDate":"2027-02-31"}'),'invalid configuration rolls back draft creation') FROM fixture;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.research_forms WHERE code='BADCONFIG'),'no orphan draft after configuration failure');
SELECT pg_temp.assert_fails(format('SELECT public.save_research_configuration(%L,%L,1)',id,config||'{"profileSchedules":[{"profile":"PASSAGEIRO","days":[1],"outboundTimes":["33:00"],"returnTimes":[],"flexibilityMinutes":0}]}'),'invalid per-profile schedule rejected') FROM fixture;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SELECT pg_temp.assert_fails(format('SELECT public.save_research_configuration(%L,%L,1)',id,config),'non-admin configuration denied') FROM fixture;
SELECT pg_temp.assert_fails('SELECT * FROM public.get_configured_research_summary()','non-admin analytics denied');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_configurations)=0,'RLS hides private configuration from non-admin');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
SELECT pg_temp.assert_fails(format('INSERT INTO public.research_answers(form_id,version_id,answers,consent_accepted) VALUES(%L,%L,''{"intent":"NAO"}'',true)',id,version),'direct inserts cannot bypass configured journey capture') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,false)',id,version,gen_random_uuid(),'{"intent":"NAO"}',journey),'research consent required') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',id,version,gen_random_uuid(),'{"intent":"NAO"}',journey||'{"outboundTime":"08:00"}'),'unsuggested time requires explicit other') FROM fixture;
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(id,version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"intent":"SIM","pay":"SIM","email":"private@example.test","location":"Private exact address"}',1,journey,true) FROM fixture),'anonymous transactional submission');
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(id,version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"intent":"SIM","pay":"SIM","email":"private@example.test","location":"Private exact address"}',1,journey,true) FROM fixture),'submission idempotency');
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(id,version,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"intent":"NAO"}',1,journey,true) FROM fixture),'conditional required question excluded for ineligible respondent');
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',id,version,gen_random_uuid(),'{"intent":"NAO"}',journey||'{"direction":"VOLTA","outboundTime":"07:00","returnTime":""}'),'return-only journey uses return slots') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',id,version,gen_random_uuid(),'{"intent":"NAO","pay":"SIM"}',journey),'hidden answers rejected in the database') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,0,%L,true)',id,version,gen_random_uuid(),'{"intent":"NAO"}',journey),'stale public configuration rejected') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.register_research_interest(%L,%L,''MOTORISTA'',false)',id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'separate activation consent required') FROM fixture;
SELECT pg_temp.assert_true((SELECT public.register_research_interest(id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PASSAGEIRO',true)='INTERESSE_REGISTRADO' FROM fixture),'passenger interest only');
SELECT pg_temp.assert_true((SELECT public.register_research_interest(id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MOTORISTA',true,journey||'{"outboundTime":"08:30","otherOutboundTime":true,"marketingConsent":true}')='DISPONIBILIDADE_REGISTRADA' FROM fixture),'driver availability separately');
SELECT pg_temp.assert_fails(format('SELECT public.register_research_interest(%L,%L,''PASSAGEIRO'',true)',id,gen_random_uuid()),'invalid receipt cannot claim interest') FROM fixture;
SELECT pg_temp.assert_fails('SELECT * FROM public.research_journeys','anonymous private journey read denied');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_answers)=2,'idempotent submissions create no duplicate answers');
SELECT pg_temp.assert_true((SELECT count(DISTINCT journey->>'outboundTime')=2 AND bool_and(NOT (journey->>'marketingConsent')::boolean) FROM public.research_interest_requests),'independent role journeys preserve original consent');
SELECT pg_temp.assert_true((SELECT (journey->>'originLat')::numeric=-3.732 FROM public.research_journeys LIMIT 1),'coordinates stored approximately');
SELECT pg_temp.assert_true((SELECT eligible=1 AND answered=1 AND total=1 FROM public.get_configured_research_summary() WHERE semantic_code='WILLINGNESS_TO_PAY'),'conditional eligible denominator');
SELECT pg_temp.assert_true((SELECT eligible=2 FROM public.get_configured_research_summary() WHERE semantic_code='ADOPTION_INTENT' LIMIT 1),'unconditional eligible denominator');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.get_configured_research_summary('{"campus":"OTHER"}'))=0,'cohort filters applied');
SELECT pg_temp.assert_true(public.get_research_answer_summary((SELECT id FROM fixture))::text NOT LIKE '%private@example.test%' AND public.get_research_answer_summary((SELECT id FROM fixture))::text NOT LIKE '%Private exact%','existing aggregate does not expose personal fields');
SELECT pg_temp.assert_true((SELECT public.save_research_configuration(id,config||'{"launchDate":"2027-02-20","serviceState":"ADIADO"}',1)=2 FROM fixture),'launch update creates new revision');
SELECT pg_temp.assert_true((SELECT configuration_snapshot->>'launchDate'='2027-01-10' FROM public.research_journeys LIMIT 1),'historic configuration snapshot unchanged');
SELECT pg_temp.assert_true(public.get_public_research_configuration('INFRA-TEST')#>>'{settings,launchDate}'='2027-02-20','public launch date updated');
SELECT pg_temp.assert_fails('UPDATE public.research_forms SET mobility_configured=false WHERE code=''INFRA-TEST''','configured flag cannot bypass transactional capture');
SELECT pg_temp.assert_true((SELECT public.save_research_configuration(id,config||'{"modes":["CARONA","TRANSPORTE_PROFISSIONAL_INTERESSE"],"profileSchedules":[{"profile":"PASSAGEIRO","days":[2],"outboundTimes":["08:30"],"returnTimes":["18:00"],"flexibilityMinutes":10}]}',2)=3 FROM fixture),'per-profile configuration persists independently');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,3,%L,true)',id,version,gen_random_uuid(),'{"intent":"NAO"}',journey||'{"profile":"PASSAGEIRO","outboundTime":"08:30"}'),'per-profile unavailable day rejected') FROM fixture;
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(id,version,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"intent":"NAO"}',3,journey||'{"profile":"PASSAGEIRO","days":[2],"outboundTime":"08:30"}',true) FROM fixture),'per-profile time accepted without changing chosen hour');
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(id,version,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','{"intent":"NAO"}',3,journey||'{"mode":"TRANSPORTE_PROFISSIONAL_INTERESSE"}',true) FROM fixture),'professional interest may be researched');
SELECT pg_temp.assert_fails(format('SELECT public.register_research_interest(%L,%L,''PASSAGEIRO'',true)',id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'professional transport cannot be activated as shared ride') FROM fixture;
SELECT pg_temp.assert_fails(format('SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',id,version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"intent":"SIM","pay":"SIM","email":"private@example.test","location":"Private exact address"}',journey||'{"flexibilityMinutes":5}'),'idempotent receipt cannot silently replace original journey') FROM fixture;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
CREATE TEMP TABLE copied AS SELECT public.duplicate_research_form(id) AS id FROM fixture;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_answers WHERE form_id=(SELECT id FROM copied))=0,'copy has no answers');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_participation_badges WHERE form_id=(SELECT id FROM copied))=0,'copy has no badges');
SELECT pg_temp.assert_true((SELECT code<>'INFRA-TEST' AND status='RASCUNHO' AND NOT is_enabled FROM public.research_forms WHERE id=(SELECT id FROM copied)),'copy has independent code and lifecycle');
SELECT pg_temp.assert_true((SELECT schema_json#>>'{sections,0,questions,0,id}'<>'intent' FROM public.research_form_versions WHERE form_id=(SELECT id FROM copied)),'copy gets new question IDs');
SELECT pg_temp.assert_true((SELECT schema_json#>>'{sections,0,questions,1,showWhen,questionId}'=schema_json#>>'{sections,0,questions,0,id}' FROM public.research_form_versions WHERE form_id=(SELECT id FROM copied)),'copy remaps conditional reference');
SELECT pg_temp.assert_true((SELECT revision=1 AND settings->>'serviceState'='PLANEJADO' AND settings->>'launchDate' IS NULL FROM public.research_configurations WHERE form_id=(SELECT id FROM copied)),'copy has independent configuration and unconfirmed launch');
CREATE TEMP TABLE draft_publication AS SELECT v.form_id,v.id AS version_id,v.schema_json FROM public.research_form_versions v WHERE v.form_id=(SELECT id FROM copied);
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SELECT pg_temp.assert_fails(format('SELECT public.publish_research_form(%L,%L,%L)',form_id,version_id,schema_json),'non-admin cannot publish valid draft') FROM draft_publication;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT pg_temp.assert_fails(format('SELECT public.publish_research_form(%L,%L,%L)',form_id,version_id,jsonb_set(schema_json,'{sections,0,questions,1,type}','"number"')),'publication rejects incompatible payment semantics') FROM draft_publication;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_configuration_history WHERE created_by='11111111-1111-4111-8111-111111111111')>=3,'configuration revisions retain the authenticated actor');
RESET ROLE;
SELECT pg_temp.assert_fails('UPDATE public.research_form_versions SET schema_json=''{}'' WHERE published_at IS NOT NULL','published version trigger rejects privileged mutation');
SELECT 'RESEARCH INFRASTRUCTURE INTEGRATION PASSED' AS result;
