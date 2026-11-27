# Android FCM: persistência por dispositivo (F02/F07/F08)

A implementação utiliza as RPCs já presentes nos tipos Supabase da main:
`save_driver_fcm_token(p_token, p_platform, p_device_info)` e
`delete_driver_fcm_token(p_token)`. O papel ativo é verificado em profiles,
com sessão autenticada; o servidor continua responsável pela autorização e
escopo de auth.uid(). Não altera banco, tarifas, GPS ou lógica de corrida.

- Um listener de registro/rotação e um de toque por identidade autenticada.
- Permissão nativa já concedida e configuração Firebase real são necessárias;
  não há prompt automático no login. Retry ao voltar ao app, conectar, mudar
  papel e a cada minuto enquanto a WebView está ativa. Confirmação de registro
  só após sucesso da RPC. A espera da interface é limitada.
- O armazenamento local contém apenas vínculo proprietário/token para revogar
  este dispositivo após reload (sem JWT, GPS, payload, e-mail ou logs de token).
  A mesma inscrição não é reutilizada para outra conta se a revogação falhou.
  Rotação limpa somente tokens antigos registrados por este aparelho.
- Todos os três caminhos explícitos de logout revogam antes de signOut;
  falhas preservam a referência local para uma futura sessão da mesma conta.
  Unregister nativo é uma proteção adicional, não confirmação do banco.
  Desconexão de internet não é logout. Desconexão definitiva sem JWT não pode
  executar a RPC; invalidação Firebase é tentada, sem garantia offline.
- Device info é JSON textual com plataforma, versão/build pelo plugin App e
  modelo somente quando o Android WebView expõe esse campo. Nenhum identificador
  de hardware é inventado. APK existente pode usar esse fluxo sem plugin Device.
- A ação tap abre /home (somente se explicitamente indicada) ou
  /disponibilidade-profissional, por navegação interna e papel verificado.
  Não aceita corrida, não confia em URLs arbitrárias ou em dados do push.
- Despacho FCM implementado; confirmação de entrega, ACL/RLS real
  das RPCs e teste de tela bloqueada dependem de validação operacional.
  Lovable/Supabase retornou HTTP 403 nesta revisão; não foi possível consultar
  o corpo/grants das RPCs. Nenhuma chamada real de gravação/deleção foi feita.

Validação CI: `npx vitest run src/test/android-capacitor-phase2.test.ts
src/test/web-push-client.test.ts src/test/driver-pwa-promotion.test.tsx
src/test/pwa-install-notice.test.tsx src/lib/research-waiting-page-contract.test.ts`;
`npx tsc --noEmit`; `npm run build`.
O APK anexado foi inspecionado: inclui plugins PushNotifications, LocalNotifications,
App, CaronaaNative e recursos de configuração Firebase. O APK carrega caronaa.com;
o novo JavaScript depende de publicação do site, não da reinstalação do APK.

## Despacho HTTP v1 no servidor

Configure **somente** no gerenciador de segredos do ambiente servidor Lovable
`FCM_SERVICE_ACCOUNT_JSON` com o JSON completo da conta de serviço do projeto
Firebase usado pelo APK, com permissão Firebase Cloud Messaging API Admin (ou
permissão mínima de envio). Habilite a API Firebase Cloud Messaging HTTP v1.
Nunca coloque a chave privada em VITE_*, google-services.json, APK ou GitHub.
O código usa WebCrypto e OAuth2 de curta duração, sem nova dependência npm.
Sem esse secret, apenas Web Push continua funcionando; sem VAPID, FCM pode
funcionar independentemente. A consulta FCM usa somente Android e o papel
MOTORISTA, autorização/modalidade, presença e a regra existente de proximidade
15 km / último GPS até 60 min para despertar. A aceitação/radar mantém 90 s.
O canal corridas_urgentes usa prioridade alta, TTL 300 s e texto genérico privado.
O token só é removido no retorno FCM tipado UNREGISTERED, com condição por token,
usuário e updated_at, nunca por 404 genérico, 403, 429 ou falha de rede.
Logout offline não garante invalidação imediata; a API Firebase não conhece a
sessão Supabase. Retorno UNREGISTERED é esperado apenas quando o token realmente
se torna inválido. Um logout offline pode receber alerta genérico até a invalidação
ou até deixar de estar elegível. A notificação não leva detalhes privados da corrida.
Sem outbox persistente: o despacho segue best-effort com a janela existente de 4 s;
uma execução interrompida pelo runtime pode não entregar todas as notificações.
Aceitação do provedor não comprova entrega no Android. Testar APK real com tela
bloqueada, app minimizado, logout, duas contas e PWA após publicar e configurar.
Nenhum envio real foi efetuado nesta implementação.
