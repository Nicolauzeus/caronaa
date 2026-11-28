# Android — configuração inicial de permissões

- A configuração é exibida no primeiro acesso autenticado por conta e papel, e pode ser reaberta no Perfil. O usuário pode continuar sem autorizar; não altera login, aprovação, presença, rastreamento, tarifas ou banco.
- APKs 1.1.0 e 1.1.1 recebem a tela web após publicação. Métodos nativos ausentes usam os ajustes existentes; status não verificável nunca é marcado como ativo.
- Próximo APK candidato: bridge com leitura real de localização precisa, serviço de localização do aparelho, notificações globais, canal de corrida e exceção de bateria. Ajustes específicos abertos apenas por toque. Inicialização automática OEM é manual e não verificável genericamente.
- GPS não inicia rastreamento nem coleta coordenadas por este fluxo. Serviço de localização foreground continua vinculado a consentimento, disponibilidade e autorização. Não solicitar localização sempre ativa, câmera, galeria, contatos ou microfone preventivamente. Câmera/fotos seguem os fluxos existentes.
- O próximo APK anuncia rideActions=false para preservar entrega convencional enquanto a entrega data-only no 1.1.1 não estiver validada fisicamente. O código interativo permanece para diagnóstico futuro; nenhum token existente é modificado diretamente. 1.1.0 original permanece disponível.
- Aceite físico: instalar candidato assinado por cima de 1.1.0 e 1.1.1, confirmar login e papel, permitir/recusar, retornar de ajustes, testar toque, verificar FCM convencional em primeiro e segundo plano, GPS/mapa, disponibilidade e logout. Confirmar Xiaomi e Android 13+. Não publicar como estável apenas com build verde.

## Atalho do mapa e modo guiado
- FAB amarelo separado de zoom e GPS, no mapa inicial Android, fora de corrida operacional e painel totalmente expandido.
- Ativar tudo conduz os itens pendentes/indeterminados em sequência por toque, com opção de pular e atualização ao voltar. Conexão local via navigator.onLine; ajuste de rede por ACTION_WIRELESS_SETTINGS. Não declarar conectividade do backend. Nenhuma permissão de sobreposição ou acesso a notificações de outros apps.
- F07: texto neutro durante busca real, sem exibir contagem zero; manter contagens positivas reais, cancelamento e prazo no servidor. Não simular presença ou manter busca falsa após expiração.

## Correção de acesso multiplataforma
- Cabeçalho, menu de conta e Perfil abrem a central mesmo no navegador e no cockpit profissional. FAB no mapa inicial e no cockpit; cabeçalho permanece disponível durante os outros estados. Marcador v2 separado por plataforma, conta e papel. Sem prompt nativo automático.
- Navegador usa somente APIs de permissão do site; localização do site não equivale a GPS preciso, bateria/canal não podem ser detectados no navegador. A solicitação de localização usa um fix descartado, sem publicação. Não confundir consentimento de notificações com entrega remota.
- Ícones do launcher e PWA têm fundo preto opaco; logo e ícone monocromático de notificação permanecem. PWA usa revisão de cache e URLs de ícone versionadas; launcher do Android exige APK atualizado.
