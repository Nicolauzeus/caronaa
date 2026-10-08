# Home mobile: mapa e localização

## Auditoria

- A home usava um iframe OpenStreetMap; não havia instância Leaflet controlável.
- `RouteMap` continua atendendo outras telas, sem alterações nesta tarefa.
- O geocode existente usa Google quando configurado e Ceará Online (Photon/OSM, Nominatim). O reverse reutiliza Photon, sem novo fornecedor.
- Não foi encontrado motor real de rota viária. A home mostra pontos e bounds, sem linha reta apresentada como rota.
- Coordenadas existentes: `FormLocationDetails.lat/lng`, publicadas como `originLat/originLng` e `destinationLat/destinationLng`.
- O endpoint remoto `get_sts_ride_seed` retornou HTTP 404, PGRST202 nesta auditoria. A função sem argumentos existe na migration 0037; não está disponível no cache PostgREST conectado.
- Sem conexão administrativa, não é possível distinguir definitivamente migration ausente de cache desatualizado. O código público não executa DDL.
- HTTP em IP de rede não é contexto seguro para GPS. HTTPS (ou localhost para desenvolvimento) é necessário.

## Implementação

- `use-user-location.ts`: fix inicial automático em mobile, watch somente após sucesso, mensagens por falha, precisão, follow, recenter e limpeza.
- `HomeRideMap.tsx`: instância Leaflet única, tiles reais OSM com atribuição, ponto azul e halo de precisão, pontos de saída/destino, bounds e arrasto.
- `home.tsx`: origem automática/editável, opções de saída, origem STS opcional, coordenadas na publicação e falhas independentes.
- `LocationAutocomplete.tsx`: invalida buscas pendentes ao selecionar/limpar um endereço e limpa debounce no unmount; a lista não reabre após uma seleção.
- `ceara-online-provider.ts`, `service.ts`, `location.functions.ts`: reverse do fornecedor existente, timeout e fallback sem endereço inventado.
- `StsJourneyActivation.tsx`, `ride-activation.functions.ts`: mensagem compreensível na UI; código e mensagem técnica da falha registrados no servidor. Não se trata falha como ausência de inscrição.
- `repair-sts-rpcs.mjs`: aplica a definição canônica de 0037, recupera funções removidas e solicita reload do cache. Repetição validada em PostgreSQL isolado.
- `package.json` / lock: Leaflet 1.9 e tipos. O npm também sincronizou entradas de dependências já declaradas anteriormente no manifesto.
- `entities` 4.5.0 declarado como dependência de build: o alias existente de Vite exige essa versão na raiz; não depende mais de instalação manual fora do manifesto.
- Testes: hook GPS, mapa, home, reverse geocoding e reparo SQL pelo runner existente.

## Privacidade e limites

O watch não persiste nem envia posições continuamente. Coordenadas de um fix inicial/recenter são enviadas ao serviço de reverse e ao Photon para resolver endereço; não são guardadas como histórico. A publicação envia apenas a saída/destino escolhidos. O watch é suspenso quando a página fica oculta e removido no unmount.

O endereço não é reconsultado a cada movimento. Se a posição se afasta do endereço resolvido, a saída automática volta a ser identificada como localização atual, conservando coordenadas atualizadas. Origem manual ou STS nunca é sobrescrita pelo GPS, incluindo recenter.

Não há background tracking, motor viário, picker de mapa nem garantia de resposta GPS/reverse em três segundos. Permissões, precisão, rede e dispositivo podem exigir mais tempo; a entrada manual permanece disponível.

## Reparo remoto pendente

Gerar SQL para revisão/execução administrativa:

```sh
node scripts/repair-sts-rpcs.mjs
```

Aplicar com conexão administrativa configurada:

```sh
node scripts/repair-sts-rpcs.mjs --apply
```

O comando requer `LOVABLE_DB_MIGRATION_URL` e as migrations base, incluindo 0035 e RPCs canônicas de criação. Não utiliza chave pública ou bypass de autorização para criar viagens. A indisponibilidade STS não interfere no GPS/mapa/formulário manual.

Referências técnicas: [Leaflet 1.9](https://leafletjs.com/reference-1.9.4.html), [Geolocation watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition), [Photon reverse](https://github.com/komoot/photon).

## Verificação

- Testes criados: `src/lib/location/use-user-location.test.tsx`, `src/lib/location/reverse-geocoding.test.ts`, `src/test/home-ride-map.test.tsx`, `src/test/home-autocomplete.test.tsx`.
- Testes ampliados: `src/test/mobile-home.test.tsx`; ativação STS existente reexecutada em `src/test/sts-journey-activation.test.tsx`.
- Com os testes existentes de serviço/camada/mapa, 61 testes relevantes passaram.
- `npm test -- --maxWorkers=2`: 356 passaram e 7 falharam. As falhas existentes são em expectativas antigas de links públicos/formulário e argumentos opcionais de `ride-rpc-repair.test.ts`; não foram refatoradas nesta tarefa.
- `node scripts/test-ride-security.mjs --sts`: 58 verificações de segurança e 15 STS passaram em PostgreSQL real, incluindo reconstrução de RPCs removidas e repetição do reparo.
- `npx tsc --noEmit`, `npm run build` e `git diff --check`: passaram.
- Navegador: 360/375/390/412/430 px, tiles reais, reverse real, posição controlada pelo Playwright, permissão negada, preservação de saída manual, recenter e bounds com destino. Sem overflow horizontal. A página temporária de verificação foi removida.
- O teste em navegador não substitui validação com GPS físico e conta autenticada no ambiente conectado. Reparo remoto STS pendente por ausência de conexão administrativa.
