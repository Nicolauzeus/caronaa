# CARONAA Android — rastreamento F07 em segundo plano

- Compilar novo APK: o recurso depende de Java/Fused Location, não apenas da publicação web.
  Publicar também o servidor/cliente web com `POST /api/native/driver-location`.
- Ação explícita Online, autorização profissional, perfil MOTORISTA, consentimento e
  permissão de localização precisa são necessários. Não inicia no boot. Retomar com
  consentimento anterior apenas com Activity visível, sem pedir permissão sozinho.
- Canal silencioso separado de corridas_urgentes, notificação persistente com atalho
  para o aplicativo. Android pode restringir a exibição de notificações; permitir
  notificações e localização precisa nas configurações.
- FGS mantém Fused Location de alta precisão, atualização de 10 s, publicação até
  uma por 30 s quando a Activity está pausada. WebView mantém a publicação e UI em
  primeiro plano. O gate de rate limit existente protege breves transições.
- API nativa usa JWT do próprio motorista via HTTPS, tamanho limitado, schema estrito,
  papel e autorização reais, presença já online e pipeline Google/SQL comum.
  Ping só atualiza presença já online, nunca ativa disponibilidade. Sem dados de GPS
  em logs ou persistência de coordenadas/credenciais nativas. Sem migrations.
- O JWT de acesso permanece só na memória do processo; AuthProvider fornece tokens
  atualizados. Em caso de expiração com WebView suspensa, a transmissão pausa e
  a notificação pede reabertura para renovar sessão. Não guardar refresh token no
  serviço nem contornar as políticas de autenticação.
- Offline/logout/retirada de consentimento/troca de papel param serviço. Revogação
  remota retorna 403/409; serviço para. Force-stop, swipe da tarefa ou morte do
  processo não reiniciam automaticamente (START_NOT_STICKY, stopWithTask).
  Falhas de rede/GPS não fabricam presença: TTL do radar continua 90 s.
- APK legado ou navegador sem bridge nova mantém fluxo anterior. Não confundir
  serviço iniciado com publicação confirmada. Alertas FCM não foram alterados.

## Aceite em aparelho
1. Publicar servidor web e instalar APK assinado compatível. Motorista aprovado,
   conceder GPS preciso e notificações. Ficar online; confirmar posição real.
2. Minimizar por 2–5 min com tela apagada. Confirmar notificação persistente,
   atualização de `professional_driver_locations.sampled_at` e presença,
   sem coordenadas em logs. Retornar e verificar mapa sem recarga integral.
3. Testar ambos os pontos de ativação: Home Flash e cockpit.
4. Offline, logout, troca de papel, GPS negado, modo avião e sessão expirada.
   O serviço deve parar ou suspender, sem publicar depois da revogação e sem
   reativação automática de presença offline. Verificar TTL e FCM independente.
5. Validar Android 12/13/14, gestão de bateria e PWA. Não confundir checks
   estáticos com teste de dispositivo. GPS em segundo plano real requer teste
   físico; processo encerrado e expiração de sessão limitam continuidade.
