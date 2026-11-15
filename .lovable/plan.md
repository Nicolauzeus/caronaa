# CARONAA — correção de permissões herdadas para aprovação

## Resultado da aplicação autorizada

O SQL previamente aprovado foi aplicado **sem alterações** em `drizzle/migrations/0125_google_wrapper_limits_private_cache.sql`, com tipos regenerados. A nova entrada é idx 125, timestamp 1794776046450, posterior à 0124 (1794774953478). Nenhum histórico anterior foi editado.

Verificação somente leitura confirmou:

- `google_api_usage`: policy administrativa agora somente **SELECT**; anon sem SELECT e authenticated sem INSERT.
- `geocoding_cache`: nenhuma policy de cliente.
- `v_google_api_daily_usage`: `security_invoker=true`, anon sem grants e authenticated somente SELECT.
- `google_request_rate_buckets` e `google_response_cache`: existem e possuem **RLS ativo, sem policies**. Portanto anon/authenticated não conseguem ler ou escrever suas linhas.

Entretanto, o ambiente concedeu automaticamente privilégios de tabela a anon/authenticated na criação das duas novas tabelas. Os GRANTs exclusivos ao servidor não removem esses privilégios herdados. Para cumprir também a restrição de privilégios — além do bloqueio RLS já existente — é necessária a correção abaixo.

## SQL adicional completo — NÃO aplicado

```sql
REVOKE ALL ON public.google_request_rate_buckets
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_request_rate_buckets TO service_role;

REVOKE ALL ON public.google_response_cache
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_response_cache TO service_role;
```

Após aprovação, aplicar somente esse SQL incremental e confirmar grants/RLS. Em seguida continuar o item 7 já aprovado; não alterar GPS, descoberta pública, pesquisas anônimas ou pagamentos para contornar os bloqueios apontados na revisão anterior.

## Status da entrega

- **Módulos:** infraestrutura Google/F07/F08.
- **Atual:** estrutura do item 7 aplicada e verificada; conexão do controle central ainda não implementada.
- **Arquivos:** migration 0125 e tipos gerados pela ferramenta; `roadmap.md` atualizado. Nenhum segredo alterado.
- **Testes/sinais:** último sinal automático **build OK**. Resultados anteriores permanecem: 14 testes passaram, 1 de interface Flash falhou; teste estático de self-radar falha também na revisão anterior.
- **Pendências:** aprovação desta correção adicional; implementação/testes do wrapper; confirmar mecanismo durável de logs sem atraso; definir compatibilidade de armazenamento Google e o caminho seguro para buscas públicas. D permanece pendente para não contrariar o README.
- **Não tocados:** radar/GPS, lifecycle, avaliação, Pix, formulários, itens 4–6/8 e publicação.
- **README:** regras preservadas, sem alegação de validação ponta a ponta. Uso real de Google permanece não verificado; testar depois em origem publicada autorizada.