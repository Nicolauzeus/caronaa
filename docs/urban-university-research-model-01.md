# Modelo 01 — Universidade Urbana CARONAA

## Objetivo
Disponibilizar um modelo de pesquisa replicável em campi urbanos que já contam com Uber, 99, ônibus e outras alternativas. Validar o problema, a proposta, oferta de vagas, orçamento declarado e preparar interessados para uma futura carona, **sem simular corridas ou pagamentos**.

## Como criar
1. Na Central de Pesquisas, clique em **+ Novo formulário**, escolha a natureza **Educação** e o modelo **Universidade urbana · CARONAA**.
2. Preencha título, código único, instituição, identificador, campus, cidade/endereço, campanha e origem, situação do lançamento, data (se confirmada), dias e horários. Os horários inicialmente sugeridos são editáveis por unidade e turno.
3. Informe a situação verdadeira da parceria. Não marcar parceria confirmada sem anuência da instituição.
4. Opcionalmente envie a logomarca autorizada na criação. Caso o envio falhe, o rascunho é preservado e a identidade pode ser adicionada nas configurações da pesquisa.
5. Revise e publique a versão. O formulário público apresentará a proposta em linguagem breve, a situação do lançamento e o questionário. O passo de trajeto é fornecido pela infraestrutura institucional existente.
6. Reutilize o modelo em outra universidade selecionando-o novamente, com configurações e identificador novos. Os IDs das perguntas são independentes por pesquisa; respostas e selos de outras pesquisas nunca são copiados.

## Estrutura
- **Rotina:** vínculo acadêmico, modais atuais, custo por trecho (R$), até duas dores e a principal.
- **Solução:** disponibilidade potencial de lugares, tipo de veículo/capacidade, adoção declarada e confiança.
- **Economia:** orçamento hipotético, motivação do motorista e interesse declarado em lançamento/pré-ativação.
- **Trajeto institucional:** perfil passageiro/motorista/ambos, origem e destino aproximados, sentido, dias, horários configuráveis, flexibilidades e consentimentos separados (via jornada configurada).
- **Após resposta:** o serviço existente `register_research_interest` aceita interesse ou disponibilidade com consentimento explícito. Não cria reserva, oferta operacional, match ou cobrança. Para publicar uma carona verdadeira, o usuário vai ao app e confirma pelos fluxos normais.

## Dados e interpretação
O modelo reutiliza os códigos permitidos em `get_configured_research_summary` e a aba **Coortes institucionais**: transporte atual, custo por trecho, dores, intenção de adoção, fatores de confiança, faixa de orçamento, interesse de lançamento, perfil, horário e registros de interesse/ disponibilidade. Os relatórios separam versões, instituições e elegíveis. Dados de custo não devem ser anunciados como **mediana** até existir agregação numérica específica; a função existente contabiliza respostas por valor/faixa.

- `ADOPTION_INTENT` não significa corrida reservada.
- `ACCEPTABLE_FARE_RANGE` é orçamento declarado, não aceitação de cotação verificada.
- `LAUNCH_PARTICIPATION_INTENT` não concede consentimento de contato. Este é independente, na jornada institucional.
- `RIDE_OFFER_INTENT` representa oferta declarada; oferta real exige confirmação posterior.
- Respostas de pesquisa não aumentam contagens de corridas, pagamentos nem repetição 7/30 dias.

## Checklist de homologação
1. Confirmar se `0095_reusable_research_infrastructure.sql` (migrations da `main`) está efetivamente aplicada no banco. Nome semelhante à migration da lixeira em PR paralelo: **verificar e resolver eventual colisão de numeração antes de implantar migrations**.
2. Criar um campus fictício de homologação e verificar schema de perguntas, marketing, logo, data e horários.
3. Publicar e responder com perfis distintos: passageiro, motorista, ambos. Verificar limitações de duas dores e motocicleta com um lugar.
4. Tentar acessar a pesquisa em modo visitante; conferir que a introdução e data são reais e atualizadas.
5. Finalizar, registrar interesse com consentimento e comprovar que `research_interest_requests` contém apenas interesses, não ofertas ou pagamentos.
6. Conferir agregados da aba Coortes institucionais para a pesquisa fictícia e comparar denominadores/versões com SQL, sem acessar endereços pessoais em relatório.
7. Testar 360/390/768/1440px, foco, mensagens de erro e sem dados.
8. Rodar CI, `npm test`, `npm run build`. Resolver descompasso entre `package.json` e `package-lock.json` no workflow de pesquisa (`npm ci`) antes de exigir este check.
9. Não publicar usando nome/logotipo da UNIFOR sem autorização. **Não afirmar parceria, tarifa, disponibilidade ou data confirmada sem evidência.**

## Limites
Agendamento real no momento da resposta, cotação de preço validada por rota, cobrança e correspondência operacional não são criados por este PR; permanecem nos fluxos autenticados do aplicativo. Este modelo prepara a demanda e permite medir comportamento real após lançamento.
