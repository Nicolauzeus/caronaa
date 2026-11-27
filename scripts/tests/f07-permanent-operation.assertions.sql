CREATE FUNCTION public.fixture_assert(ok boolean,rule text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',rule; END IF; END $$;
CREATE FUNCTION public.fixture_reject(statement text,rule text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 PERFORM public.fixture_assert(rejected,rule);
END $$;
SELECT public.fixture_assert(public.caronaa_f07_operation_dispatch_allowed(),'enabled by default despite expired old switch');
SELECT public.fixture_assert((SELECT to_jsonb(r)=(SELECT payload FROM public.fixture_before WHERE kind='ride') FROM public.professional_quick_rides r WHERE id='00000000-0000-0000-0000-000000000080'),'existing ride not rewritten by transition');
SELECT public.fixture_reject($q$INSERT INTO public.professional_driver_locations VALUES('00000000-0000-0000-0000-000000000099')$q$,'expired temporary account still blocked under permanent service');

SELECT public.fixture_assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='caronaa_f07_operation_control' AND column_name IN('expires_at','activated_at')),'no commercial deadline columns');
-- Metadata ages are irrelevant; there is no synthetic future expiry in the commercial model.
UPDATE public.caronaa_f07_operation_control SET updated_at='2000-01-01';
SELECT public.fixture_assert(public.caronaa_f07_operation_dispatch_allowed(),'old metadata never expires service');
SELECT public.fixture_assert(NOT public.caronaa_f07_test_dispatch_allowed(),'retired test RPC always false');
SELECT public.fixture_assert(NOT has_function_privilege('service_role','public.caronaa_f07_pilot_activate_driver(uuid,text)','EXECUTE'),'temporary activation revoked');
SELECT public.fixture_reject($q$SELECT public.caronaa_f07_pilot_activate_driver('00000000-0000-0000-0000-000000000099','CAR')$q$,'even owner cannot revive temporary activation');
SELECT public.fixture_assert(NOT has_function_privilege('service_role','public.caronaa_f07_test_self_radar(uuid,text,text)','EXECUTE'),'private simulation RPC retired');
SELECT public.fixture_assert(NOT has_table_privilege('service_role','public.caronaa_f07_simulated_driver_positions','INSERT'),'simulation writes retired');
SELECT public.fixture_assert((SELECT count(*)=1 FROM public.caronaa_f07_simulated_driver_positions),'archived simulation preserved');
SELECT public.fixture_assert((SELECT count(*)=2 FROM pg_class WHERE oid IN('public.caronaa_f07_operation_control'::regclass,'public.caronaa_f07_operation_control_events'::regclass) AND relrowsecurity),'new tables enforce RLS');
SELECT public.fixture_assert(NOT has_table_privilege('anon','public.caronaa_f07_operation_control','SELECT'),'anonymous cannot read control');
SELECT public.fixture_assert(NOT has_table_privilege('authenticated','public.caronaa_f07_operation_control','UPDATE'),'client cannot write control directly');
SET fixture.uid='00000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT public.fixture_assert((SELECT count(*)=0 FROM public.caronaa_f07_operation_control),'nonadmin cannot read control');
SELECT public.fixture_reject($q$SELECT public.admin_set_f07_operation_enabled(false,'Suspensao de teste')$q$,'nonadmin cannot suspend');
SELECT public.fixture_assert((SELECT count(*)=0 FROM public.caronaa_f07_operation_control_events),'nonadmin cannot read audit');
-- Exercise actual coverage function as authenticated caller for all live modes/cities.
RESET ROLE;
CREATE TEMP TABLE fixture_combinations AS SELECT municipality,vehicle FROM public.caronaa_service_municipalities CROSS JOIN unnest(ARRAY['CAR','MOTO']) vehicle;
GRANT SELECT ON fixture_combinations TO authenticated;
SET ROLE authenticated;
SELECT public.fixture_assert((SELECT count(*)=34 AND bool_and(public.caronaa_quick_region_status(municipality,vehicle)->>'status'='ENABLED') FROM fixture_combinations),'34 CAR/MOTO combinations enabled');
SELECT public.fixture_assert(public.caronaa_quick_region_status('Recife','CAR')->>'status'='OUTSIDE','no new municipality');
RESET ROLE;
-- Actual quoted submit with synthetic authorized fare, ZERO available drivers.
INSERT INTO public.caronaa_quick_fare_quotes(id,passenger_id,expires_at,destination_municipality,municipality,pricing_region,vehicle_type,origin_label,destination_label,origin_lat,origin_lng,destination_lat,destination_lng,customer_pays_cents)
VALUES ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002',now()+interval '10 minutes','Barreira','Acarape','MACICO_BATURITE','CAR','Origem sintética','Destino sintético',0,0,0,0,3000);
SET ROLE authenticated;
SELECT public.caronaa_quick_submit_quoted('00000000-0000-0000-0000-000000000010');
SELECT public.caronaa_quick_submit_quoted('00000000-0000-0000-0000-000000000010');
RESET ROLE;
SELECT public.fixture_assert((SELECT count(*)=0 FROM public.professional_presence WHERE is_available),'zero online drivers');
SELECT public.fixture_assert((SELECT count(*)=1 FROM public.professional_quick_rides WHERE passenger_id='00000000-0000-0000-0000-000000000002'),'idempotent single waiting request');
SELECT public.fixture_assert((SELECT status='SEARCHING' AND driver_id IS NULL AND abs(extract(epoch FROM expires_at-updated_at)-1800)<1 FROM public.professional_quick_rides WHERE passenger_id='00000000-0000-0000-0000-000000000002'),'30-minute search, no fabricated acceptance');
SELECT public.fixture_assert((SELECT customer_pays_cents=3000 FROM public.caronaa_quick_fare_quotes WHERE id='00000000-0000-0000-0000-000000000010'),'quote snapshot amount retained');
-- Administrative switch is separate from account eligibility and test flags.
SET fixture.uid='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT public.fixture_reject($q$SELECT public.admin_set_f07_operation_enabled(false,'')$q$,'admin reason required');
SELECT public.admin_set_f07_operation_enabled(false,'Suspensao administrativa de teste');
SELECT public.fixture_assert((SELECT count(*)=1 FROM public.caronaa_f07_operation_control_events),'admin suspension audited');
SELECT public.fixture_assert(public.caronaa_quick_region_status('Acarape','CAR')->>'status'='WAITLIST','admin suspension blocks new coverage');
-- Returning an existing quote's ride remains idempotent even during suspension.
RESET ROLE;
SET fixture.uid='00000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT public.caronaa_quick_submit_quoted('00000000-0000-0000-0000-000000000010');
RESET ROLE;
SELECT public.fixture_reject($q$UPDATE public.professional_quick_rides SET status='ACCEPTED' WHERE passenger_id='00000000-0000-0000-0000-000000000002'$q$,'suspension blocks new acceptance');
UPDATE public.professional_quick_rides SET status='COMPLETED' WHERE id='00000000-0000-0000-0000-000000000080';
SELECT public.fixture_assert((SELECT status='COMPLETED' FROM public.professional_quick_rides WHERE id='00000000-0000-0000-0000-000000000080'),'suspension does not block existing trip completion');
SET fixture.uid='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT public.admin_set_f07_operation_enabled(true,'Retomada administrativa de teste');
SELECT public.admin_set_f07_operation_enabled(true,'Retomada idempotente de teste');
SELECT public.fixture_assert((SELECT count(*)=2 FROM public.caronaa_f07_operation_control_events),'resume audited, redundant call has no duplicate event');
RESET ROLE;
-- Coverage/mode/tariff controls keep their previous independent authority.
UPDATE public.caronaa_service_municipalities SET car_enabled=false WHERE municipality='Acarape';
SELECT public.fixture_assert(public.caronaa_quick_region_status('Acarape','CAR')->>'status'='WAITLIST','car suspension blocks car');
SELECT public.fixture_assert(public.caronaa_quick_region_status('Acarape','MOTO')->>'status'='ENABLED','car suspension leaves moto');
UPDATE public.caronaa_service_municipalities SET car_enabled=true WHERE municipality='Acarape';
UPDATE public.caronaa_quick_tariff_policies SET published=false WHERE pricing_region='MACICO_BATURITE' AND vehicle_type='CAR';
SELECT public.fixture_assert(public.caronaa_quick_region_status('Acarape','CAR')->>'status'='WAITLIST','unpublished tariff still blocks');
UPDATE public.caronaa_quick_tariff_policies SET published=true WHERE pricing_region='MACICO_BATURITE' AND vehicle_type='CAR';
UPDATE public.professional_service_regions SET dispatch_enabled=false WHERE municipality='Barreira';
SELECT public.fixture_reject($q$UPDATE public.professional_quick_rides SET status='ACCEPTED' WHERE passenger_id='00000000-0000-0000-0000-000000000002'$q$,'destination suspension still blocks acceptance');
UPDATE public.professional_service_regions SET dispatch_enabled=true WHERE municipality='Barreira';
UPDATE public.professional_quick_rides SET status='ACCEPTED' WHERE passenger_id='00000000-0000-0000-0000-000000000002';
-- Distinct new passengers exercise rejected quotes without an existing active request.
SET fixture.uid='00000000-0000-0000-0000-000000000003';
INSERT INTO public.caronaa_quick_fare_quotes(id,passenger_id,expires_at,destination_municipality,municipality,pricing_region,vehicle_type)
VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003',now()-interval '1 second','Barreira','Acarape','MACICO_BATURITE','MOTO');
SELECT public.fixture_reject($q$SELECT public.caronaa_quick_submit_quoted('00000000-0000-0000-0000-000000000011')$q$,'quote expiry retained');
SET fixture.uid='00000000-0000-0000-0000-000000000004';
SELECT public.fixture_reject($q$SELECT public.caronaa_quick_submit_quoted('00000000-0000-0000-0000-000000000011')$q$,'quote owner authorization retained');
SET fixture.uid='';
SELECT public.fixture_reject($q$SELECT public.caronaa_quick_region_status('Acarape','CAR')$q$,'authentication retained');
SELECT public.fixture_reject($q$SELECT public.admin_set_f07_operation_enabled(false,'Sem autenticacao de teste')$q$,'admin authentication retained');
-- Missing switch fails closed (this is corruption, not an expiry/renewal requirement).
DELETE FROM public.caronaa_f07_operation_control;
SELECT public.fixture_assert(NOT public.caronaa_f07_operation_dispatch_allowed(),'missing control fails closed');
INSERT INTO public.caronaa_f07_operation_control(id) VALUES(true);
SELECT public.fixture_assert(public.caronaa_f07_operation_dispatch_allowed(),'default insert enables continuous service');
SELECT public.fixture_assert((SELECT count(*)=1 AND bool_and(NOT was_previously_approved AND revoked_at IS NULL AND expires_at='2000-01-02') FROM public.caronaa_f07_pilot_authorization_audit),'temporary authorization not promoted, revoked or extended');
SELECT public.fixture_assert(NOT EXISTS(
 (SELECT payload FROM public.fixture_before WHERE kind='municipalities' EXCEPT SELECT to_jsonb(c) FROM public.caronaa_service_municipalities c)
 UNION ALL (SELECT payload FROM public.fixture_before WHERE kind='tariffs' EXCEPT SELECT to_jsonb(t) FROM public.caronaa_quick_tariff_policies t)
 UNION ALL (SELECT payload FROM public.fixture_before WHERE kind='regions' EXCEPT SELECT to_jsonb(r) FROM public.professional_service_regions r)
),'all original coverage, region and tariff rows preserved');
