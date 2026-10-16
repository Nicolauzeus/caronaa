-- Aggregated mobility dimensions; return no names, coordinates or contact information.
CREATE OR REPLACE FUNCTION public.get_research_mobility_dimensions(
 p_form_id uuid DEFAULT NULL,p_nature text DEFAULT NULL,
 p_profile text DEFAULT NULL,p_occupation text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH eligible AS (
 SELECT s.submission_id,s.transporte_atual,s.custo_atual_faixa,s.custo_referencia,
 s.faixa_horario,s.frequencia_semanal,s.origem_trajeto,s.destino_trajeto,
 s.intencao_passageiro::text passenger_interest,s.intencao_motorista::text driver_interest
 FROM public.form_submissions s JOIN public.research_forms f ON f.id=s.research_form_id
 WHERE public.has_role(auth.uid(),'admin')
 AND (p_form_id IS NULL OR f.id=p_form_id)
 AND (p_nature IS NULL OR f.nature=p_nature)
 AND (p_profile IS NULL OR s.tipo_usuario::text=p_profile)
 AND (p_occupation IS NULL OR s.ocupacao=p_occupation)
), dims AS (
 SELECT 'transport' category,coalesce(transporte_atual,'N/D') label,count(*) qty FROM eligible GROUP BY transporte_atual
 UNION ALL SELECT 'cost',coalesce(custo_atual_faixa,'N/D')||' / '||coalesce(custo_referencia::text,'N/D'),count(*) FROM eligible GROUP BY custo_atual_faixa,custo_referencia
 UNION ALL SELECT 'schedule',coalesce(faixa_horario,'N/D'),count(*) FROM eligible GROUP BY faixa_horario
 UNION ALL SELECT 'frequency',coalesce(frequencia_semanal,'N/D'),count(*) FROM eligible GROUP BY frequencia_semanal
 UNION ALL SELECT 'origin',coalesce(origem_trajeto,'N/D'),count(*) FROM eligible GROUP BY origem_trajeto
 UNION ALL SELECT 'destination',coalesce(destino_trajeto,'N/D'),count(*) FROM eligible GROUP BY destino_trajeto
 UNION ALL SELECT 'passengerInterest',coalesce(passenger_interest,'N/D'),count(*) FROM eligible GROUP BY passenger_interest
 UNION ALL SELECT 'driverInterest',coalesce(driver_interest,'N/D'),count(*) FROM eligible GROUP BY driver_interest
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM eligible),
'dimensions',coalesce(jsonb_agg(jsonb_build_object('category',category,'label',label,'total',qty)),'[]'::jsonb))
FROM dims $$;
REVOKE ALL ON FUNCTION public.get_research_mobility_dimensions(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_mobility_dimensions(uuid,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
