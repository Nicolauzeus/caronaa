# Android Capacitor — Fase 2 (F07/F08, ciclo de sessão F02)

## Entregue
- Plugins oficiais exatos (Capacitor 6): `@capacitor/push-notifications@6.0.5`, `@capacitor/local-notifications@6.1.3`, `@capacitor/app@6.0.3`. Geolocation não incluído (fase futura). `package.json`, `bun.lock` e `package-lock.json` atualizados por `bun add --exact` e `npm install --package-lock-only`.
- `src/lib/native/capacitor-bridge.ts`: `isNativeAndroid()` (SSR-safe, via `Capacitor.isNativePlatform()`/`getPlatform()`), `setupAndroidNotificationChannels()` (idempotente, só cria se ausente, no-op na web), `hasNativeFirebaseConfig()`, `onNativeAppResume()` com cleanup à prova de corrida.
- `src/lib/native/driver-notifications.ts`: abstração única de permissão. Web mantém o fluxo Web Push original. Android usa `LocalNotifications.checkPermissions/requestPermissions`, nunca `Notification.requestPermission`, Service Worker nem RPC de Web Push.
- Canal nativo `corridas_urgentes` criado em `MainActivity.onCreate` por `RideAlertChannel.java`: IMPORTANCE_HIGH, vibração `{0,500,250,500}`, luz #FFBB00, `VISIBILITY_PRIVATE`, som próprio `res/raw/caronaa_ride_alert.wav` (WAV original gerado, ~36 KB), `USAGE_NOTIFICATION`. Nunca apaga/recria o canal. Sem full-screen intent, DND ou SYSTEM_ALERT_WINDOW.
- Plugin Java `CaronaaNative.firebaseStatus()` (somente leitura): indica se o APK foi compilado com `google-services.json` real. `PushNotifications.register()` só roda nesse caso; o token não é registrado em log nem persistido.
- Manifest: canal padrão FCM, ícone monocromático `ic_stat_caronaa` e cor #FFBB00.
- APK: avisos de instalação PWA ocultos (`PwaInstallNotice`, `DriverPwaPromotionCard` via `isStandaloneApp()`), `registerPwa`/`requestPersistentStorage` inativos. Retorno ao app (`appStateChange`) revalida a sessão no AuthProvider e dispara `caronaa:app-refresh`, sem logout nem pedido de permissão.
- Painel Flash: diálogo explicativo quando a permissão ainda não foi decidida; "Agora não"/recusa seguem para ficar online. No APK sem Firebase, aviso honesto: permissão concedida, mas alertas com app fechado ainda indisponíveis.

## Limites conhecidos
- Android 13+: permissão de notificação é do usuário; o canal (som/vibração/importância) passa a ser controlado por ele após a criação. Fabricantes podem limitar a importância.
- FCM: falta `google-services.json`, emissão autenticada de token e backend de envio (fase futura). Sem isso, não há alerta com o app fechado no APK.
- Não há garantia de heads-up nem de exibição na tela bloqueada; economia de bateria e políticas do Google Play podem atrasar entregas.
- Teste local de som não foi adicionado nesta fase.

## Validação (27/11/2026)
- `bunx vitest run`: 1857 testes, 1852 passaram, 5 falharam — todos em `src/test/location-layer.test.ts` (geocodificação), arquivo sem relação com esta fase.
- Testes novos `src/test/android-capacitor-phase2.test.ts`: 18/18.
- `npx tsc --noEmit`: OK. `npm run android:check`: fases 1 e 2 OK. `npm run build`: OK. `npx cap sync android`: OK (3 plugins). `git diff --check`: OK.
- Gradle/APK não compilado aqui: Java e Android SDK ausentes no ambiente. O workflow existente da fase 1 ou um ambiente com JDK 17 + SDK 34 deve executar `npm run android:build:debug`.
