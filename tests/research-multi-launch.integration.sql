-- Isolated SQL regression: three account types, two pending launches and
-- distinct proof methods. Only owned/confirmed submissions may appear.
INSERT INTO auth.users(id,created_at) VALUES
 ('11111111-1111-4111-8111-111111111111','2026-04-01T00:00:00Z'),
 ('22222222-2222-4222-8222-222222222222','2024-01-01T00:00:00Z'),
 ('33333333-3333-4333-8333-333333333333','2026-04-01T00:00:00Z');
INSERT INTO public.research_forms(id,code,title,nature,created_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OLD','Pesquisa campus','EDUCACAO','2026-06-01'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','NEW','Pesquisa evento','EVENTO','2025-01-01'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','DONE','Pesquisa liberada','EVENTO','2025-01-01');
INSERT INTO public.research_form_versions(form_id,published_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-06-01'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2025-01-01'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2025-01-01');
INSERT INTO public.research_configurations(form_id,settings) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"launchDate":"2099-01-10","timezone":"America/Fortaleza","publicName":"Campus"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"launchDate":"2099-03-10","timezone":"America/Fortaleza","publicName":"Evento"}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"launchDate":"2099-04-10","timezone":"America/Fortaleza","publicName":"Liberada"}');
INSERT INTO public.research_launch_releases(form_id,released_at) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',now());
INSERT INTO public.research_participation_badges(user_id,form_id,answer_id) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaa1111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaa2222-2222-4222-8222-222222222222'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbb2222-2222-4222-8222-222222222222'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccc1111-1111-4111-8111-111111111111');
INSERT INTO public.research_journeys(answer_id,journey) VALUES
 ('aaaa1111-1111-4111-8111-111111111111','{"profile":"PASSAGEIRO","originArea":"Fortaleza","destinationArea":"Campus","outboundTime":"07:00"}'),
 ('aaaa2222-2222-4222-8222-222222222222','{"profile":"MOTORISTA","originArea":"Centro","destinationArea":"Campus","outboundTime":"08:00"}');
INSERT INTO public.form_submissions(submission_id,user_id,research_form_id,tipo_usuario,origem_trajeto,destino_trajeto,faixa_horario) VALUES
 ('abab1111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MOTORISTA','Centro','Evento','18:00'),
 ('abab3333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PASSAGEIRO','Centro','Evento','18:00');
INSERT INTO public.form_submission_account_links(submission_id,user_id,confirmed_at) VALUES
 ('abab1111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('abab3333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333',NULL);
CREATE FUNCTION pg_temp.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $check$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label; END $check$;
-- The first form predates this user's first accepted account? Here the user's
-- account predates the form, so this campaign must be visible but not cause a lock.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.research_launch_wait_eligible(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'), 'pre-existing account is not cohort locked for newer form');
SELECT pg_temp.assert_true(public.research_launch_wait_eligible(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111'), 'same account may be restricted for older form');
SELECT pg_temp.assert_true(
 (public.get_my_research_launch_state()->>'locked')::boolean AND
 jsonb_array_length(public.get_my_research_launch_state()->'launches')=2,
 'mixed-eligibility participant sees both pending campaigns');
SELECT pg_temp.assert_true(
 (public.get_my_research_launch_state()#>>'{launches,0,formCode}')='OLD' AND
 (public.get_my_research_launch_state()#>>'{launches,1,formCode}')='NEW' AND
 (public.get_my_research_launch_state()#>>'{launches,0,title}')='Pesquisa campus' AND
 (public.get_my_research_launch_state()#>>'{launches,1,title}')='Pesquisa evento' AND
 (public.get_my_research_launch_state()#>>'{launches,1,preview,kind}')='OFERTA',
 'individual identity, independent dates and confirmed legacy submission');
SELECT pg_temp.assert_true(
 (public.get_my_research_launch_state()#>>'{launches,0,launchAt}') <>
 (public.get_my_research_launch_state()#>>'{launches,1,launchAt}'),
 'launch countdowns receive distinct server timestamps');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(
 NOT (public.get_my_research_launch_state()->>'locked')::boolean AND
 jsonb_array_length(public.get_my_research_launch_state()->'launches')=2,
 'established user sees both campaigns without losing app access');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(
 NOT (public.get_my_research_launch_state()->>'locked')::boolean AND
 jsonb_array_length(public.get_my_research_launch_state()->'launches')=0,
 'unconfirmed receipts cannot disclose another campaign');
RESET ROLE;
UPDATE public.research_launch_releases SET released_at=now()
 WHERE form_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SET ROLE authenticated;
SELECT pg_temp.assert_true(
 (public.get_my_research_launch_state()->>'locked')::boolean AND
 jsonb_array_length(public.get_my_research_launch_state()->'launches')=1 AND
 (public.get_my_research_launch_state()#>>'{launches,0,formCode}')='NEW',
 'released campaign disappears but other countdown continues');
RESET ROLE;
UPDATE public.research_launch_releases SET released_at=now()
 WHERE form_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
SELECT pg_temp.assert_true(
 NOT (public.get_my_research_launch_state()->>'locked')::boolean AND
 jsonb_array_length(public.get_my_research_launch_state()->'launches')=0,
 'last released campaign removes the waiting restriction');
RESET ROLE;
SELECT 'MULTI-CAMPAIGN LAUNCH INTEGRATION PASSED' AS result;
