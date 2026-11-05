# CARONAA — migração controlada para Google Maps (primeira etapa)

## Estado
A branch `feat/google-maps-migration` integra a tela inicial/radar ao Google Maps JavaScript API, usando Google DirectionsService para a rota visual da home. Mantém OpenStreetMap/OSRM como fallback quando não há chave pública configurada ou quando o script Google Maps falha ao carregar.

**Não está homologado para produção.** Não remover o provedor legado antes de validar os fluxos no dispositivo e o consumo de API. O Google Routes API (servidor), as demais telas e a retirada definitiva do OSRM permanecem pendentes.

## Credenciais
- Configurar `VITE_GOOGLE_MAPS_BROWSER_API_KEY` no ambiente de build para **uma chave de navegador dedicada**, com restrições de aplicativo do tipo HTTP referrers aos domínios CARONAA e restrições de API para Maps JavaScript API e Directions/rotas usadas pelo Maps JavaScript.
- A chave de navegador torna-se visível no bundle cliente por definição. **Não usar nela a chave secreta do servidor** `GOOGLE_MAPS_API_KEY` / `GOOGLE_PLACES_API_KEY`, mesmo se já estiver guardada no Lovable.
- A chave de servidor deve ficar restrita ao backend e aos serviços necessários. Não incluir a chave em commits, URLs públicas, logs ou mensagens.
- Confirmar faturamento, APIs habilitadas, restrições, quotas e alertas de orçamento no Google Cloud.
- `VITE_...` é resolvida no build; reiniciar/republicar após configurar. Um segredo privado criado no Lovable **não passa automaticamente** para `import.meta.env` no navegador.

## Homologação
1. Testar mapa da home e radar em celular Android/iOS (GPS permitido e negado).
2. Testar pontos de origem/destino, distância, tempo, atualização e recenter.
3. Conferir navegador e Google Cloud Metrics para validar chamadas Google, não apenas uma imagem de mapa.
4. Testar fallback sem chave ou com bloqueio de script e confirmar nenhum mapa em branco.
5. Validar acessibilidade, privacidade, cobrança e limite de solicitações.
6. Substituir OSRM nos demais módulos **em uma segunda etapa**, passando dados pelo backend quando necessário.

Nenhuma migration SQL é necessária para esta primeira alteração de interface.
