ALTER POLICY "Allow public insert to pitch_contacts"
ON public.pitch_contacts
WITH CHECK (
  interest IN ('INVESTIDOR','PARCEIRO','AMBOS')
  AND length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(whatsapp)) BETWEEN 1 AND 50
  AND length(message) <= 10000
  AND status = 'NOVO'
  AND suggestion_status = 'NOVA'
  AND notes IS NULL
);

ALTER POLICY "Público lê configurações de preços"
ON public.pricing_settings
USING (id = 'singleton');

ALTER POLICY "Visitante insere solicitação"
ON public.service_requests
WITH CHECK (
  length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND status = 'recebido'
  AND privacy_policy_accepted IS TRUE
  AND lead_id IS NULL
  AND client_id IS NULL
  AND internal_notes IS NULL
  AND agreed_price = 0
  AND agreed_deadline IS NULL
  AND agreed_payment_terms IS NULL
  AND revision_history = '[]'::jsonb
  AND admin_adjusted_total IS NULL
  AND admin_notes IS NULL
  AND final_currency IS NULL
);