# CARONAA — Comissões por viagem, fechamento Pix e correção do seletor

## Situação

Migration: `0140_driver_commission_statements.sql` (não aplicada pelo merge).
Pré-requisitos: `0131`, `0135`, `0139` no ambiente de **homologação**.
Sem cobrança Asaas ou confirmação bancária automática.

## UI

O seletor usa duas colunas em telefones estreitos (Corrida Rápida ocupa
linha completa) e três colunas maiores, sem estourar a largura. O painel
do mapa conserva altura limitada pelo viewport dinâmico e toda a extensão
de formulário (carona comum ou Corrida Rápida) rola **internamente**, sem
cortar botões, sobrepor o mapa ou gerar rolagem horizontal.

Validar visualmente larguras 320, 360, 390, 430, 768 e 1280 pixels, com
teclado móvel aberto e alternância repetida CAR → MOTO → EXCLUSIVE → CAR.

## Razão financeira

| Origem | Instante de reconhecimento | Dívida original |
|---|---|---|
| Carona compartilhada | Viagem COMPLETED + Pix manual confirmado por passageiro e motorista | `driver_platform_fees` (legado, preservado) |
| Corrida Rápida | Transição autorizada para COMPLETED com uma cotação F07 | `caronaa_quick_driver_fees`, única por viagem |

A taxa não deve vir de um percentual único exibido no cliente.
Cada F07 usa `caronaa_quick_fare_quotes.platform_commission_cents` e
`commission_bps` gravados antes do pedido. Valores históricos de 15%
ou 16,86% permanecem inalterados. O Maciço pode aplicar 20% ou 15% em
atividade oficial elegível, de acordo com a cotação existente.

O saldo é a soma dos débitos **não quitados** das duas origens. O limite
de três viagens com repasse pendente considera ambas; o radar para de
anunciar o condutor ao atingir o limite.

## QR Pix da comissão

1. O próprio motorista seleciona um débito aberto ou todos os débitos
   disponíveis. A RPC trava cada registro, utiliza a chave Pix oficial da
   plataforma, soma centavos no servidor e cria um fechamento com ID próprio.
2. Cada débito tem vínculo único a um fechamento. Uma repetição do pedido
   não gera nova cobrança para as mesmas corridas.
3. O QR estático BR Code inclui valor fixo (campo 54) e txid do fechamento
   (campo 62.05). Nunca recebe `amount`/percentual enviados pelo cliente.
4. Se o motorista fizer mais viagens, o QR já emitido não muda. Novos
   débitos serão cobrados em fechamento separado.
5. O motorista paga no aplicativo bancário e declara o identificador
   EndToEndId da transação. A situação muda para `CLAIMED`, **não** para
   `SETTLED`.
6. O Financeiro verifica no banco o nome do recebedor, valor,
   referência e recebimento real; somente então a RPC quita
   atomicamente os débitos específicos do fechamento.
7. Na rejeição, o fechamento volta a OPEN com o mesmo ID/valor.
8. Por segurança, uma comissão que já está num fechamento não pode
   também ser quitada pelo fluxo legado individual de Pix.
9. Um fechamento não pode registrar o mesmo EndToEndId de outro,
   mesmo que os motoristas sejam diferentes.

**Limitação:** QR estático e Pix copia-e-cola NÃO fazem débito automático,
não provam que um Pix foi recebido e não conciliam extratos sozinhos.
A integração Asaas de cobrança dinâmica por fechamento poderá ser uma
etapa posterior, somente após análise de tarifa, idempotência, webhook
verificado, conciliação de estorno e autorização financeira.

## Pré-voo SQL (homologação)

```sql
SELECT
  to_regclass('public.caronaa_quick_driver_fees') IS NOT NULL AS quick_debt,
  to_regclass('public.caronaa_driver_fee_statements') IS NOT NULL AS statements,
  to_regclass('public.caronaa_driver_fee_statement_items') IS NOT NULL AS items,
  to_regprocedure('public.get_my_caronaa_commission_ledger()') IS NOT NULL AS ledger_rpc,
  to_regprocedure('public.create_my_caronaa_fee_statement(text,uuid)') IS NOT NULL AS issue_rpc,
  to_regprocedure('public.admin_verify_caronaa_fee_statement(uuid,boolean)') IS NOT NULL AS finance_rpc;
```

Tudo deve retornar `true`. Use contas autenticadas reais para testar RPCs
de acesso privado, porque rodar SQL como administrador pula as políticas RLS.

### Casos obrigatórios

- F07 COMPLETED com cotação aprovada gera exatamente um débito.
- F07 CANCELLED/EXPIRED/SEARCHING nunca gera débito.
- F07 pré-0139 sem cotação não recebe comissão inventada.
- Valor do QR de 1 corrida e de N corridas igual à soma exata das dívidas
  vinculadas em `caronaa_driver_fee_statement_items`.
- QR de R$ 1,50 e R$ 8,05 é válido, contém txid próprio e valor correto.
- Três débitos mistos (2 compartilhadas + 1 rápida) desligam radar e bloqueiam
  novos aceites; a quitação verificada retorna elegibilidade.
- Novo débito depois da emissão não altera fechamento anterior.
- Dupla tentativa concorrente de gerar QR não duplica itens.
- Documento de um motorista não é exibido para outro.
- Usuário comum não valida/quita Pix nem altera valor da dívida.
- Marcar Pix como enviado não libera o motorista; finance confere e só depois
  quita. Comprovante duplicado deve ser rejeitado.
- Cobrança Pix manual individual legada permanece acessível quando 0140
  ainda não está aplicada.
- Mudança da chave Pix oficial não altera QR previamente emitido:
  a administração deve reconciliar/invalidar conscientemente os
  fechamentos abertos antes de rotacionar a chave.
- Testes TypeScript, Vitest e build passam no PR atual.

## Observação de produto

O registro de dívida F07 ocorre após a corrida atingir COMPLETED, que é
um evento operacional, não comprovante bancário de pagamento do passageiro.
Antes da operação comercial, implantar também disputa/revisão de
corridas não pagas, reembolsos e conciliação do recebimento ao motorista.
Nunca marcar automaticamente uma comissão como paga na geração do QR.
