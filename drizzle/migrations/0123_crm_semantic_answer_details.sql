-- 0123 | F09 executive CRM: semantic answer metadata for historical survey versions.
-- Apply AFTER 0120 and 0122; no modification to research_answers or published schemas.
-- Re-exposes the same already-authorized answers with labels and stable semantic codes.
-- Returns only to users holding admin role through the existing guarded RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_admin_research_crm_rows(
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
) RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $crm$
BEGIN
  IF auth.uid() IS NULL OR
     NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR
     p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
    RAISE EXCEPTION 'Invalid CRM pagination' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'source_type','RESEARCH',
    'source_id',a.id::text,
    'source_form',f.code,
    'source_label',coalesce(nullif(c.settings->>'institutionName',''),nullif(f.title,''),f.code),
    'name',coalesce(
      nullif(meta.semantic->>'ACADEMIC_PARTICIPANT_NAME',''),
      nullif(meta.semantic->>'MOBILITY_PARTICIPANT_NAME',''),
      'Participante sem identificação'
    ),
    'email',CASE WHEN l.linkage_consent IS TRUE THEN l.normalized_email ELSE NULL END,
    'whatsapp',w.whatsapp_e164,
    'whatsapp_contact_consent',coalesce(w.contact_consent,false),
    'academic_role',coalesce(meta.semantic->>'ACADEMIC_ROLE',
                              meta.semantic->>'MOBILITY_AFFILIATION'),
    'mobility_role',coalesce(meta.semantic->>'RESEARCH_PARTICIPANT_ROLE',j.journey->>'profile'),
    'route_origin',j.journey->>'originArea',
    'route_destination',j.journey->>'destinationArea',
    'outbound_time',j.journey->>'outboundTime',
    'vehicle_type',coalesce(meta.semantic->>'URBAN_OFFER_VEHICLE',meta.semantic->>'REGIONAL_OFFER_VEHICLE'),
    'seats',meta.semantic->>'SEATS_AVAILABLE',
    'pains',
      CASE WHEN jsonb_typeof(meta.semantic->'MOBILITY_PAINS')='array'
        THEN meta.semantic->'MOBILITY_PAINS'
        WHEN meta.semantic ? 'URBAN_PRIMARY_PAIN'
          THEN jsonb_build_array(meta.semantic->'URBAN_PRIMARY_PAIN')
        WHEN meta.semantic ? 'REGIONAL_PRIMARY_PAIN'
          THEN jsonb_build_array(meta.semantic->'REGIONAL_PRIMARY_PAIN')
        ELSE '[]'::jsonb END,
    'created_at',a.submitted_at,
    'contact_consent',coalesce(l.linkage_consent,false),
    'institutional_email',
      (coalesce(l.institutional_domain_recognized,false) OR
       coalesce(c.settings->'institutionalEmailDomains' ?
         lower(split_part(l.normalized_email,'@',2)),false)),
    'status','NOVO',
    'raw_payload',jsonb_build_object(
      'answers',coalesce(meta.labeled,'{}'::jsonb),
      'answers_raw',a.answers,
      'answers_structured',coalesce(meta.structured,'[]'::jsonb),
      'journey',j.journey,
      'version',v.version_number,
      'form',f.code
    )
  )
  FROM public.research_answers a
  JOIN public.research_forms f ON f.id=a.form_id
  JOIN public.research_form_versions v ON v.id=a.version_id
  LEFT JOIN public.research_journeys j ON j.answer_id=a.id
  LEFT JOIN public.research_configurations c ON c.form_id=a.form_id
  LEFT JOIN public.research_lead_contacts l
    ON l.answer_id=a.id AND l.linkage_consent IS TRUE
  LEFT JOIN public.research_whatsapp_contacts w
    ON w.answer_id=a.id AND w.linkage_consent IS TRUE
  LEFT JOIN LATERAL (
    SELECT
      coalesce(jsonb_object_agg(
        q.value->>'semanticCode',a.answers->(q.value->>'id')
      ) FILTER (WHERE coalesce(q.value->>'semanticCode','')<>''),'{}'::jsonb) AS semantic,
      coalesce(jsonb_object_agg(
        q.value->>'label',a.answers->(q.value->>'id')
      ) FILTER (WHERE nullif(q.value->>'label','') IS NOT NULL),'{}'::jsonb) AS labeled,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'semanticCode',nullif(q.value->>'semanticCode',''),
          'label',coalesce(nullif(q.value->>'label',''),nullif(q.value->>'semanticCode',''),'Resposta'),
          'value',a.answers->(q.value->>'id')
        ) ORDER BY q.value->>'id'
      ),'[]'::jsonb) AS structured
    FROM jsonb_array_elements(v.schema_json->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE a.answers ? (q.value->>'id')
  ) meta ON true
  ORDER BY a.submitted_at DESC,a.id
  LIMIT p_limit OFFSET p_offset;
END
$crm$;
REVOKE ALL ON FUNCTION public.get_admin_research_crm_rows(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_research_crm_rows(integer,integer) TO authenticated;
COMMENT ON FUNCTION public.get_admin_research_crm_rows(integer,integer) IS
  'Admin-only CRM projection; answers_structured contains semanticCode, label, value per answered question for historical versions';
COMMIT;
