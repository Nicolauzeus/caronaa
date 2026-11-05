# CARONAA — Google Maps como padrão do radar da home

## Prioridade e fallback
1. A home tenta primeiro **Google Maps JavaScript API** usando a chave pública de navegador `VITE_GOOGLE_MAPS_BROWSER_API_KEY`.
2. Se não houver chave no build, se o script falhar ou a autenticação for recusada, a home exibe automaticamente o mapa antigo **Leaflet/OpenStreetMap**. O fallback continua funcional, não apenas comentado; remover o código deixaria usuários sem mapa.
3. Com o mapa Google carregado, o traçado visual tenta o Google Directions Service (legado). Se não estiver habilitado ou falhar, tenta a rota OSRM/OpenStreetMap **sobre o mapa Google**. Falha de rota não impede selecionar origem e destino.
4. A visualização da rota é independente da cotação e do matching no backend. Não alterar o preço baseado apenas na distância exibida no mapa.

As duas implementações compartilham a altura, o botão de centralização e os marcadores de localização, saída, destino e motoristas aproximados. Em DevTools, verificar o atributo `data-map-provider` (`google` ou `openstreetmap`).

## Chaves e segurança
- **Nunca versionar** `.env` contendo valores reais. `.gitignore` já ignora `.env` para arquivos ainda não rastreados; o arquivo anteriormente rastreado foi retirado da main.
- A chave Google Maps Browser publicada anteriormente em commits precisa ser **revogada e substituída** no Google Cloud. Excluir `.env` da main não elimina a chave do histórico.
- Configurar uma **nova** chave dedicada ao navegador em `VITE_GOOGLE_MAPS_BROWSER_API_KEY` **no ambiente de build/deploy** do CARONAA. Apenas colocar a variável em Lovable Secrets do backend não a disponibiliza automaticamente para `import.meta.env`.
- Restringir a chave pública por **HTTP referrers** dos domínios efetivos do CARONAA e por **APIs autorizadas**. Habilitar Maps JavaScript API e faturamento; validar as permissões do serviço de rotas.
- A chave `GOOGLE_MAPS_API_KEY` ou `GOOGLE_PLACES_API_KEY` continua exclusiva do servidor para o serviço de Places. Não reutilizar a chave privada na API JavaScript.
- Uma chave `VITE_*` é necessariamente visível no navegador; as restrições Google Cloud são obrigatórias para mitigar uso indevido.

## Rotas Google e compatibilidade em 2026
- O Google Directions Service usado nesta etapa é **legado**. O Google informa que, desde outubro de 2026, novos projetos não podem habilitar a API Directions (Legacy). Projetos existentes podem continuar a utilizá-la.
- A biblioteca JavaScript Routes com `Route.computeRoutes` é a substituição recomendada. A migração e homologação dessa funcionalidade devem ser feitas separadamente, considerando disponibilidade, faturamento e comportamento do serviço.
- Até lá, o traçado tem fallback OSRM. Outras telas com mapas e rotas permanecem no fornecedor atual; este PR abrange o radar da **home**, sem alterar fluxo de pedidos, cotações ou banco de dados.

## Verificação antes da publicação
1. Confirmar chave nova e restrita no build, sem expô-la no GitHub. Republicar para garantir nova compilação.
2. Home em desktop e celular Android/iOS: conferir mapa Google visível com altura correta, GPS autorizado/negado e centralização.
3. Com endereço de origem e destino, verificar marcadores, percurso e os indicadores de distância/tempo; comparar sem vincular visualização ao preço.
4. No DevTools e em métricas do Google Cloud, verificar a chamada a `maps/api/js`, faturamento/quota e ausência de `RefererNotAllowedMapError`.
5. Simular chave ausente, script bloqueado e falha de autenticação: confirmar que OpenStreetMap é exibido automaticamente, sem mapa branco.
6. Simular Google Directions negado: confirmar rota OSRM sobre o mapa Google ou mensagem amigável se ambos indisponíveis.
7. Executar lint, TypeScript, build e smoke tests de `/home` antes da publicação. Não foi possível executar esses testes somente pela integração GitHub.

Links oficiais: https://developers.google.com/maps/documentation/javascript/error-messages e https://developers.google.com/maps/documentation/javascript/legacy/directions
