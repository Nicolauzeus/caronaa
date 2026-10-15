# CARONAA / Asaas — arquitetura inicial (sandbox)

Apenas integração **server-side**. Nunca colocar ASAAS_API_KEY no navegador, repositório ou logs.

## Política comercial provisória
- Tarifa do CARONAA: 15% do **valor bruto** da reserva.
- Motorista: 85% do bruto, repassado via `split.fixedValue`.
- A conta emissora da cobrança é a plataforma CARONAA; recebe o saldo líquido após split e tarifas.
- **CARONAA absorve a taxa Asaas**, portanto a receita líquida do CARONAA será 15% do bruto MENOS a tarifa, não 15% líquidos.
- Não ativar cobrança quando não houver estimativa confiável de `netValue >= driverFixedValue`. Taxas variáveis e custos adicionais exigem conciliação.
- Se a decisão mudar para repassar tarifas ao passageiro, recalcular o bruto e pedir consentimento explícito na UI **antes** da cobrança.

## Fluxo pretendido
1. Reserva de grupo com destinos individuais persistidos no banco e cotação rodoviária imutável/expirável.
2. Backend autentica proprietário da reserva, status elegível, total do grupo e walletId da subconta do motorista.
3. Guardar registro de cobrança PENDING com unicidade por reserva, idempotência e snapshot do valor e do split.
4. Conta emissora CARONAA cria a cobrança PIX em POST /v3/payments com customer, billingType PIX, value, dueDate, externalReference e split [{walletId: motorista, fixedValue: 85% do bruto}].
5. Guardar payment.id e consultar GET /v3/payments/{id}/pixQrCode; mostrar código copia-e-cola/QR dinâmico.
6. Webhook com authToken validado na borda, validação de payment.id, externalReference, valores, id do evento e estados; verificar transação no Asaas quando necessário.
7. PAYMENT_RECEIVED ou PAYMENT_CONFIRMED valida recebimento; PAYMENT_SPLIT_DONE valida liquidação **separadamente**. Registrar reembolsos/chargebacks e reconciliação.
8. QR de embarque permanece independente do QR Pix.

## Configuração (server-side)
- ASAAS_ENV=sandbox
- ASAAS_API_KEY=... (segredo)
- ASAAS_WEBHOOK_AUTH_TOKEN=... (segredo distinto)
- ASAAS_ENABLE_CHARGES=false (feature flag; desligado até persistência, webhooks e integração end-to-end)
- ASAAS_FEE_POLICY=platform_absorbs (política provisória)

## Segurança / pendências obrigatórias
- Não cobrar apenas com total enviado pelo browser; calcular/persistir no servidor.
- Não gerar dois pagamentos para a mesma reserva (restrição única e idempotência transacional).
- Validar titular, motorista, walletIds e ausência de auto-split.
- Tratar replays, eventos fora de ordem, reembolsos e falhas de split.
- Credenciais do sandbox não pagam em produção.
- Nenhum código desta etapa cria cobrança real, marca PIX pago ou transfere fundos.
- Revisar termos comerciais, classificação do serviço e responsabilidades legais antes de operar.
