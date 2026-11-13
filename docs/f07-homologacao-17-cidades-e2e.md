# F07 — Homologação ponta a ponta: 17 municípios, Carro e Moto

## Escopo aprovado (12/11/2026)

Esta etapa é **exclusiva de ambiente isolado de homologação**, não uma
autorização para operação comercial real. Preserve a lógica do radar
consentido de 0142 e a aprovação administrativa normal em produção.

Municípios do corredor:

| FORTALEZA_CORRIDOR | MACICO_BATURITE |
|---|---|
| Fortaleza | Acarape |
| Maracanaú | Redenção |
| Pacatuba | Aracoiaba |
| Guaiúba | Baturité |
| | Barreira, Ocara, Capistrano, Itapiúna |
| | Aratuba, Guaramiranga, Mulungu, Pacoti, Palmácia |

**Os 17 municípios** estão habilitados para `public_discovery_enabled`,
`dispatch_enabled`, `car_enabled` e `moto_enabled` APENAS após executar
o script de ativação em um banco de testes. A região cadastrada não
restringe o GPS: vale a localidade real validada no servidor pelo Google.

## Políticas de preço homologáveis

| Região | Veículo | Base | Por km | Por min | Mínimo | Comissão | Margem mínima | Versão |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Maciço | Moto | — | Regra especial | — | R$ 7,50 | 20% | R$ 0,50 | `macico-moto-piloto` |
| Maciço | Carro | R$ 5,00 | R$ 2,00 | R$ 0,30 | R$ 10,00 | 20% | R$ 1,00 | `macico-car-piloto` |
| Fortaleza | Moto | R$ 3,50 | R$ 1,20 | R$ 0,20 | R$ 6,00 | 15% | R$ 0,50 | `fortaleza-moto-piloto` |
| Fortaleza | Carro | R$ 5,50 | R$ 2,20 | R$ 0,35 | R$ 12,00 | 15% | R$ 1,00 | `fortaleza-car-piloto` |

- Regra especial de Moto no Maciço: R$ 7,50 até 11 km, depois o acréscimo
  marginal de R$ 6,00/11 km somente no excedente, conforme engine existente.
- Preços de Carro e Moto exclusivos **não** modificam os R$ 6/11 km das caronas
  compartilhadas. Para intermunicipal usa-se a política do embarque, exigindo
  autorização do município de origem **e de destino** (ambos no catálogo).
- No piloto `processing_fee_cents=0` por não existir custo bancário
  informado; isso não representa o custo real de um PSP. Não ativar em
  produção sem homologar taxas, licenças e margens.
- A rota real e o tempo vêm de Google Routes no servidor. Cotação e destino
  são imutáveis; mudanças de cobertura após cotação bloqueiam submissão e
  aceite. Cotações antigas sem município de destino verificado são rejeitadas.

## Checklist de implantação segura

1. **Não usar o banco do domínio público**. Provisionar Supabase/Postgres
   separado para homologação e usar usuários de teste sem informações reais.
2. No banco de homologação instalar na ordem as migrations existentes,
   incluindo 0128, 0129, 0139, 0140, 0141, 0142, e depois:
   `drizzle/migrations/0143_f07_homologacao_end_to_end.sql`.
   Essa migration instala funções e mantém `caronaa_f07_pilot_control.enabled=false`.
3. Criar deploy do aplicativo apontando **somente para esse banco de testes**.
   Configurar variáveis **privadas no backend**:
   `CARONAA_DEPLOY_ENV=homologacao`,
   `CARONAA_F07_TEST_MODE=enabled` e
   `SUPABASE_SERVICE_ROLE_KEY` do banco de testes. As chaves privilegiadas
   não devem entrar em `VITE_*` nem no bundle cliente.
4. **Depois do deploy e backup**, no mesmo contexto SQL de homologação,
   executar `SET caronaa.f07_target = 'homologacao';` e o conteúdo do arquivo
   `scripts/sql/f07-homologacao-ativar.sql`. Se usar editor SQL, executar
   tudo na mesma sessão/transação; o script falha caso o marcador falte.
5. Conferir que os 17 municípios possuem os quatro flags `true` e que
   existem exatamente as quatro políticas com `published=true` e
   `intermunicipal_enabled=true`. Não alterar os controles do banco público.
6. O botão **Ficar disponível** com `MOTO` ou `CAR` ativa o piloto
   temporário via função de servidor autenticada + RPC somente `service_role`.
   O evento é auditado separadamente, não finge revisão de administrador.
   A habilitação só vale enquanto o banco e o backend estiverem em modo de
   homologação, por até 14 dias. Pendências da fila admin normal não travam
   o piloto, mas também não viram aprovações manuais.
7. **GPS exige opt-in explícito**, HTTPS, zona aprovada e motorista online,
   sem 3 débitos impeditivos. O nome da região do cadastro nunca é usado como
   prova de município; município atual é verificado pelo Google.

## Roteiro ponta a ponta (duas sessões e dispositivos)

- Motorista01: confirmar e-mail, entrar em
  `/disponibilidade-profissional`, selecionar **Moto**, clicar Ficar
  disponível, consentir GPS em Redenção, cadastrar uma chave Pix **de teste**
  no fluxo de pagamentos. Deve aparecer em radar do passageiro na cidade
  do GPS e ver fila em `/viagem-rapida`.
- Passageiro (conta distinta): Home → Viajar agora → Moto; selecionar
  origem Redenção e destino Fortaleza. O servidor deve confirmar os dois
  municípios, obter Google Routes e apresentar o preço da matriz do Maciço
  **antes** de permitir enviar. O pedido aparece na fila do motorista
  com total e remuneração.
- Motorista aceita → Cheguei → passageiro confirma embarque → motorista
  Iniciar → Concluir. Validar um único débito de comissão por corrida no
  `caronaa_quick_driver_fees`. O passageiro e o motorista veem o
  **QR Pix estático** de valor extraído exclusivamente do snapshot da cotação.
  Não escanear com chave real; o código não simula confirmação bancária.
- Motorista02: repetir com **Carro** e origem Fortaleza, destino Redenção.
  Repetir também viagens intramunicipais, nas quatro matrizes, e trocar
  localização atual entre municípios diferentes da região de cadastro.
- Negativas obrigatórias: usuário não autorizado fora do piloto, conta
  sem email verificado, GPS negado, cidade desconhecida, sinal com mais de
  90 segundos, driver offline, comissão em débito, tarifa retirada no meio
  da cotação, destino desativado antes do aceite, terceiro tentando obter
  Pix, Pix antes de concluir e viagem sem chave Pix.
- Executar `npm test -- src/lib/quick-rides src/components/caronaa/QuickRideHomePanel.test.tsx`,
  `npx tsc --noEmit`, `npm test` e `npm run build`.
  Homologação real com duas contas e Google Routes depende de credenciais,
  rede e ambiente de testes; testes unitários não comprovam isso.

## Desativação segura

- `UPDATE public.caronaa_f07_pilot_control SET enabled=false,updated_at=now() WHERE id=true;`
  é um *kill switch* que bloqueia novas cotações e aceites do piloto,
  sem impedir a conclusão segura de corridas já iniciadas.
- Encerrar cada piloto pelo RPC service-only
  `caronaa_f07_pilot_deactivate_driver(p_user_id)`, que deixa offline,
  apaga coordenadas e revoga a autorização de teste quando não existe
  aprovação humana independente.
- Para rollback total em ambiente descartável, restaurar o snapshot do banco
  feito antes da ativação. Não executar `DROP` ou apagar contas em produção.
- O QR Pix não liquida nem confirma pagamento. Nenhum piloto equivale a
  licença de mototáxi, habilitação de transporte, seguro ou cumprimento legal.
