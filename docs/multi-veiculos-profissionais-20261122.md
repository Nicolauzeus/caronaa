# CARONAA — Múltiplos veículos por motorista (22/11/2026)

## Decisão
Uma única conta de motorista pode ter carro, moto e vários veículos, cada um identificado por placa própria, marca, modelo, cor e vagas. A matrícula profissional não é mais requisito para concluir o cadastro ou ser mostrada em UI. Os dados históricos são preservados no banco.
Um único veículo fica ativo por vez para o radar profissional. As regras de despacho, preço e território continuam usando o tipo do veículo ativo e GPS.

## Banco e migrações
- 0245_professional_multiple_vehicles.sql: cria professional_driver_vehicles, aplica RLS, exclusividade de veículo ativo e validação de placa; mantém o fluxo de cadastro com a assinatura antiga p_registration_number (sempre opcional). Adiciona RPC de listar, salvar e ativar veículos. Retroimporta placas e modelos válidos autorizados sem alterar viagens.
- 0246_remove_registration_from_passenger_radar.sql: retira a matrícula de quick_ride_request_audience, mostra a placa somente depois do aceite e impede que aprovação atual ignore pendências e rejeições anteriores.
- O cadastro de mototaxista não exige matrícula e o registro antigo permanece opcional no banco.

## Fluxo
1. A conta confirmada conclui o cadastro inicial com um veículo, placa válida e foto pessoal.
2. Em Perfil do Motorista → Veículo → Meus veículos, adiciona outros carros ou motos; salvar não altera a operação em andamento.
3. Para trocar, fica offline e conclui viagens e ofertas ativas. Seleciona Usar este veículo. O servidor atualiza perfil e autorização na mesma transação.
4. A troca atualiza a tela sem recarregar toda a página; protege a sessão PWA. Os pedidos continuam restritos ao tipo ativo.

## Auditoria de compatibilidade
Na aplicação de 0245, existiam 29 contas com autorização profissional, das quais 28 tinham veículo completo e placa elegível para a importação automática. Um cadastro legado incompleto permaneceu sem placa presumida; deverá registrar uma válida. Quatro valores históricos de matrícula permanecem para auditoria.
Não foram criadas corridas, pedidos, motoristas nem placas fictícias.

## Homologação necessária
- Cadastro MOTO sem matrícula, com placa, foto e confirmação de e-mail
- Segundo veículo CAR com placa própria; depois segundo veículo MOTO se desejado
- Selecionar MOTO e CAR offline, verificando apenas o tipo ativo no radar
- Troca bloqueada enquanto online, com corrida aceita ou carona ofertada
- Placa inválida, autorização revogada, conta sem foto, tentativa de acessar outro veículo e chamadas anônimas devem falhar
- Verificar os dados anteriores e o histórico de viagens intactos
- Passageiro não recebe matrícula; placa aparece apenas quando o motorista aceita
- Verificar painel no iPhone, Android e desktop sem rolagem interna

Status: migrações aplicadas no banco. Sincronização Lovable, build e testes E2E dependem de publicação e runner CI.