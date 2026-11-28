# Web Push em segundo plano — F07/F08

O navegador utiliza a inscrição Web Push com VAPID e o worker existente `/sw.js`.
O evento `push` exibe a notificação sem depender da página React em primeiro plano.
O APK Android continua usando o canal FCM existente.

## Ativação e recuperação

- O motorista ativa as notificações por toque explícito nas telas de disponibilidade ou Flash.
- No primeiro carregamento, o cliente registra `/sw.js` quando necessário e aguarda um worker ativo por até oito segundos. Timeout limpa listeners e ignora conclusões tardias.
- Permissão concedida não é apresentada como sucesso de cadastro: a confirmação exige sucesso da RPC autenticada que salva a inscrição.
- Falha de worker ou persistência mostra orientação e nova tentativa. Permissão bloqueada orienta os ajustes do navegador.
- No iPhone/iPad, orientar instalação na Tela de Início e abertura pelo ícone antes de solicitar permissão. Requer iOS/iPadOS 16.4 ou superior.
- A renovação existente só reconcilia uma permissão já concedida; não apresenta prompts silenciosos. Logout não instala um novo worker.

O status de cadastro não comprova entrega. Som, alertas de bloqueio e processamento em segundo plano dependem do navegador e do sistema. O push não mantém GPS contínuo no navegador e não altera os filtros de disponibilidade, localização, veículo ou autorização para receber/aceitar corridas.

## Configuração existente

O servidor utiliza `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
A chave pública precisa corresponder à publicada em `src/lib/push/vapid-public-key.ts`.
Não rotacionar o par para corrigir uma falha de cadastro: inscrições existentes dependem dele.

Na auditoria de 27/11/2026, havia zero inscrições web e dois dispositivos Android. O editor informou presença das três configurações VAPID; a correspondência da chave pública do ambiente publicado ainda exige verificação. Nenhuma chave foi alterada ou exposta.

## Validação

Testes direcionados: cliente Web Push, estados da interface e nova tentativa no Flash, registro PWA, worker sem janelas abertas, links internos seguros, despacho Web Push/FCM, isolamento do APK e promoção PWA. Verificar também `npx tsc --noEmit` e o build do projeto na integração contínua.

Validação real pendente após merge/publicação:

1. Em navegador compatível e HTTPS, entrar com a conta do motorista e tocar em **Ativar notificações**.
2. Conceder a permissão, confirmar **Notificações ativadas neste navegador** e verificar a inscrição persistida.
3. Manter disponibilidade e elegibilidade normais; colocar o CARONAA em segundo plano.
4. Confirmar a notificação no aparelho quando houver uma solicitação real elegível. Tocar deve abrir somente uma rota interna, sem aceitar a corrida automaticamente.

Não criar corridas fictícias nem tratar aceite pelo provedor como prova de entrega. Sem alteração de SQL, RLS, tarifas, permissões de GPS ou regras de negócio do README.

Referências: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) e [Web Push no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
