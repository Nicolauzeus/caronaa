# CARONAA F07 — Homologação da contestação e pós-corrida (0217)

**Ordem:** executar integralmente 0217 no Supabase SQL Editor antes de publicar o frontend da branch. Não reaplicar 0210/0215 depois de 0217.

Regras:
- GPS próximo ao destino é evidência e sugestão de encerramento, não prova de desembarque.
- O motorista solicita desembarque. Até o prazo, mostrar "Aguardando passageiro"; após prazo, "Sem resposta", nunca "Contestação" por silêncio.
- CONFIRMED encerra, NOT_YET retoma a viagem (com proteção contra corrida dupla), CONTESTED requer motivo selecionado e é encaminhado à análise. Outros motivos requerem nota de pelo menos 10 caracteres.
- O passageiro pode responder após o prazo inicial, antes de decisão administrativa. Nenhum timeout gera cobrança automaticamente.
- Admin separa casos contestados de silêncio; decisão com justificativa e auditoria já existentes.
- Pagamento e avaliação somente depois de COMPLETED. A confirmação de exibição da janela pós-corrida é gravada por usuário, sem confirmar Pix ou recebimento.

Testar: confirmação no prazo; NOT_YET e nova solicitação; contestação com motivo; sessão retomada após bloqueio; silêncio classificado sem resposta; decisão admin COMPLETE/CANCEL; pós-corrida disponível após reabertura; motorista sem Pix não gera dados inventados; autorização por participante em todas RPCs.
