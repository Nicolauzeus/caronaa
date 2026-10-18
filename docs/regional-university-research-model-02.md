# Modelo 02 — Universidade Regional e Mobilidade Local

## Finalidade
Pesquisa de validação em universidades com cobertura limitada de aplicativos de transporte. Diferencia:
- **CARONA** — manifestação de interesse em compartilhar trajetos;
- **TRANSPORTE_PROFISSIONAL_INTERESSE** — pesquisa de interesse em transporte local por profissionais habilitados; **não é uma oferta, contratação ou serviço aprovado**.

A data de início e a situação real da parceria pertencem à configuração institucional. O modelo não inventa mototaxistas credenciados ou valores de viagem.

## Como reutilizar para cada universidade
1. Central de Pesquisas → **+ Novo formulário** → Natureza **Educação** → **Universidade regional · Mobilidade local**.
2. Preencher título, código único, nome, logo autorizado (opcional), campus, endereço, cidade/região, origem/campanha, turnos, dias, horários de saída e retorno, pontos seguros e data prevista ou confirmada.
3. `partnershipConfirmed` só deve ser marcado após comprovação da parceria. Mesmo confirmada, uma parceria não substitui autorizações para transporte profissional.
4. Ajustar `modes` para remover `TRANSPORTE_PROFISSIONAL_INTERESSE` quando o projeto não pretende nem investigar essa possibilidade.
5. Revisar schema gerado, publicar versão, habilitar pesquisa. Duplicações preservam as perguntas e geram IDs próprios, limpando comprovações de parceria, contatos e data.
6. Ao responder, o público informa dados atuais de transporte, espera, preço e dores; escolhe alternativas; avalia interesse; em seguida informa trajeto, dias e horários na etapa institucional. O consentimento para contato é separado.
7. A conclusão pode registrar **interesse e disponibilidade** com confirmação. Ainda não cria carro disponível, viagem, match nem pagamento. A opção profissional continua em estudo, separada das caronas.

## Inteligência de mercado e integridade
- Reutiliza `TRANSPORT_MODE`, `COST_PER_TRIP`, `WAIT_TIME`, `MOBILITY_PAINS`, `ADOPTION_INTENT`, `ACCEPTABLE_FARE_RANGE`, `BOOKING_INTENT` e `LAUNCH_PARTICIPATION_INTENT`.
- A migration `0097_regional_university_market_metrics.sql` inclui 7 classificações novas no resumo institucional, preservando o contrato agregado e os denominadores de respostas elegíveis.
- Novos códigos: `REGIONAL_SERVICE_PREFERENCE`, `REGIONAL_PRIMARY_PAIN`, `REGIONAL_BARRIER`, `REGIONAL_OFFER_POSSIBLE`, `REGIONAL_OFFER_VEHICLE`, `REGIONAL_PROFESSIONAL_ROLE`, `REGIONAL_PROFESSIONAL_INTEREST`.
- Filtros por instituição, campus, campanha, perfil, modalidade de interesse, região, data e versão já são fornecidos por `ConfiguredResearchInsights`.
- Contagens profissionais representam **declarações e intenções**, não profissionais certificados, contratados ou ativos.
- Orçamento declarado não representa preço real, aceitação de cotação, pagamento ou receita.
- A coleta não pede endereço completo nem identificação de mototaxistas durante a pesquisa. Os campos de rota são tratados pelo fluxo existente com acesso controlado.

## Plano de homologação
1. Fazer backup e aplicar `drizzle/migrations/0097_regional_university_market_metrics.sql` **primeiro em homologação**, em banco onde 0095 e 0096 já estejam instaladas. Depois conferir a assinatura `get_configured_research_summary(jsonb)` e permissões existentes.
2. Criar uma universidade fictícia com horários válidos e **sem parceria confirmada**. Testar cópia do modelo, publicação, logo, mensagens de lançamento planejado/adiado/confirmado e atualização de horário.
3. Responder como passageiro/motorista/ambos, com e sem disponibilidade; validar condicionais e limite de 2 dores, dificuldade principal coerente, veículo moto com 1 lugar.
4. Testar escolha por mototáxi, com e sem parceria confirmada, e verificar que a conclusão **não anuncia serviço nem gera uma reserva**. Declaração profissional não pode conceder permissões de prestador.
5. Conferir pesquisa e indicadores agregados por universidade/versão, verificando inclusive `REGIONAL_PROFESSIONAL_INTEREST` e `REGIONAL_SERVICE_PREFERENCE`. Sem dados, mostrar N/D/sem resposta.
6. Testar consentimentos, RLS, anônimos, contas não autorizadas, celular 360/390px, desktop e navegadores.
7. Rodar `npm test`, `npx tsc --noEmit`, `npm run build` e GitHub Actions. Não executar ações de produção durante testes.

**Sem execução automática de migration no banco.** A renumeração prévia 0095/0096 foi resolvida na main. A migration 0097 altera apenas a função de agregação e não faz deleção de dados.
