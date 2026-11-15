# Diagnostico de travamentos em aparelho - CARONAA

Branch de homologacao: `feature/quick-ride-live-navigation`. A instrumentacao nao foi implantada na main.

## Como reproduzir
1. Publicar um preview da branch num ambiente HTTPS de testes.
2. No mesmo celular em que o travamento ocorre, abrir o endereco de homologacao acrescentando `#diagnostico`.
3. Reproduzir login/onboarding e entrada na Home. O sinalizador tambem e lembrado apenas durante a sessao da aba.
4. Quando a interface voltar a responder, tocar em Atualizar e Copiar relatorio, e compartilhar o texto com a equipe. Nao inclui coordenadas, emails ou IDs de conta.
5. Se travar a ponto de nao permitir copiar, registrar tela e horario. Na analise com inspecao remota do navegador, coletar Network, Performance e erros de console sem tokens de autenticacao.

## Interpretacao
- `onboarding-bootstrap`: espera de progresso e contexto inicial.
- `onboarding-completion`: espera de validacao, salvamento e redirecionamento apos o cadastro.
- `home-before-load`: verificacoes de autenticacao, admin, onboarding e destino.
- `home-first-render`: intervalo entre o fim do guard e o primeiro efeito da Home.
- `longTasks.totalDurationMs`: tempo acumulado de tarefas longas observado quando o navegador suporta a API.
- `incompletePhases`: fase iniciada mas sem conclusao; pode apontar uma operacao pendente, nao prova a causa isoladamente.

## Limites
O relatorio nao mede FPS continuamente, nao revela desempenho da memoria de apps nativos e pode nao captar congelamentos que terminem em encerramento abrupto do navegador.
As fases sao marcadas apenas se o diagnostico tiver sido ativado antes da reproducao. A coleta e inteiramente local, sem upload automatico.
Nao concluir que um gargalo e causado pelo Google Maps sem correlacionar as chamadas de rede e as tarefas longas.

## Proximos gates
- Rodar build e testes automatizados na branch.
- Conferir impacto dos componentes de mapa e do GPS no Safari iOS e Chrome Android.
- Verificar se loops de renderizacao, subscriptions e polling se multiplicam apos entrar e sair da Home.
- Identificar a causa a partir dos resultados antes de propor mudancas estruturais na autorizacao/onboarding.
