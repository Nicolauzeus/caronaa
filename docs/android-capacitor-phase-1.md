# CARONAA — Android / Capacitor, fase 1

Escopo F02/F07/F08: base de homologação conectada, sem alterar autenticação,
corridas, Pix, GPS web, PWA, consentimento ou banco.

- Capacitor 6.2.1; min SDK 24; target/compile SDK 34; JDK 17; AGP 8.2.1.
- ID com.caronaa.app, nome CARONAA, origem https://caronaa.com.
- TanStack Start é SSR. native-shell contém apenas fallback local e ícone PWA.
- HTTPS obrigatório, sem cleartext, mixed content, allowNavigation ampla ou depuração.
- server.url é destinado a live reload pelo Capacitor; esta fase é homologação.
  Revisar fronteira de origem, OAuth Google via navegador do sistema, deep links,
  CSP e segurança antes de distribuir ou expor plugins privilegiados.
- Google Play exige API 36 para novos apps e atualizações desde 31/08/2026.
- Estrutura baseada no template oficial Capacitor 6.2.1 (MIT).

## Preparar

Node 22, JDK 17, Android SDK 34.
Gerar os lockfiles com npm install --package-lock-only e bun install --lockfile-only
se ainda não estiverem sincronizados. Depois:

    npm ci
    npm run android:check
    npm run android:sync
    npm run android:build:debug
    npx tsc --noEmit
    npm test
    npm run build

Windows: executar npm run android:sync, entrar em android e executar gradlew.bat assembleDebug.
APK: android/app/build/outputs/apk/debug/app-debug.apk.
O cap sync gera os arquivos Gradle e recursos derivados. Não versionar credenciais,
SDK local, APKs ou keystores.

## Permissões

Declarações no manifesto não concedem permissões runtime. Nenhum serviço de GPS,
FCM, canal de notificação ou solicitação de isenção de bateria é implementado ainda.
Próximas fases devem solicitar consentimento contextual, permitir recusa/revogação,
iniciar/parar o serviço ao ficar online/offline ou sair da sessão e manter os filtros
de autorização e TTL do servidor. Android/fabricantes podem restringir a execução.
Revisar políticas Google Play de localização de fundo e isenção de bateria.

Referências:
- https://capacitorjs.com/docs/v6/config
- https://developer.android.com/about/versions/14/changes/fgs-types-required
- https://developer.android.com/google/play/requirements/target-sdk
