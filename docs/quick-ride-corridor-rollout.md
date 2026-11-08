# CARONAA — Corrida Rápida integrada ao mapa (F07)

## Estado do pacote
PR dependente do [motor de tarifas v0](https://github.com/Nicolauzeus/caronaa/pull/62).
A implementação é **piloto com preços preparados**, NÃO uma integração de recebimento
Asaas/Pix nem uma permissão para operar mototáxi comercial sem habilitação.

Migration aditiva: `drizzle/migrations/0139_quick_ride_corridor_pricing_and_interest.sql`.
**Não aplicada automaticamente pelo GitHub.** Requer homologação no Supabase.

## Experiência do passageiro
- Uma única home, um Google Maps, os campos origem/destino já existentes.
- Trocar para **Corrida Rápida** abre o painel interno: CARRO/MOTO, radar e
  consulta de cobertura. A home não navega para outra tela.
- Drivers públicos são **aproximados** (0,01°), autorizados, online e com
  última amostra GPS em até 90 segundos. Sem ETA individual nem identidade
  pública até atribuição efetiva.
- Passageiros não são limitados pela região de cadastro. A cobertura depende
  da cidade **do embarque validada pelo Google Geocoding no servidor** e
  das flags da modalidade.
- Sem cobertura: mensagem não punitiva e opção de demonstrar interesse, sem
  gravação de coordenadas GPS exatas na tabela de demanda.
- Consultar preço é uma ação explícita. Calcula rota Google Routes e cria
  snapshot imutável no banco por 3 minutos. Recalcula quando o destino/veículo
  mudar. Não solicita preço a cada render.
- O botão de solicitação aceita apenas `quoteId` e reutiliza o RPC de
  corrida profissional existente, com transação e exclusividade de motorista.
- O fluxo legado em /viagem-rapida redireciona para /home.

## Municípios planejados
Fortaleza, Maracanaú, Pacatuba, Guaiúba, Acarape, Redenção, Aracoiaba,
Baturité, Barreira, Ocara, Capistrano, Itapiúna, Aratuba, Guaramiranga,
Mulungu, Pacoti e Palmácia.

A migration cria o inventário **desligado**. Para habilitar um município,
precisa de 3 aprovações separadas no /admin/operacoes:
1. autorização do território e veículo no novo painel comercial;
2. `public_discovery_enabled` e `dispatch_enabled` no controle já existente;
3. uma política de tarifa publicada e validada para região e veículo.

Aprovação do motorista e a seleção de veículo continuam obrigatórias,
e o motorista pode estar online em uma região diferente daquela de seu
cadastro. O radar fica restrito à região de operação autorizada.

## Tarifas

| Modalidade | Referência/Configuração | Comissão |
|---|---|---|
| Moto Maciço | mínimo R$ 7,50 até 11 km + R$6/11 km excedentes | 20% |
| Carro Maciço | tabela base + km + minuto aprovada no admin | 20% |
| Moto corredor Fortaleza | tabela base + km + minuto aprovada no admin | padrão administrado |
| Carro corredor Fortaleza | tabela base + km + minuto aprovada no admin | padrão administrado |
| Atividade oficial georreferenciada | a mesma tarifa do modo | 15% |

Os custos de processamento e a margem mínima são configurados em centavos.
O servidor rejeita cotações com margem inferior à meta. Não depender das
taxas promocionais do Asaas; usar tarifa real contratada.

`intermunicipal_enabled` vem **false** para todas as modalidades. Uma
corrida Fortaleza–Maciço, por exemplo, só pode ser cotada depois que a
operação revisar e liberar legalmente viagens intermunicipais para o modo.
O servidor valida o município de origem e destino; nenhuma localização
ou código do perfil pode manipular a tarifa.

A engine também tem modalidade compartilhada e amigos, no PR #62, mas
**os descontos por múltiplas vagas NÃO estão integrados às corridas rápidas
exclusivas**. Não há sentido em reservar vários assentos de moto.

## Segurança
- Client não envia preço, comissão, política, atividade ou município
  supostamente ativo ao RPC final.
- A API Google reverse geocodifica coordenadas no servidor.
- `caronaa_quick_fare_quotes` tem RLS e **nenhum acesso direto** anônimo
  ou autenticado; inserção via backend/service role e consumo via RPC com
  `FOR UPDATE`, autor autorizado, vencimento e idempotência.
- Execução da antiga `quick_ride_request` foi revogada para autenticados,
  evitando criar pedidos sem cotação.
- Contratos antigos (caronas compartilhadas e despesas) permanecem
  intactos. Nenhum valor anterior é recalculado.
- A migration NÃO cria débitos Asaas, repasses, CPF, chave Pix, transação,
  confirmação automática de pagamento ou liberação de cidades.

## Aceite antes de publicar em produção
1. Executar migration 0139 em staging, confirmar todas funções/tabelas,
   inclusive assinatura de `quick_ride_request` e grants.
2. Com conta de teste de Fortaleza, cotar Redenção **se ela tiver modo ativo**;
   com conta do Maciço, cotar Maracanaú; cadastro não bloqueia.
3. Sem cobertura: origem fora do eixo → aviso + interesse; sem criar corrida.
4. Região conhecida porém modo desabilitado → espera; sem criar corrida.
5. Trocar carro/moto: muda radar e orçamento, mas continua mesma home.
6. Driver de moto não aparece em filtro carro; driver offline/inativo
   e GPS antigo não aparecem no radar.
7. Uma cotação sem tarifa publicada **não pode gerar pedido**.
8. Desabilitar município após cotar: RPC de submit rejeita.
9. Cotação de 3 minutos vencida rejeita.
10. Double click/concorrrência: uma viagem por passageiro; sem
    cobrança duplicada, sem mais de um motorista.
11. Provar R$ 7,50, 11 km, 12 km, comissão 20%; evento oficial geofence
    + horário = 15% e fora = 20%.
12. Configurar custo de Asaas R$1,99 para corrida R$7,50: rejeitar cotação.
13. Testar cobrança Pix manual como fluxo separado, sem misturar com F07.
14. Validação jurídica/regulatória do mototáxi e do intermunicipal.
15. Testar Android e iOS reais, HTTPS, GPS negado, fraco, revogado, e
    mapa com destino/passageiro/motorista reconhecíveis.
16. Rodar TypeScript, Vitest, build, revisar falhas preexistentes e o
    histórico financeiro. Só então marcar a implantação comercial pronta.

## Execução administrativa
No painel de Operações, escolher os municípios elegíveis e aprovar os
parâmetros de cada modo, com versão de política, comissão, custo do
provedor, margem mínima e eventual autorização intermunicipal.
A atividade só cobra 15% se `published=true`, no intervalo cadastrado
e o embarque estiver dentro do raio autorizado.

**Nota:** o piloto QuickRide já possuía estados
SEARCHING→ACCEPTED→ARRIVED→IN_PROGRESS→COMPLETED e
confirmação do embarque; o pacote preserva esse mecanismo e
não substitui verificação documental ou conciliação financeira.
