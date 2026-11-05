# CARONAA / Asaas — arquitetura inicial (sandbox)

> **Atualização de 05/11/2026:** o percentual para novas viagens é **16,86% CARONAA / 83,14% motorista**. A taxa de Pix estimada informada é **1,86% + R$0,35**, ainda não verificada por checkout transacional. As duas formas de pagamento são exclusivas por viagem e o Asaas continua desligado. Ver [política vigente](payment-dual-rail-1686.md). Documentação abaixo descreve a arquitetura original e contém referências históricas à política 85/15.\n\nApenas integração **server-side**. Nunca colocar ASAAS_API_KEY no navegador, repositório ou logs.

## Política comercial confirmada: Modelo B (passageiro paga processamento)
- Preço da carona (sem tarifa) = `F` centavos. CARONAA recebe **15% líquidos de F**, motorista **85% de F**, arredondados de modo a fechar exatamente F.
- A tarifa de processamento `T` deve vir de configuração verificada para a conta/cobrança Asaas, nunca de input livre do passageiro e **não está fixada em R$ 1,99** no código.
- O passageiro vê `F + T` e concorda explicitamente **antes** de gerar a cobrança; preço, T, motorista, validade, divisão e consentimento devem ser persistidos e imutáveis para cada tentativa.
- Cobrar `F + T`; `split.fixedValue = 85% de F` para `walletId` do motorista; saldo líquido não distribuído fica na conta CARONAA.
- Só fica exatamente 15% líquido quando a tarifa real Asaas também for T. Exemplo: F=R$ 100, T=R$ 1,99, cobrança R$ 101,99, motorista R$ 85,00, CARONAA R$ 15,00 (supondo inexistência de outras cobranças).
- Validar `value`, `netValue`, ID e estado via API Asaas e conciliar tarifas reais, reembolsos e splits. Qualquer divergência fica em estado de reconciliação e não deve ser marcada como receita garantida.
- Verificar tarifas de Pix e de eventual split/transferência da conta, incluindo promoções e tarifas adicionais, antes de oferecer este preço.
- `src/lib/payments/passenger-fee.ts` calcula e concilia valores em centavos; esta é uma **camada de domínio**, não um checkout em funcionamento.

## Fluxo pretendido
1. Reserva de grupo com destinos individuais persistidos no banco e cotação rodoviária imutável/expirável.
2. Backend autentica proprietário da reserva, status elegível, total do grupo e walletId da subconta do motorista.
3. Guardar registro de cobrança PENDING com unicidade por reserva, idempotência, snapshot de F/T/total/split e aceite explícito do passageiro.
4. Conta emissora CARONAA cria PIX em POST /v3/payments, `value=F+T` e split [{walletId: motorista, fixedValue: 85% de F}].
5. Guardar payment.id e consultar GET /v3/payments/{id}/pixQrCode; mostrar código copia-e-cola/QR dinâmico.
6. Webhook com authToken validado na borda, validação de payment.id, externalReference, valores, id do evento e estados; verificar transação no Asaas quando necessário.
7. PAYMENT_RECEIVED ou PAYMENT_CONFIRMED valida recebimento; PAYMENT_SPLIT_DONE valida liquidação **separadamente**. Registrar reembolsos/chargebacks e reconciliação.
8. QR de embarque permanece independente do QR Pix.

## Configuração (server-side)
- ASAAS_ENV=sandbox
- ASAAS_API_KEY=... (segredo)
- ASAAS_WEBHOOK_AUTH_TOKEN=... (segredo distinto)
- ASAAS_ENABLE_CHARGES=false (feature flag; desligado até persistência, webhooks e integração end-to-end)
- ASAAS_FEE_POLICY=passenger_pays (política confirmada; validar no servidor)
- A tarifa de processamento precisa de fonte confiável, atualização controlada e versionamento; não aceitar preço/fee enviados pelo navegador.

## Segurança / pendências obrigatórias
- Não cobrar apenas com total enviado pelo browser; calcular/persistir no servidor e exibir ao passageiro a tarifa separada antes do consentimento.
- O estado de pagamento e receita deve depender da conciliação do valor líquido efetivo; erros de tarifa não podem ser mascarados.
- Não gerar dois pagamentos para a mesma reserva (restrição única e idempotência transacional).
- Validar titular, motorista, walletIds e ausência de auto-split.
- Tratar replays, eventos fora de ordem, reembolsos e falhas de split.
- Credenciais do sandbox não pagam em produção.
- Nenhum código desta etapa cria cobrança real, marca PIX pago ou transfere fundos.
- Revisar termos comerciais, classificação do serviço e responsabilidades legais antes de operar.

## Progresso técnico (15/10/2026)
- Migração `0064_asaas_checkout_ledger.sql`: modelo de cobrança privada, unicidade por viagem, aceite registrado, webhook inbox idempotente, RLS sem acesso ao cliente. **Não aplicada ao banco de produção**.
- Rota `POST /api/asaas/webhook`: somente sandbox, valida `asaas-access-token`, consulta Asaas independentemente e registra evento no inbox. **Não altera status financeiro nem liquida split**.
- `previewAsaasCheckout`: server function autenticada, lê preço persistido, exige tarifa validada e mostra total antes de cobrar; não gera QR.
- `AsaasCheckoutPreview`: mostra preço, tarifa e divisão prevista ao passageiro na viagem. **Ainda não é checkout**.
- Configuração de tarifa: `ASAAS_VERIFIED_PIX_FEE_CENTS` (centavos, inteiro), `ASAAS_FEE_VERIFIED_AT` (ISO UTC, verificado há no máximo 14 dias), `ASAAS_ENV=sandbox`. Esses valores devem ser conferidos no painel Asaas; **não inventar tarifa**.
- Credenciais privadas: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_AUTH_TOKEN` apenas no backend; nunca em variáveis `VITE_` ou no git.
- `ASAAS_ENABLE_CHARGES=false` permanece obrigatório até existir provisionamento autenticado de customer/wallet, checkout transacional com consentimento, reembolso e reconciliação dos splits.
- Testes de domínio, mocks de Pix/split e contratos de segurança via GitHub Actions. **Testes simulados não comprovam confirmação financeira real nem GPS em dispositivos**.
- A tarifa do Asaas pode variar por contrato, promoção e outros serviços. A margem líquida de 15% só é atingida se a tarifa efetiva corresponder exatamente à tarifa cobrada ao passageiro.
