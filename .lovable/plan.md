# Google: proteção das buscas e rotas públicas

## Resultado e autorização solicitada

Rotas e buscas com sessão já foram integradas: **114 testes passaram e compilação automática OK**. Sem mudanças em tarifas, consentimentos, cobertura ou pagamentos. As chamadas públicas antigas continuam funcionando e ainda não têm este novo controle.

Autorizar **exatamente o SQL abaixo** para limitar chamadas anônimas ao teto escolhido de **2.000 por dia**, com dia contado em America/Fortaleza. É um limite de consultas, não de reais; Google continua cobrando conforme API e modalidade. Cada tentativa, inclusive repetição após erro, contará no teto. O limite autenticado existente não será alterado.

Depois da aprovação: aplicar, conferir permissões, integrar as buscas e prévias públicas, testar concorrência e comportamento no limite. Formulários continuam sem cadastro; catálogo local e digitação manual permanecem disponíveis quando o Google atingir o teto. Rotas rodoviárias não serão inventadas quando indisponíveis.

## Detalhes técnicos

Sessão anônima emitida no servidor, cookie HttpOnly/SameSite/Secure em HTTPS; apenas seu hash SHA-256 entra nos contadores. Não criar usuário fictício, não aceitar identidade enviada em parâmetros, não armazenar IP/GPS/endereço nestas tabelas. Contadores privados com RLS e privilégios exclusivos de service_role. O teto global continua válido mesmo se alguém apagar cookies; a proteção por sessão não identifica uma pessoa nem substitui mitigação avançada de bots.

Por sessão: 30 autocomplete, 10 prévias de rota e 20 detalhes/geocodificações por minuto, reutilizando os limites atuais. O orçamento global cobre apenas chamadas anônimas; chamadas autenticadas continuam com seu controle próprio. Não ativar cache persistente de respostas Google nesta etapa.

## SQL completo proposto — ainda não aplicado

```sql
CREATE TABLE public.google_public_daily_budget (
  budget_day date PRIMARY KEY,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 2000)
);
REVOKE ALL ON public.google_public_daily_budget FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_public_daily_budget TO service_role;
ALTER TABLE public.google_public_daily_budget ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_public_session_buckets (
  session_hash text NOT NULL CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  operation text NOT NULL CHECK (operation IN ('autocomplete','quote','details')),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 30),
  PRIMARY KEY (session_hash, operation, window_started_at)
);
REVOKE ALL ON public.google_public_session_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_public_session_buckets TO service_role;
ALTER TABLE public.google_public_session_buckets ENABLE ROW LEVEL SECURITY;
CREATE INDEX google_public_session_buckets_expiry_idx
  ON public.google_public_session_buckets(window_started_at);

CREATE FUNCTION public.consume_google_public_request_limit(
  p_session_hash text, p_operation text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $budget$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now AT TIME ZONE 'America/Fortaleza')::date;
  v_window timestamptz := date_trunc('minute', v_now);
  v_max integer;
  v_daily integer;
  v_session integer;
BEGIN
  IF p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid anonymous session hash' USING ERRCODE='22023';
  END IF;
  v_max := CASE p_operation
    WHEN 'autocomplete' THEN 30
    WHEN 'quote' THEN 10
    WHEN 'details' THEN 20
    ELSE NULL END;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
  END IF;

  -- Short transaction-wide lock makes the two budget checks atomic.
  PERFORM pg_advisory_xact_lock(718042, 2000);
  SELECT request_count INTO v_daily
    FROM public.google_public_daily_budget WHERE budget_day = v_day;
  IF coalesce(v_daily, 0) >= 2000 THEN RETURN 'DAILY_LIMIT'; END IF;
  SELECT request_count INTO v_session
    FROM public.google_public_session_buckets
    WHERE session_hash = p_session_hash AND operation = p_operation
      AND window_started_at = v_window;
  IF coalesce(v_session, 0) >= v_max THEN RETURN 'SESSION_LIMIT'; END IF;

  INSERT INTO public.google_public_daily_budget AS b (budget_day, request_count)
    VALUES (v_day, 1)
    ON CONFLICT (budget_day) DO UPDATE SET request_count = b.request_count + 1;
  INSERT INTO public.google_public_session_buckets AS b
    (session_hash, operation, window_started_at, request_count)
    VALUES (p_session_hash, p_operation, v_window, 1)
    ON CONFLICT (session_hash, operation, window_started_at)
    DO UPDATE SET request_count = b.request_count + 1;
  RETURN 'ALLOWED';
END
$budget$;
REVOKE ALL ON FUNCTION public.consume_google_public_request_limit(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_public_request_limit(text,text)
  TO service_role;

CREATE FUNCTION public.purge_google_public_request_budgets()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $purge$
  DELETE FROM public.google_public_session_buckets
    WHERE window_started_at < now() - interval '1 day';
  DELETE FROM public.google_public_daily_budget
    WHERE budget_day < (now() AT TIME ZONE 'America/Fortaleza')::date - 7;
$purge$;
REVOKE ALL ON FUNCTION public.purge_google_public_request_budgets()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_google_public_request_budgets()
  TO service_role;
```

Nenhum agendamento é criado por este SQL; a limpeza exige configuração separada se o agendador existente não estiver disponível.

## Verificação e pendências

- **Módulos:** F01/F03/F05/F06/F07/F08; integração autenticada concluída, anônima parcial.
- **Arquivos:** wrapper Google, novo verificador opcional de sessão, serviços Places/localização, prévias/cotações/rotas/encontros e testes; detalhes em `docs/google-item7-status.md`.
- **Testes/resultados:** 17 arquivos, 114 testes aprovados; compilação automática OK. Testes isolados não comprovam chamadas Google reais nem concorrência real no banco.
- **Riscos:** chamadas públicas antigas permanecem sem o novo teto até aprovação/aplicação; cache persistente continua desligado; validar Google em caronaa.com ou outra origem autorizada após publicar.
- **README:** preservados acesso anônimo, GPS F01 após toque, tarifa compartilhada R$6/11 km rodoviários e autorização de participantes. Sem liberação operacional ou alteração de banco nesta execução.