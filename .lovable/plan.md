# CARONAA — auditoria e SQL para aprovação

## Resultado atual

**Nenhuma alteração de banco foi aplicada nesta etapa.** A regra de apresentar SQL completo e esperar aprovação explícita foi registrada como permanente.

### A — políticas e permissões reais

Consulta somente leitura em `pg_policies`:

| Tabela | Policy | Operação | Papéis | Condição |
|---|---|---|---|---|
| pilot_areas | pilot_areas_read | SELECT | anon, authenticated | true |
| geocoding_cache | nenhuma | — | — | — |
| google_api_usage | api_usage_admin | ALL | authenticated | existe user_roles do usuário com role admin |

- `geocoding_cache_read` **não existe atualmente**. `geocoding_cache` tem RLS ativo e nenhum privilégio de leitura para anon/authenticated.
- `v_google_api_daily_usage` tem **security_invoker=true**, anon **sem SELECT**, authenticated e service_role com SELECT.
- Problema adicional: `google_api_usage` tem grants SELECT/INSERT/UPDATE/DELETE para anon e authenticated. RLS bloqueia anon e permite administradores, mas a policy ALL também permite manipulação dos logs por administradores. A proposta abaixo reduz isso para leitura administrativa e escrita exclusiva do servidor.
- `pilot_areas` também tem grants de escrita desnecessários para anon/authenticated; a única policy atual permite SELECT. A proposta reduz os grants sem remover a leitura pública existente.

### B — migration 0124 e 0148

- `0124_harden_google_cost_tables.sql` está no **fim** do journal: idx 124, when 1794774953478. Seu hash coincide com o registro aplicado id 160 no banco: `092b5e07bad192ca6ed1b94629229250176b910ce5f03cc9b959fe8bd433e9bc`.
- Ela não conflita nominalmente com `0148_f07_realtime_safe_queue_events.sql`, mas existe outro arquivo com prefixo 0124 (`0124_progressive_onboarding.sql`). Portanto **não é correto afirmar que a numeração esteja limpa**.
- 0148 existe nos arquivos, mas **não consta no journal atual**; seu hash `fdd0a98119a9e21910a5370a1224f019e89236da96ca7d1e47579b7315015a77` não aparece no histórico consultado. Isso não prova ausência de sua estrutura: pode ter sido aplicada manualmente.
- O journal também contém uma inversão de timestamp antiga entre 0086 e 0087. Nenhum arquivo histórico, journal ou snapshot foi alterado.
- Para uma nova alteração, usar entrada incremental posterior ao último timestamp aplicado, gerada pela ferramenta; nunca reaplicar 0124 nem renumerar histórico aplicado.

### C — teste anterior às mudanças

- Exportada a revisão **b72a776**, pai de **d44e882** (introdução de pilot-area), para `/tmp/caronaa-before`, usando `git archive`; sem stash, checkout ou alteração da árvore de trabalho.
- Executado naquela pasta: `vitest run src/lib/professional-radar-sql-policy.test.ts -t 'labels a fake marker'`.
- **Anterior: 1 falhou / 9 ignorados; atual: 1 falhou / 9 ignorados.** Mesma falha na linha 92: Home não contém `getF07TestSelfRadar`.
- Isso comprova uma falha preexistente de contrato estático; **não** comprova execução bem-sucedida da RPC. A função SQL `caronaa_f07_test_self_radar` não foi encontrada na consulta atual. Não foi criada ou habilitada simulação.

## D — cobertura versus acompanhamento: decisão necessária

O código atual chama `resolvePilotCivic` em **cada publicação GPS**, podendo apagar `professional_driver_locations` ao sair da área. No banco, `publish_verified_professional_position` também exige município habilitado em cada atualização.

O README exige município real confirmado por Google, suspensão da publicação pública ao sair da zona e preservação de consentimento/TTL. O resolver atual por raio Haversine **não prova limites municipais**, especialmente nas bordas. Não usar um município antigo como se fosse o município atual.

Proposta segura para aprovar: validar cobertura em eventos de **nova disponibilidade/pedido/embarque**, e separar **acompanhamento privado da corrida já aceita** da descoberta pública de novos chamados. O percurso ativo não deve ser apagado por sair da área; isso não libera novos chamados fora dela. Antes de mudar esse contrato, revisar as funções de rastreamento de participantes existentes e atualizar a documentação aprovada. **Nenhuma regra do radar foi relaxada nesta etapa.**

## Item 7 — SQL proposto, não aplicado

O wrapper só será conectado ao app após aprovação e aplicação verificada da estrutura abaixo. Até lá, manter as chamadas atuais para não introduzir dependência ausente. Os itens 4, 5, 6 e 8 não serão executados.

### SQL completo para revisão

```sql
-- PROPOSTA NÃO APLICADA. Requer aprovação explícita.
-- Grants/policies só nas tabelas de custo, sem mudar radar ou pagamentos.
REVOKE ALL ON public.pilot_areas FROM anon, authenticated;
GRANT SELECT ON public.pilot_areas TO anon, authenticated;
GRANT ALL ON public.pilot_areas TO service_role;

DROP POLICY IF EXISTS geocoding_cache_read ON public.geocoding_cache;
REVOKE ALL ON public.geocoding_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.geocoding_cache TO service_role;

ALTER VIEW public.v_google_api_daily_usage
  SET (security_invoker = true);
REVOKE ALL ON public.v_google_api_daily_usage FROM PUBLIC, anon;
GRANT SELECT ON public.v_google_api_daily_usage TO authenticated;
GRANT ALL ON public.v_google_api_daily_usage TO service_role;

REVOKE ALL ON public.google_api_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_api_usage TO authenticated;
GRANT ALL ON public.google_api_usage TO service_role;
ALTER TABLE public.google_api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_usage_admin ON public.google_api_usage;
CREATE POLICY api_usage_admin ON public.google_api_usage
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role = 'admin'
  ));

CREATE TABLE public.google_request_rate_buckets (
  user_id uuid NOT NULL,
  operation text NOT NULL CHECK (
    operation IN ('autocomplete','quote','details')
  ),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (user_id, operation, window_started_at)
);
GRANT ALL ON public.google_request_rate_buckets TO service_role;
ALTER TABLE public.google_request_rate_buckets ENABLE ROW LEVEL SECURITY;
-- Sem policies de cliente: contadores privados do servidor.

CREATE TABLE public.google_response_cache (
  user_id uuid NOT NULL,
  cache_kind text NOT NULL CHECK (
    cache_kind IN ('places_search_text','route_quote')
  ),
  request_hash text NOT NULL CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, cache_kind, request_hash),
  CHECK (expires_at > created_at),
  CHECK (
    (cache_kind = 'places_search_text'
      AND expires_at <= created_at + interval '30 days')
    OR
    (cache_kind = 'route_quote'
      AND expires_at <= created_at + interval '10 minutes')
  )
);
GRANT ALL ON public.google_response_cache TO service_role;
ALTER TABLE public.google_response_cache ENABLE ROW LEVEL SECURITY;
-- Cache por usuário, sem acesso direto do navegador.
CREATE INDEX google_response_cache_expiry_idx
  ON public.google_response_cache (expires_at);

CREATE OR REPLACE FUNCTION public.consume_google_request_limit(
  p_user_id uuid, p_operation text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $limit$
DECLARE
  v_max integer;
  v_count integer;
  v_window timestamptz := date_trunc('minute', clock_timestamp());
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required' USING ERRCODE='22023';
  END IF;
  v_max := CASE p_operation
    WHEN 'autocomplete' THEN 30
    WHEN 'quote' THEN 10
    WHEN 'details' THEN 20
    ELSE NULL
  END;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.google_request_rate_buckets AS bucket
    (user_id, operation, window_started_at, request_count)
  VALUES (p_user_id, p_operation, v_window, 1)
  ON CONFLICT (user_id, operation, window_started_at)
  DO UPDATE SET request_count = bucket.request_count + 1
    WHERE bucket.request_count < v_max
  RETURNING request_count INTO v_count;
  RETURN v_count IS NOT NULL;
END
$limit$;
REVOKE ALL ON FUNCTION public.consume_google_request_limit(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_request_limit(uuid,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_google_wrapper_tables()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $purge$
  DELETE FROM public.google_response_cache WHERE expires_at < now();
  DELETE FROM public.google_request_rate_buckets
    WHERE window_started_at < now() - interval '1 day';
$purge$;
REVOKE ALL ON FUNCTION public.purge_google_wrapper_tables()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_google_wrapper_tables()
  TO service_role;
```

## Detalhes técnicos da implementação após aprovação

- Um helper de servidor para Places, Routes e geocoding; chamadas de renderização do Maps JavaScript continuam no navegador, pois não podem passar por wrapper secreto.
- Identidade sempre da sessão verificada, nunca de parâmetro do cliente. Contadores atômicos por usuário/operação em janelas fixas de minuto; limite de cotação conta uma ação, não cada perna da rota nem o retry.
- Timeout de 5 segundos **por tentativa**, até duas tentativas apenas se primeira resposta for 5xx; não repetir 403/429, timeout ou falha de rede. Mensagens específicas para restrições Google.
- Log de cada tentativa real em `google_api_usage`: serviço, função, sucesso, código seguro e usuário; nunca tokens, chaves, texto de endereço ou GPS nos logs. Falhas de log não propagam para a ação principal.
- A execução em segundo plano durável ainda exige confirmar suporte do ambiente; `void insert()` sozinho não garante gravação após terminar a requisição. Não prometer log sempre persistido com zero atraso sem essa garantia.
- Cache privado por hash de parâmetros completos, incluindo modo, pontos, idioma e campos; lookup expirado não é usado. Cache da geometria não reutiliza autorização nem preço final: tarifas, elegibilidade e snapshot de cotação continuam revalidados.
- TTL solicitado: searchText 30 dias, rota 10 minutos; antes de persistir payloads Google, conferir as condições de armazenamento/atribuição aplicáveis. Reduzir conteúdo armazenado se exigido pelos termos, sem prometer cache incompatível.
- Buscas públicas F01 hoje não exigem sessão. Não bloquear pesquisas anônimas para atingir um limite por usuário; decidir um caminho público limitado seguro antes de conectar essas chamadas. Nenhum proxy Google público irrestrito será criado.
- Testes de limites exatos 30/10/20, concorrência real no banco após aprovação, TTL 30 dias/10 minutos, timeout, um retry 5xx, zero retries 403/429 e erro de log engolido. Sem teste live Google no sandbox.

## Arquivos, verificações e pendências

- Alterados apenas: memória de aprovação, `roadmap.md`, esta revisão, `GoogleHomeRideMap.tsx` (tipo duplicado removido), `ShellJourneyPlanner.tsx` (condições FLASH impossíveis dentro da seção AGENDADA removidas).
- Último sinal automático: **build OK**.
- Testes de área/shell/agendamento: **14 passaram, 1 falhou**; a falha exige preço Flash R$14,50 em `ShellJourneyPlanner.test.tsx:125`. Não foi mascarada nem atribuída automaticamente às mudanças.
- Não tocados: banco, migrations históricas, segredos, GPS/radar, avaliações, pagamentos, formulários, itens 4–6/8 e publicação.
- **Módulos:** F07/F08 e infraestrutura Google. **Status:** auditoria concluída; item 7 aguarda aprovação SQL e resolução das decisões acima. **README:** preservado, conflitos explícitos; não afirmado funcionamento ponta a ponta.

Ao aprovar, autoriza aplicar exatamente o SQL acima, validar a estrutura e implementar o item 7; a decisão D e o caminho público de F01 precisam de definição antes das alterações conflitantes.