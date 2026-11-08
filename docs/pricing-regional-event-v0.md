# CARONAA — Motor de precificação regional e por atividade (proposta v0)

**Estado:** protótipo isolado, NÃO vinculado à API pública, ao Asaas, a PIX manual,
a `offer_route_quotes`, `persist_ride_route_quote` ou à contabilidade.
Nenhuma tarifa, débito de comissão ou cobrança vigente foi alterada.

## Critérios acordados e cálculos

| Cenário | Preço do passageiro | Comissão condutor | Líquido condutor |
|---|---|---|---|
| Maciço, moto, 3km | R$ 7,50 | 20% = R$ 1,50 | R$ 6,00 |
| Maciço, moto, 11km | R$ 7,50 | 20% = R$ 1,50 | R$ 6,00 |
| Maciço, moto, 12km | R$ 8,05 | 20% = R$ 1,61 | R$ 6,44 |
| Maciço, moto, 22km | R$ 13,50 | 20% = R$ 2,70 | R$ 10,80 |
| Maciço, moto, atividade oficial válida, 3km | R$ 7,50 | 15% = R$ 1,13 | R$ 6,37 |

Nota: os arredondamentos de tarifa/comissão usam centavos inteiros; a porcentagem
não é aplicável ao valor bruto sem regras de arredondamento. Se o processamento
de pagamento cobrar uma taxa adicional, ela é suportada pela plataforma neste
protótipo e deve ser medida no produto real.

**Alerta de aceitação dos mototaxistas:** R$ 6 líquidos para 11 km completos
pode ser economicamente insuficiente apesar de equivaler ao mínimo observado
para uma corrida CURTA. Validar com mototaxistas de Redenção, Acarape, Baturité
e demais municípios o raio coberto pela bandeirada e a tarifa por km/tempo.
Não ativar uma tarifa plana até 11 km sem validação de campo.

### Região fora do Maciço
- Carona compartilhada: referência histórica R$ 6/11km, piso R$ 4,50
  por passageiro, antes de desconto promocional.
- Carona com amigos: exatamente o mesmo trajeto, uma única reserva que ocupa
  dois ou mais assentos reais. Desconto **somente nos assentos adicionais**,
  pago pela margem da plataforma. A plataforma não reduz o valor líquido do
  condutor por causa do desconto. Sem margem ou acima do piso, desconto = zero.
- Moto compartilhada: no máximo 1 passageiro. Não oferecer pacote de amigos
  em moto.
- Corridas EXCLUSIVAS: usar tabelas distintas de carro e moto com tarifa
  inicial, custo de km, custo de minuto e tarifa mínima. Ainda sem números
  de produção. Não reutilizar o preço solidário da carona compartilhada
  como tarifa de táxi.

### Comissão e precedência
1. Atividade OFICIAL cadastrada, publicada e habilitada, no horário válido,
   com embarque dentro de geofence verificável: **15%**.
2. Fora de atividade válida e na região do Maciço: **20%**.
3. Fora do Maciço e fora de atividade: valor configurável **PENDENTE**.
   A engine bloqueia a cotação se estiver ausente; não presume 15%.

O nível de acesso a campaign/admin deve ser privado. O próprio cliente não
pode enviar `active=true`, município, polígono ou `commissionBps` como
prova. Um serviço autenticado resolve período, área, versão de política,
coordenadas de embarque e evento a partir do banco.

### Relação com a cobrança atual
- A migration 0135 fixou 15% em novos débitos de Pix manual globalmente,
  ao atualizar o default e `confirm_manual_ride_payment(uuid)`. Isto
  **conflita** com a nova regra regional. Uma migration posterior precisa
  tornar a taxa efetiva um snapshot da viagem aprovado pelo servidor.
- Salvar em cada cotação e dívida: versão imutável de política, região
  verificada, evento autorizado (se houver), modo, distância rodoviária,
  tempo, ocupantes, valor de referência, desconto de plataforma, preço
  efetivamente pago, comissão, valor motorista, tarifas do provedor e
  método de pagamento.
- Preservar histórico de 15% e 16,86%. Não alterar dívidas antigas.
- Garantir mesma política no preview, confirmação e liquidação. A tarifa
  aprovada deve ser persistida atomicamente antes do aceite.
- Aplicar política pelo servidor para evitar manipulação por navegador.
- Não ligar a engine diretamente em cobrança antes de testes de
  concorrência, arredondamento e reconciliação financeira.

## Ponto de decisão antes da produção
1. Quantos quilômetros realmente são cobertos pela bandeirada do mototáxi
   no Maciço? A proposta acima assume até 11km, mas isso precisa de campo.
2. Qual é a comissão padrão FORA de atividades e fora do Maciço?
3. Definir tarifa mínima do carro compartilhado no Maciço, além das
   tabelas exclusivas de carro e moto fora do Maciço.
4. Qual percentual promocional por amigo (ex.: 10% no 2º assento como
   *cenário de teste*, não política aprovada)?
5. Custos reais de PIX, chargeback, impostos, taxas municipais, cancelamento,
   seguros e custos do Google Routes, para testar margem líquida.

## Arquitetura da próxima entrega

- `pricing_policy_versions`: política por região/modo/horário, criada e
  aprovada por administradores; vigência temporal, rollback e auditoria.
- `pricing_activity_campaigns`: eventos com início/fim, polígono, rate 15%,
  prioridade e responsável; proteger RLS.
- `pricing_quote_snapshots`: preços e taxa aprovados imutáveis por `quote_id`;
  evita divergência entre display/aceite/cobrança.
- `pricing_ride_settlements`: razão financeira com custo do pagamento,
  promoções subsidiadas pela plataforma e comissão efetiva.
- Integrar na `previewRequestFare` e `calculateRideQuote` depois de homologar.
- Corrida Rápida permanece na HOME: ao selecionar EXCLUSIVE, apresentar radar
  de profissionais disponíveis filtrado por proximidade e capacidade,
  sem navegação para outra rota. Não publicar posições exatas de profissionais
  não atribuídos; usar endpoint de descoberta autorizado e estimativas de
  proximidade com privacidade e limites. Só solicitar viagem após validar
  preço, motorista e consentimento.

## Referências regulatórias

- Lei Federal 12.009/2009 (mototaxistas):
  https://www2.camara.leg.br/legin/fed/lei/2009/lei-12009-29-julho-2009-589965-normaatualizada-pl.html
- Política Nacional de Mobilidade Urbana, Lei 12.587/2012:
  https://www2.camara.leg.br/legin/fed/lei/2012/lei-12587-3-janeiro-2012-612248-normaatualizada-pl.html
- Verificar atos específicos de cada município quanto à operação de moto-táxi,
  seguro, licença e fiscalização antes de abrir o radar para solicitações pagas.
