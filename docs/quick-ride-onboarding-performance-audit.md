# Auditoria de carregamento pós-onboarding e custo Google Maps

## Escopo e evidências revisadas
- `src/routes/onboarding.tsx`: carrega progresso, participações e sugestões; ao concluir, verifica estado de lançamento, salva onboarding e resolve destino. Há operações de rede em série no momento do ingresso.
- `src/routes/_authenticated/home.tsx`: o `beforeLoad` consulta autenticação, entrada administrativa, progresso e destino pós-onboarding; a Home também carrega viagens, pesquisa radar profissional a cada 15 segundos quando modalidade exclusiva está ativa, pesquisa viagens pendentes a cada 15 segundos e realiza geocodificação reversa de coordenadas de GPS.
- `src/lib/quick-rides/use-quick-ride-realtime.ts`: WebSocket já é primário para a fila rápida, com fallback HTTP de 60 segundos apenas quando desconectado.
- `src/lib/session-request-cache.ts`: cache em memória com promessa compartilhada e expiração; não é persistente entre reinicializações.
- `src/lib/quick-ride-map.functions.ts`: aproximação do motorista faz cache de rota por minuto e não calcula nova rota a cada posição.
- `src/components/caronaa/GoogleMapSurface.tsx`: o mapa é inicializado uma vez; a branch introduziu atualização suave de marcadores.

## Correção aplicada nesta branch
A Home passa a solicitar geocodificação reversa apenas após movimentação significativa (75 m) ou expiração de 120 s, com deduplicação de solicitações por posição arredondada; o GPS continua atualizando a coordenada real independentemente do endereço. Mudanças manuais de origem não fazem lookup automático.

## Estratégia recomendada
1. Estado da corrida: eventos Supabase Realtime. Reconciliar por RPC em abertura, reconexão e mudança de visibilidade; fallback quando desconectado.
2. Posição do motorista: atualizações da localização consentida e publicadas no Supabase; interpolar marcador localmente sem usar APIs do Google para cada pulso.
3. Rotas: Google Routes apenas no aceite, no embarque confirmado, em mudança relevante de destino ou desvio persistente. Cache por contexto de viagem e waypoint, com limite de concorrência por sessão e tratamento de falhas.
4. Reverse Geocoding: apenas para origem escolhida/alterada e deslocamento material; preferir rótulo existente enquanto o GPS se move.
5. Places: Autocomplete com debounce, token de sessão e busca restrita aos campos indispensáveis.
6. Maps JavaScript: inicializar uma instância por tela; atualizar a posição dos marcadores e os trechos visíveis sem remount.

## Pendências de validação
- Sem logs de desempenho de aparelho: a causa exata do travamento permanece **não confirmada**.
- Registrar tempo de `beforeLoad`, tempo até primeiro mapa utilizável, quantidade de RPCs simultâneas, taxa de reconexões, FPS e duração das tarefas longas.
- Testar em dispositivo de memória limitada e com internet lenta durante o cadastro, redirecionamento, retorno ao app e transições de corrida.
- Reavaliar os dois polling de 15 segundos da Home; não substituir por eventos sem confirmar cobertura e RLS.
- Confirmar billing por SKU no Google Cloud e métricas de Requests (Maps JavaScript, Places, Geocoding e Routes). **Não há metas de economia verificadas**.
- Executar build/typecheck e testes; nenhuma aprovação de produção ou alteração em main deve preceder esses gates.
