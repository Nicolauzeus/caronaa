-- 0122 | Consent-bound WhatsApp for academic express forms (UNIFOR/UNILAB).
-- Apply AFTER 0120 and 0121, BEFORE deploying the companion frontend.
-- This is a sidecar: published schemas, answers, journeys and existing leads remain intact.
BEGIN;

CREATE TABLE IF NOT EXISTS public.research_whatsapp_contacts (
  answer_id uuid PRIMARY KEY REFERENCES public.research_answers(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL REFERENCES public.research_forms(id) ON DELETE RESTRICT,
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^[+]55[1-9][0-9]9[0-9]{8}$'),
  linkage_consent boolean NOT NULL CHECK (linkage_consent),
  contact_consent boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_whatsapp_contacts_form_idx
  ON public.research_whatsapp_contacts(form_id,captured_at DESC);
ALTER TABLE public.research_whatsapp_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.research_whatsapp_contacts FROM PUBLIC,anon,authenticated;

-- Same unguessable submission receipt and 24h bound as research email capture.
CREATE OR REPLACE FUNCTION public.capture_research_whatsapp(
  p_form_id uuid, p_submission_key uuid, p_whatsapp text,
  p_linkage_consent boolean, p_contact_consent boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $phone$
DECLARE
  v_digits text := regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
  v_answer_id uuid;
  v_stored text;
  v_number text;
BEGIN
  IF p_linkage_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Autorize o vínculo do WhatsApp à pesquisa' USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_whatsapp,'')) > 40 THEN
    RAISE EXCEPTION 'WhatsApp inválido' USING ERRCODE='22023';
  END IF;
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN
    v_digits := substr(v_digits,3);
  END IF;
  IF v_digits !~ '^[0-9]{11}$'
     OR left(v_digits,2) NOT IN (
       '11','12','13','14','15','16','17','18','19',
       '21','22','24','27','28','31','32','33','34','35','37','38',
       '41','42','43','44','45','46','47','48','49',
       '51','53','54','55','61','62','63','64','65','66','67','68','69',
       '71','73','74','75','77','79','81','82','83','84','85','86','87',
       '88','89','91','92','93','94','95','96','97','98','99'
     )
     OR substr(v_digits,3,1) <> '9' THEN
    RAISE EXCEPTION 'Informe um celular brasileiro válido com DDD' USING ERRCODE='22023';
  END IF;
  v_number := '+55' || v_digits;

  SELECT a.id INTO v_answer_id
  FROM public.research_answers a
  JOIN public.research_form_versions v ON v.id=a.version_id
  WHERE a.form_id=p_form_id AND a.client_submission_key=p_submission_key
    AND a.consent_accepted IS TRUE
    AND a.submitted_at > now() - interval '24 hours'
    AND v.schema_json->>'experience' IN ('ACADEMIC_EXPRESS_V1','ACADEMIC_EXPRESS_F01_V2');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participação acadêmica não localizada' USING ERRCODE='42501';
  END IF;

  SELECT whatsapp_e164 INTO v_stored
  FROM public.research_whatsapp_contacts WHERE answer_id=v_answer_id FOR UPDATE;
  IF FOUND THEN
    IF v_stored<>v_number THEN
      RAISE EXCEPTION 'O WhatsApp já está vinculado a esta participação' USING ERRCODE='23505';
    END IF;
    RETURN 'already_captured';
  END IF;
  INSERT INTO public.research_whatsapp_contacts
    (answer_id,form_id,whatsapp_e164,linkage_consent,contact_consent)
  VALUES (v_answer_id,p_form_id,v_number,true,coalesce(p_contact_consent,false))
  ON CONFLICT (answer_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT whatsapp_e164 INTO v_stored
    FROM public.research_whatsapp_contacts WHERE answer_id=v_answer_id;
    IF v_stored IS DISTINCT FROM v_number THEN
      RAISE EXCEPTION 'O WhatsApp já está vinculado a esta participação' USING ERRCODE='23505';
    END IF;
    RETURN 'already_captured';
  END IF;
  RETURN 'captured';
END
$phone$;
REVOKE ALL ON FUNCTION public.capture_research_whatsapp(uuid,uuid,text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_research_whatsapp(uuid,uuid,text,boolean,boolean)
  TO anon,authenticated;

-- Existing admin-gated 0120 CRM projection, expanded with the new consented phone.
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
      ) FILTER (WHERE nullif(q.value->>'label','') IS NOT NULL),'{}'::jsonb) AS labeled
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
COMMENT ON TABLE public.research_whatsapp_contacts IS
  'Brazilian WhatsApp linked to an academic research receipt with explicit consent; admin-only CRM.';
COMMIT;
