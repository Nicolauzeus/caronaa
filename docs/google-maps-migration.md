# CARONAA — mapas exclusivamente Google

A home, o acompanhamento de viagens, a comparação de desvios e as prévias dos
formulários utilizam somente Google Maps JavaScript API. Nenhuma falha carrega
outro fornecedor. Chave ausente, rede indisponível, timeout ou autenticação
recusada exibem erro nas cores #FFBB00/#121212 e a ação Recarregar mapa.
O endereço manual e o catálogo local de polos/universidades continuam disponíveis.

## Configuração

A resolução de chave pública respeita esta ordem, ignorando valores vazios:

1. `process.env.GOOGLE_MAPS_BROWSER_API_KEY`
2. `process.env.GOOGLE_MAPS_API_KEY`
3. `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY`
4. `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

O navegador consulta a função de servidor primeiro e usa as variáveis Vite se
ela não responder. A chave selecionada para Maps JavaScript é pública, inclusive
quando o segundo nome é usado. Configure preferencialmente uma chave dedicada ao
navegador, com HTTP referrers de caronaa.com, www.caronaa.com e dos previews realmente
utilizados. Não coloque valores reais no Git. Restrições de chave, faturamento e
APIs habilitadas devem ser conferidos no Google Cloud.

`GOOGLE_MAPS_API_KEY` autentica as chamadas POST de Google Routes no servidor.
Habilite Routes API. A busca de endereços usa Google Places API (New) no servidor e o GPS usa
Google Geocoding API v4. A prioridade de credencial REST é `GOOGLE_MAPS_API_KEY`,
`GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` (binding de servidor ou build).
Habilite as APIs correspondentes e Maps JavaScript API para o navegador.
Uma chave com restrições exclusivas de navegador não serve automaticamente para
chamadas REST do servidor; as duas credenciais dedicadas evitam esse conflito.

## Rotas e privacidade

`road-routing.ts` usa `directions/v2:computeRoutes`, com pontos intermediários na
ordem recebida, modo DRIVE e retorno de geometria GeoJSON, metros, duração e etapas.
Valida as coordenadas, as métricas e cada etapa; falhas não geram distância em
linha reta nem tarifa substituta. A regra R$ 6 por 11 km e as autorizações das
cotações, publicações e propostas permanecem nos serviços existentes.

`map-routing.functions.ts` oferece somente uma prévia de leitura (2–16 pontos),
sem gravar GPS, criar viagens ou cotar pagamentos. O acompanhamento mantém
cancelamento de requisições obsoletas e arredondamento para evitar consultas a
cada pequena oscilação do GPS. As autorizações de localização existentes continuam
obrigatórias. Os pontos necessários ao traçado são enviados ao Google.

O catálogo Ceará permanece local e disponível sem consulta externa. Endereços
fora do catálogo podem ser informados manualmente sem coordenadas inventadas.

## Verificação

- `bunx vitest run`: regressão geral e testes de chave, carregador, erro de domínio,
  mapa, atualização de GPS, rotas ordenadas, respostas inválidas e endereço por GPS.
- `tsc --noEmit` e `npm run build`: tipos e compilação.
- No domínio publicado: verificar `data-map-provider="google"`, carregamento de
  `maps.googleapis.com/maps/api/js`, marcadores, GPS, rotas e centralização em
  desktop/mobile. Simular rede indisponível e chave recusada: deve haver somente
  erro/recarregamento. A execução automatizada com mocks não homologa credenciais,
  billing, quota, referrers ou o deploy de caronaa.com.

Referência: https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes

## Resultado desta migração

- Suíte completa: 168 arquivos, 931 testes aprovados (`bunx vitest run --maxWorkers=4`).
- TypeScript: `tsc --noEmit` sem erros.
- Build de produção: cliente, servidor e Nitro compilados com sucesso.
- Conferência após formatação: 11 testes de home/carregador/roteamento aprovados.
- Busca no código de execução, manifesto e lockfile: nenhum provedor retirado restante.
- Limitação da cópia de validação: o conector não entregou o PNG binário original
  `summitdesktop.png` (>1 MB). Somente para resolver esse import durante testes/build,
  foi usada uma cópia local da imagem mobile original. Nenhum asset é alterado neste
  commit; a árvore remota preserva o PNG original. A validação comprova compilação e
  comportamento automatizado, sem homologação visual desse asset ou do domínio.
- A configuração e a homologação real de Google Cloud/caronaa.com continuam pendentes.

Módulos: F01, F03, F05, F06, F07 e F08. O README permanece alinhado: tarifa rodoviária,
consentimentos e permissões preservados; sem mudança de banco nem regras comerciais.


## Places API (New) e precisão de endereço

- Autocomplete: POST `https://places.googleapis.com/v1/places:autocomplete`,
  `includedRegionCodes: ["br"]`, `languageCode: "pt-BR"` e viés circular de
  50.000 m em (-3.7319, -38.5267). Esse viés não bloqueia buscas na UNILAB/Redenção.
- Details: GET `/v1/places/{placeId}`, com campos `id,displayName,formattedAddress,location,addressComponents`.
- Texto livre: POST `/v1/places:searchText`, com máscara explícita, idioma pt-BR e região BR.
- GPS: GET `https://geocode.googleapis.com/v4/geocode/location/{lat},{lng}`;
  Text Search não é um serviço de geocodificação reversa. O GPS autorizado permanece
  na posição original, mesmo quando o Google retorna o endereço do prédio próximo.
- Todos os pedidos REST usam `X-Goog-Api-Key` e timeout; erros externos não retornam
  chave, URL de requisição ou mensagem bruta do provedor para a interface.
- Credenciais iguais às variáveis dedicadas Maps Browser são recusadas no backend.
  Restrições configuradas no Google Cloud não podem ser descobertas pelo valor da
  chave: configure credenciais REST apropriadas, APIs autorizadas e restrições por IP
  quando aplicáveis. Erros de permissão não provocam troca para uma chave de navegador.
- Configure Places API (New), Geocoding API v4 e Routes API no projeto. Maps JavaScript
  continua com credencial própria para o navegador. A função de status compartilha
  a mesma resolução de credenciais do provedor, sem retornar valores de chaves.

Predições oficiais aparecem com o nome principal, endereço secundário e procedência
Google Maps. A seleção pede Details sem debounce adicional e entrega coordenadas,
bairro, município, UF e CEP por `onChange`/`onSelect`. Uma resposta atrasada não
sobrescreve seleção cancelada ou texto novo. Falhas preservam a digitação, sinalizam
coordenadas ausentes e não inventam latitude/longitude nem calculam cotação fictícia.
O mapa resolve texto livre pelo servidor antes de recorrer ao catálogo aproximado.

O catálogo continua imediato/offline, com procedência separada do Google. Foi
acrescentada uma referência aproximada da UNILAB — Campus das Auroras, identificada
como aproximada; não é uma entrada de embarque verificada. Fonte: repositório oficial
UNILAB, trabalho de Paulo Christian Queiroz Braga (2023), coordenadas da instalação
solar no campus, https://repositorio.unilab.edu.br/jspui/bitstream/123456789/5041/1/PAULO%20CHRISTIAN%20QUEIROZ%20BRAGA.pdf.

Os testes de UNILAB, UNIFOR, Aldeota e Maracanaú cobrem contratos New e o fallback
local com coordenadas. As respostas Google dos testes são mocks. Não havia credencial
REST disponível neste ambiente para homologação de buscas ao vivo; domínio publicado,
quotas, faturamento e restrições devem ser validados após o deploy.

Validação Places New: 168 arquivos / 937 testes aprovados; TypeScript sem erros;
build cliente/servidor/Nitro aprovado. Mantida a mesma limitação do asset binário
local descrita acima; nenhum asset é publicado nesta alteração.
