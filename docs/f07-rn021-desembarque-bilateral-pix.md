# CARONAA F07 — RN021 | Desembarque bilateral e Pix coerente

**Data:** 19/11/2026  
**Escopo:** Corrida Rápida (carro e moto). Não altera carona compartilhada/agendada, cálculo de tarifa, PIN de embarque nem repasse.  
**Dependências:** migrations 0157 (declarações Pix) e 0210 (encerramento seguro), mais 0213/0214 conforme ambiente.

## Política operacional

1. O motorista pede **desembarque** sem escrever justificativa e sem bloqueio obrigatório por GPS. O GPS recente, quando houver, é registrado somente como evidência.
2. O banco passa de `IN_PROGRESS` para `PENDING_REVIEW` com `quick_ride_dropoff_reviews.participant_only=true` **imediatamente**. Este é um estado técnico não operacional de **aguardando confirmação**, não uma demanda administrativa.
3. O motorista pode aceitar outros chamados, mas o transporte ainda **não foi declarado concluído** para fins financeiros.
4. O passageiro pode confirmar quando voltar a ficar online, sem expiração da permissão. O servidor valida que é o participante da corrida.
5. O passageiro pode escolher **Já desembarquei**, **Ainda estou na viagem** ou **Contestar desembarque**. A primeira resposta muda para `COMPLETED` e libera Pix/avaliação. A segunda restaura `IN_PROGRESS` e permite nova solicitação após 20 segundos, sem envolver o suporte. Se o motorista já aceitou outra corrida ativa, restaurar a antiga geraria duas viagens simultâneas; nesse caso o servidor rejeita a restauração e orienta o passageiro a contestar. Só uma contestação real entra na fila administrativa.
6. Silêncio, ausência de GPS, abandono de formulário e clique no QR **nunca** são pagamento, consentimento de desembarque ou evento de comissão.
7. Eventos são idempotentes sob lock por corrida. Os registros anteriores de `PENDING_REVIEW` permanecem preservados.
8. A fila administrativa mostra contestações verdadeiras e casos legados, não todas as solicitações novas.

## Pix

- **Motorista:** QR Pix com valor bruto do cliente e chave do recebedor; botão de confirmar recebimento só após conferir o banco.
- **Passageiro:** Pix Copia e Cola com valor completo como ação principal, cópia somente da chave como secundária, QR opcional.
- Ambos usam `get_completed_quick_ride_pix`, que fixa na primeira consulta válida de viagem concluída os campos `recipient_key`, `recipient_name` e `amount_cents` em `quick_ride_pix_checkout_snapshot`. Atualizações futuras no perfil do motorista **não** mudam o destinatário de cobranças já geradas.
- Pagamento é manual e diretamente ao motorista. As duas declarações são independentes. O sistema **não** confirma o extrato bancário, **não** transfere dinheiro e **não** quita automaticamente a comissão.
- O valor é `caronaa_quick_fare_quotes.customer_pays_cents`, com verificação de composição: `driver_receives_cents + platform_commission_cents`.
- Em ambiente piloto, **não realizar Pix real**.

## Ordem de implantação

1. Confirmar em Supabase que 0157 e 0210 foram aplicadas.
2. Aplicar **manualmente** `drizzle/migrations/0215_f07_bilateral_dropoff_and_independent_pix.sql` em homologação; validar o `COMMIT` e o schema PostgREST.
3. Executar testes de segurança de RPC e os fluxos abaixo em dois dispositivos autenticados, motorista e passageiro. Não enviar dinheiro real em ambiente de teste.
4. Aplicar a migration no banco de produção **antes** de publicar o frontend atualizado pelo Lovable. A alteração no GitHub não executa SQL automaticamente.
5. Publicar frontend e acompanhar o percentual de `PENDING_REVIEW` sem `passenger_response` e taxa de conclusão. Não interpretar esses casos como receita recebida.

## Matriz de homologação

| Cenário | Esperado |
|---|---|
| GPS fraco ou a mais de 250 m | Pedido é enviado ao passageiro; a discrepância só é evidência |
| Passageiro confirma logo | Status `COMPLETED`, comissão uma vez, Pix acessível a ambos |
| Passageiro responde **Ainda estou na viagem** | Volta a `IN_PROGRESS` se motorista não está atribuído a outra corrida; pode solicitar novamente e fica auditado |
| Motorista já aceitou outra corrida | Não criar duas corridas ativas; orientar passageiro a contestar para proteção e análise |
| Passageiro offline por 2 min, 1h ou dias | Motorista livre; passageiro pode confirmar quando reconectar |
| Passageiro contesta | Suporte recebe contestação; Pix bloqueado até resolução |
| Motorista clica duas vezes | Uma linha de confirmação, sem duplicar evento, tarifa ou comissão |
| Motorista atualiza chave Pix após QR criado | Chave antiga da cobrança já emitida permanece fixa para ambos |
| Passageiro copia Pix no celular | Payload completo com valor e recebedor fixos |
| Motorista declara recebimento antes de passageiro clicar | Evento `DRIVER_ACKNOWLEDGED` único; sem falsa conciliação |
| Passageiro declara após o motorista | Evento `PASSENGER_DECLARED` único, sem apagar o recebimento |
| Motorista não cadastrou chave Pix | Tela solicita cadastro; valor e histórico permanecem guardados |
| Cancelamento, PIN, avaliação | Não alterados; avaliação continua opcional após conclusão |

## Alertas operacionais

- Um desembarque pendente **não é cobrança vencida confirmada nem pagamento recebido**.
- `NOT_YET` não é contestação. O passageiro apenas avisa que continua no trajeto; o motorista vê o estado e pode solicitar novamente depois da chegada.
- Um motorista pode declarar recebimento após conferir o banco, mas o CARONAA não pode provar bancariamente essa afirmação sem integração autorizada.
- Se uma pessoa nunca confirmar o desembarque, a pendência continua disponível no histórico; qualquer cobrança coercitiva ou conclusão administrativa precisa de evidências e procedimento próprio.
- O nome legado `PENDING_REVIEW` é mantido por compatibilidade de RPCs. `participant_only` distingue o aguardo bilateral da revisão administrativa.

