# CARONAA — política de Pix manual e Asaas (revisão de 05/11/2026)

## Decisão comercial

- Participação CARONAA para **novas** viagens pagas: **16,86% do valor-base da carona**.
- Parcela econômica do motorista: **83,14% do valor-base**, sem considerar tarifas de terceiros.
- Obrigações manuais **anteriores** ao marco 0134, registradas a 15%, permanecem inalteradas.
- Pix manual e Asaas coexistem, mas **cada viagem aceita um único método** e nunca exibe os dois códigos Pix.
- Asaas ainda não recebe cobranças: `ASAAS_ENABLE_CHARGES=false` e `ride_payment_policy.asaas_enabled=false`.

## Tarifas da conta Asaas e diferença entre bruto e líquido

Conforme a informação comercial recebida, a tarifa de Pix estimada é **1,86% + R$0,35**.
A alíquota e a tarifa fixa **ainda não são verificadas pelo backend na conta**: usar somente para simulações;
checar taxas e eventual custo de split da conta, as condições contratuais, mínimos e descontos.

**Não confundir taxa e comissão**:

- A participação CARONAA de 16,86% é sobre o preço-base da viagem.
- A API Asaas realiza split percentual sobre `netValue`, não sobre o preço-base bruto.
- Para manter exatamente 83,14% do preço-base ao motorista, usar `fixedValue` ao definir o split,
  **somente após validar que `netValue >= fixedValue`**.
- A prévia atual assume, provisoriamente, que a tarifa de processamento seria repassada ao passageiro,
  e calcula o adicional incluindo a incidência percentual sobre o total da cobrança.
  **Não existe cobrança**; a apresentação definitiva da tarifa e sua responsabilidade
  econômica serão validadas antes da liberação em produção.
- Exemplo **puramente simulado**: preço-base R$2,15, participação CARONAA R$0,36,
  motorista R$1,79 e estimativa de tarifa Asaas R$0,40; o total simulado ao passageiro
  seria R$2,55. Se a tarifa real for diferente, essa previsão não é válida.

## Método único por viagem

Migração `0134_payment_method_exclusivity_commission_1686.sql`:

- `ride_payment_choices` persiste `MANUAL_PIX` ou `ASAAS_PIX`; o passageiro escolhe.
- `select_ride_payment_method` é permitido somente ao pagador autenticado, em viagem confirmada.
- Inserção/atualização de confirmação manual e de tentativa Asaas têm gatilhos conflitantes;
  o código no navegador não é a barreira de segurança.
- Tentativa Asaas existente impede mudar para Pix manual sem revisão financeira,
  mesmo se a cobrança tiver falhado, para evitar pagamento tardio e duplicidade.
- O Asaas não pode ser selecionado enquanto o gateway não for homologado e liberado.
- O Pix manual exige confirmação separada de passageiro e motorista.
  Somente depois de ambos confirmarem é registrado o débito de 16,86% do motorista.
  O status fica pendente até conferência bancária pela plataforma.
- Motoristas com três repasses manuais ainda não quitados ficam suspensos de novas ofertas
  e do radar profissional, com regras aplicadas no banco.

## Critérios de liberação do Asaas

1. Corrigir todos os testes e obter build e workflows aprovados no commit de release.
2. Verificar configuração e tarifa **real** da conta (inclusive R$0,35, percentual e split).
3. Habilitar o split na conta Asaas, cadastrar e verificar walletIds dos motoristas.
4. Provisionar cliente pagador com segurança no backend; registrar consentimento de preço/fee.
5. Implementar endpoint de checkout autenticado + idempotência + reserva financeira.
6. Configurar token exclusivo de webhook e habilitar processamento seguro de produção;
   eventos verificados, deduplicados e reconciliados, com reembolso e falha de split.
7. Testar uma jornada do Pix manual e uma jornada Asaas separadamente, incluindo cobrança
   recusada, reenvio de evento e tentativa de troca indevida de método.
8. Somente com aceite da homologação mudar a feature flag e a política de banco.

Não habilitar `ASAAS_ENABLE_CHARGES=true` por conta própria antes da etapa 8.

Fontes Asaas:
- https://docs.asaas.com/docs/split-de-pagamentos
- https://docs.asaas.com/docs/webhooks-2
- https://docs.asaas.com/docs/production-readiness
