-- Run only after 0099 inside pg_virtualenv; no production connection.
INSERT INTO auth.users(id,email_confirmed_at)
VALUES ('33333333-3333-4333-8333-333333333333',now());
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
CREATE TEMP TABLE corporate_fixture AS
SELECT public.create_configured_research_form(
 '{"title":"Pesquisa corporativa restrita","code":"EMPRESA-INTERNA-TEST","nature":"EMPRESA","audience":"COLABORADORES","municipality":"Fortaleza"}'::jsonb,
 '{"sections":[{"title":"Caronas dos colegas","questions":[
 {"id":"drives","label":"Você dirige carro ao trabalho?","type":"single_choice","required":true,"options":["SIM","NAO"],"semanticCode":"CORP_DRIVES_CAR"},
 {"id":"seats","label":"Quantos lugares livres?","type":"number","required":true,"options":[],"minValue":0,"maxValue":4,"integerOnly":true,"semanticCode":"SEATS_AVAILABLE","showWhen":{"questionId":"drives","equals":"SIM"}},
 {"id":"offer","label":"Ofereceria carona?","type":"yes_no","required":true,"options":[],"semanticCode":"RIDE_OFFER_INTENT","showWhen":{"questionId":"drives","equals":"SIM"}}
 ]}]}'::jsonb,
 (SELECT config||'{"templateKey":"EMPRESA_CARONA_INTERNA","institutionId":"EMPRESA_INTERNA","accessPolicy":"COLABORADORES_DA_EMPRESA","modes":["CARONA"]}'::jsonb FROM fixture)
) AS id;
ALTER TABLE corporate_fixture ADD COLUMN version uuid;
ALTER TABLE corporate_fixture ADD COLUMN journey jsonb;
UPDATE corporate_fixture f SET version=(
 SELECT v.id FROM public.research_form_versions v WHERE v.form_id=f.id ORDER BY v.version_number DESC LIMIT 1
), journey=(SELECT journey FROM fixture);
SELECT pg_temp.assert_true((SELECT public.publish_research_form(id,version,(SELECT schema_json FROM public.research_form_versions WHERE id=version)) FROM corporate_fixture),
 'admin can publish a private company survey');

-- Corporate template cannot be switched to public even by admin.
SELECT pg_temp.assert_fails(format(
 'SELECT public.validate_research_configuration(%L::jsonb)',
 (SELECT config||'{"templateKey":"EMPRESA_CARONA_INTERNA","accessPolicy":"PESQUISA_PUBLICA"}'::jsonb FROM fixture)
),'corporate access policy cannot be public');
RESET ROLE;

-- Anonymous must not read the company survey schema, its settings or submit.
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_forms WHERE id=(SELECT id FROM corporate_fixture))=0,
 'anonymous cannot read private research form');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_form_versions WHERE form_id=(SELECT id FROM corporate_fixture))=0,
 'anonymous cannot read private research questions');
SELECT pg_temp.assert_true((SELECT public.get_public_research_configuration('EMPRESA-INTERNA-TEST')) IS NULL,
 'anonymous cannot read corporate settings');
SELECT pg_temp.assert_fails(format(
 'SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',
 id,version,gen_random_uuid(),'{"drives":"SIM","seats":"2","offer":"SIM"}',journey||'{"profile":"MOTORISTA"}'::jsonb
),'anonymous cannot submit') FROM corporate_fixture;
RESET ROLE;

-- Email-confirmed but unverified user has no access.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_forms WHERE id=(SELECT id FROM corporate_fixture))=0,
 'confirmed email is not an employee credential');
SELECT pg_temp.assert_true((SELECT public.get_public_research_configuration('EMPRESA-INTERNA-TEST')) IS NULL,
 'unverified employee cannot read corporate settings');
SELECT pg_temp.assert_fails(format(
 'SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',
 id,version,gen_random_uuid(),'{"drives":"SIM","seats":"2","offer":"SIM"}',journey||'{"profile":"MOTORISTA"}'::jsonb
),'unverified employee cannot submit') FROM corporate_fixture;
SELECT pg_temp.assert_fails(format(
 'SELECT public.grant_corporate_research_access(%L,%L,%L)',
 (SELECT id FROM corporate_fixture),'22222222-2222-4222-8222-222222222222','PROTOCOLO-RH-001'
),'employee cannot approve themselves');
RESET ROLE;

-- Admin validates HR evidence for one specific account, not whole email domain.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(public.grant_corporate_research_access(
 (SELECT id FROM corporate_fixture),'22222222-2222-4222-8222-222222222222','PROTOCOLO-RH-001'),
 'admin grants verified employee');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.list_corporate_research_access((SELECT id FROM corporate_fixture)))=1,
 'admin-only membership roster sees one member');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_forms WHERE id=(SELECT id FROM corporate_fixture))=1,
 'verified member can read private company survey');
SELECT pg_temp.assert_true((SELECT public.get_public_research_configuration('EMPRESA-INTERNA-TEST')) IS NOT NULL,
 'verified member can read settings');
SELECT pg_temp.assert_fails(format(
 'SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',
 id,version,gen_random_uuid(),'{"drives":"SIM","seats":"0","offer":"SIM"}',journey||'{"profile":"MOTORISTA"}'::jsonb
),'zero-seat driver cannot forge participation') FROM corporate_fixture;
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(
 id,version,'abababab-abab-4bab-8bab-abababababab',
 '{"drives":"SIM","seats":"2","offer":"SIM"}'::jsonb,
 1,journey||'{"profile":"MOTORISTA"}'::jsonb,true
) FROM corporate_fixture),'verified employee can submit consistent driver research');
SELECT pg_temp.assert_true((SELECT public.submit_configured_research_answer(
 id,version,'abababab-abab-4bab-8bab-abababababab',
 '{"drives":"SIM","seats":"2","offer":"SIM"}'::jsonb,
 1,journey||'{"profile":"MOTORISTA"}'::jsonb,true
) FROM corporate_fixture),'same employee may retry an idempotent receipt');
SELECT pg_temp.assert_true((SELECT public.register_research_interest(
 id,'abababab-abab-4bab-8bab-abababababab','MOTORISTA',true,NULL
)='DISPONIBILIDADE_REGISTRADA' FROM corporate_fixture),'employee can register potential seats only with consent');
RESET ROLE;

-- Another verified employee cannot steal the answer or badge via bearer receipt.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT public.grant_corporate_research_access((SELECT id FROM corporate_fixture),
 '33333333-3333-4333-8333-333333333333','PROTOCOLO-RH-002');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
SET ROLE authenticated;
SELECT pg_temp.assert_fails(format(
 'SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',
 id,version,'abababab-abab-4bab-8bab-abababababab',
 '{"drives":"SIM","seats":"2","offer":"SIM"}',journey||'{"profile":"MOTORISTA"}'::jsonb
),'other verified employee cannot replay the answer') FROM corporate_fixture;
SELECT pg_temp.assert_fails(format(
 'SELECT public.register_research_interest(%L,%L,''MOTORISTA'',true)',
 id,'abababab-abab-4bab-8bab-abababababab'
),'other employee cannot use receipt to register seats') FROM corporate_fixture;
SELECT pg_temp.assert_fails(
 'SELECT public.claim_research_participation(''abababab-abab-4bab-8bab-abababababab'')',
 'other employee cannot claim a corporate survey badge');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(public.revoke_corporate_research_access(
 (SELECT id FROM corporate_fixture),'22222222-2222-4222-8222-222222222222'
),'admin revokes employee');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.research_forms WHERE id=(SELECT id FROM corporate_fixture))=0,
 'revoked employee cannot read company survey');
SELECT pg_temp.assert_fails(format(
 'SELECT public.submit_configured_research_answer(%L,%L,%L,%L,1,%L,true)',
 id,version,gen_random_uuid(),'{"drives":"SIM","seats":"2","offer":"SIM"}',journey||'{"profile":"MOTORISTA"}'::jsonb
),'revoked employee cannot send new answers') FROM corporate_fixture;
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.corporate_research_access_audit
 WHERE form_id=(SELECT id FROM corporate_fixture))=3,'verification and revocation retained in audit');
SELECT 'CORPORATE RESEARCH SECURITY INTEGRATION PASSED' AS result;
