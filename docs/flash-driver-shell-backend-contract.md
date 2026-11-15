# CARONAA — Contrato necessário do Flash Motorista (Casca Única)

Estado: **frontend preparado; SQL NÃO executado**. As RPCs abaixo não foram
encontradas nas migrations versionadas do repositório quando esta etapa foi criada.
Verificar primeiro o catálogo real de funções no Lovable Cloud/Supabase. Criar
somente migrations aditivas após revisão explícita.

## Fontes reutilizadas

- `quick_ride_my_requests()`: consulta autenticada para recuperar viagem ativa do motorista.
- `quick_ride_transition(p_id, p_status='ARRIVED')`: chegada validada com GPS no servidor.
- `quick_ride_start_with_code(p_id, p_code)`: PIN existente.
- `quick_ride_map_context` / `getQuickRideApproach`: mapa autorizado de chegada.
- `useQuickRideRealtime`: sinais municipais na `caronaa_quick_queue_events`; payload não contém PII.
- `getMapDrivingRoute` / `formatGeoJsonLineString`: rota única e GeoJSON [lng,lat].

## Novas RPCs esperadas (NÃO CONSIDERAR EXISTENTES)

1. `set_flash_driver_online`:
   - online: `p_online=true`, `p_booking_mode: ALL|ON_ROUTE|EXCLUSIVE`,
     `p_seats`, `p_vehicle_type: CAR|MOTO`, `p_destination_lat/lng/label`
     opcionais e `p_route_path` GeoJSON LineString ou NULL;
   - offline: `p_online=false`;
   - resposta positiva: boolean true, ou `{online:true|false}` /
     `{success:true}`;
   - autenticar `auth.uid()`, verificar elegibilidade, comissão pendente,
     veículo/vagas e município autorizado. **42501** requer diagnóstico seguro;
     não usar a falta de autenticação para fingir uma dívida de comissão.

2. `update_flash_driver_heartbeat_gps(p_lat,p_lng,p_accuracy_m)`:
   - autenticar o proprietário da presença;
   - rejeitar amostras fora das zonas aprovadas, inválidas ou imprecisas
     conforme política operacional e enviar resposta `true`, `{success:true}`
     ou `{published:true}`;
   - **sem Google Geocoding por amostra**;
   - TTL obrigatório de **60 segundos desde a última fixação real** validada,
     com desativação automática no servidor; não aceitar um timestamp enviado
     pelo navegador como prova de amostra nova;
   - o browser não pode garantir RPC no `beforeunload`.

3. `get_flash_driver_radar_orders()`:
   - retornar somente ofertas realmente elegíveis para o motorista autenticado,
     respeitando capacidade residual, modo, corredor e expiração;
   - projeção mínima: `ride_id,mode,seats,distance_km,driver_earnings,
     pickup_label,dropoff_label,expires_at`;
   - valores monetários vêm do backend, nunca de cálculo no card.

4. `respond_flash_order(p_ride_id,p_accept)`:
   - resposta aceita: `true`, `{status:'ACCEPTED'}` ou `{accepted:true}`;
   - recusada: `true`, `{status:'REJECTED'}` ou `{rejected:true}`;
   - validar autorização, GPS, prazo, vagas e estado com **transação atômica**.
     concorrência perdida => `ALREADY_TAKEN`.
   - não recriar/modificar funções F07. Se houver integração com corridas
     existentes, manter identificadores compatíveis com
     `quick_ride_my_requests` e `quick_ride_map_context`.

5. `get_flash_passenger_details(p_ride_id)`:
   - projeção **apenas após aceite autorizado**:
     `name, photo, whatsapp, seats_remaining`;
   - isolar PII por autenticação e participação efetiva na viagem;
   - não replicar número ou foto via Realtime.

## Limites / riscos abertos

- Casca de `useActiveRole` suporta hoje carros com 1–3 vagas; a nova UI Flash
  solicita até 4. Banco precisa validar capacidade real, não confiar no select.
- Continuar ouvindo ON_ROUTE durante viagem ativa exige uma operação
  **multi-reserva/multi-embarque** real no backend e disponibilidade de
  `seats_remaining` autorizada. Frontend só exibe chamadas adicionais
  quando o servidor afirma haver vagas.
- O mapa da corrida aceita reutiliza a função existente
  `quick_ride_map_context`. Se as novas RPCs persistirem corridas em outra
  entidade, providenciar integração **aditiva**, sem alterar F07.
- Rodar `bunx vitest run src/components/caronaa/shell/`,
  `bunx vitest run src/services/flash-driver-service.test.ts`,
  `bunx vitest run src/hooks/use-flash-driver-presence.test.ts`.
  Não declarar testes aprovados sem execução.

## Política de implantação

Não aplicar SQL sem mostrar migrations, autorizar e testar RLS/concorrência.
Não reter Pix, não alterar Asaas, comissões nem serviços legados.
