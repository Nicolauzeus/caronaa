# CARONAA F07 — Mapas sem piscar, UX e consumo das APIs

**Escopo:** Mapas Google das telas de passageiro e motorista, Cockpit F07, folha inferior mobile, atualizações GPS e rotas.
**Incidente:** gravações móveis de 18/11/2026 (43 s e 8,6 s).

## Problema observado
- No passageiro, o painel e o mapa mudavam de modo durante a viagem, com episódios de mapa cinza/sem detalhes e retorno transitório ao preço/cotação.
- No motorista, publicações GPS trocavam o título/posição do marcador e podiam provocar sua recriação.
- O código montava o painel F07 em duas posições condicionais conforme a altura da folha; um re-render/remount podia perder estado local, refazer a consulta e reinicializar mapa.
- A Home removia todos os marcadores e círculos a cada leitura de GPS/radar.
- O mapa operacional removia polylines para recriá-las em todo update e reenquadrava ao redimensionar a folha.
- Existiam consultas Supabase periódicas (cadência distinta por estado) e rotas Google calculadas separadamente.

## Regras de UX (motorista + passageiro)
1. **Mapa persistente durante o mesmo estado operacional.** Troca de fase muda informações e ícones, não desmonta o painel por causa de swipe na folha inferior.
2. **Marcador de identidade estável.** Mesmo motorista mantém ID próprio; atualiza `setPosition` sem piscar. Títulos como "GPS publicado" ou "GPS local" não determinam a chave.
3. **Linha de rota persistente.** Enquanto geometria/etapa não mudar, não recriar `Polyline`, não pedir nova rota nem reenquadrar a câmera.
4. **Posição GPS não é endereço.** Atualizar posição local usa `navigator.geolocation`; geocodificação reversa requer limiar de deslocamento e TTL, não a cada batimento GPS.
5. **Feedback não invasivo.** Em polling de fundo não apagar cotação, painel, marcador, QR, rota ou tela. Indicadores de carregamento só no primeiro carregamento relevante.
6. **GPS degradado.** Por até 30 s, uma localização autenticada anteriormente pode permanecer na visualização como "**última posição conhecida — não ao vivo**". Não usar no despacho ou como GPS válido; após expirar ocultar.
7. **UX mobile-first.** Área principal em preto `#121212`, CTA amarelo `#FFBB00`, rótulos consistentes de embarque/destino e estados, ações com alvo mínimo 44px, respeitar `prefers-reduced-motion`.
8. **Sem bloqueio por renderização.** Estado terminal ou `PENDING_REVIEW` vem do servidor; transições para Pix/avaliação não devem deixar o painel preso.

## Atualizações e despesas: separar três serviços

| Evento | Meio adequado | Gera consulta Google? |
|---|---|---|
| Sensor GPS em movimento | `navigator.geolocation.watchPosition`, sensor do aparelho | Não por si só |
| Publicação GPS profissional | RPC Supabase com guard de precisão e prazo | Não por si só; backend pode executar Geocoding para validar município |
| Mudança da corrida/fila | Supabase Realtime via WebSocket; consulta protegida após evento | Não |
| Recuperação de perda de socket | Polling limitado no Supabase, só quando necessário | Não |
| Mover ícone e ajustar zoom em mapa já existente | API Google Maps JavaScript, objeto local do mapa | Não é uma nova consulta ao Routes |
| Criar novo mapa JS `new google.maps.Map` | Maps JavaScript Dynamic Maps | Pode gerar novo carregamento faturável |
| Calcular/atualizar rota | Google Routes / backend | Pode gerar nova solicitação faturável |
| Resolver rua/cidade de coordenadas | Geocoding / Places | Pode gerar cobrança separada |

**Não confundir Webhook com WebSocket.** Um webhook envia requisições HTTP ao endpoint servidor em eventos; não é uma conexão de navegador que fica "em aberto". A assinatura WebSocket mantém a sessão e entrega eventos, sem consultar Google.
No F07 já existe `useQuickRideRealtime` com `postgres_changes` na fila municipal e fallback a 60 s apenas se não estiver conectado. O passageiro continua consultando seu pedido com RPC autorizada durante a corrida, pois a fila profissional não é um canal de dados privados do passageiro. **Não** assinar tabelas de localização brutas sem política RLS; eventual melhoria é um Supabase Broadcast privado por ID de corrida com autorização server-side.

## Correções de código
- `ShellJourneyPlanner`: uma instância do painel passageiro durante peek/half/full; sem montar uma nova em cada posição da folha.
- `GoogleHomeRideMap`: mantém instâncias `Marker`/círculo, altera coordenadas; altura da folha deixa de disparar cálculo de rota.
- `GoogleMapSurface`: adiciona ID estável opcional, preserva `Polyline` pela impressão digital da geometria, sem `fitBounds` no resize da folha.
- `QuickRideOperationalMap`: deduplica Google Routes por viagem/destino com TTL limitado de 10 min e limite de entradas; consultas de contexto não reiniciam a cada render; preserva última leitura autenticada por até 30s com aviso explícito de stale.
- `ProfessionalAvailabilityPage`: mapa não desaparece na transição de aceitação; marcador `self-professional` e `smoothTracking` para não reconstruir pontos.
- `home.tsx`: radar visual deixa de indicar loading em toda consulta, evita RPCs de descoberta quando já existe corrida atribuída e deduplica estado idêntico.

## Orçamento e observabilidade
O código sozinho não comprova redução de fatura. Validar no Google Cloud Console:
- Maps JavaScript API — contagem SKU Dynamic Maps por sessão e por mudança de fase;
- Routes API — requisições `Compute Routes` por viagem e por minuto;
- Geocoding/Places — volume e códigos 429;
- métricas do Supabase — mensagens Realtime, joins, consultas e erros.

Roteiro manual:
1. iPhone Safari e Android Chrome: manter corrida aberta 2 min, trocar sheet peek/half/full sem remontagem do mapa.
2. GPS com deslocamento controlado: marcador se move, sem desaparecer; rede degradada exibe "última posição" (máximo 30 s), sem inventar GPS.
3. Aceitação/embarque/viagem/conclusão: mapa não retorna à cotação ao receber ping transitório.
4. Contagem de chamadas no DevTools/Cloud: trocar altura não gera nova `getMapDrivingRoute` nem `new Map`; GPS pulsando não refaz a mesma rota.
5. Rota operacional: no mínimo uma rota ao mudar para IN_PROGRESS quando houver GPS validado; repintura/refresh não recalcula a mesma rota.
6. Confirmar que nenhum evento Realtime revela dados privados a outro usuário.
7. Desativar GPS ou trocar de aba e voltar: nenhum loop de reconexão excessivo; nova posição publicada deve ser real e recente.
8. Contrastar screenshots motoristas e passageiros: mesmos estados, botões e identidade.
9. Executar Vitest e CI antes de afirmar homologação de produção.

## Segurança de rollout
Não requer nova migration. A RN020 de encerramento (migration 0210) é separada e deve continuar ativa. Não publicar se o banco estiver sem as RPCs necessárias.
