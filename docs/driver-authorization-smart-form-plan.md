# CARONAA — Autorização inteligente de motorista

## Fonte e reaproveitamento
- Conta/perfil: nome, foto, contato e dados existentes do veículo; buscar primeiro, pré-preencher e permitir correção na mesma tela.
- Onboarding: região é sugestão de município, nunca confirmação automática.
- Pesquisa: respostas verificadas e vinculadas podem fornecer sugestões com consentimento e confirmação explícita; nunca concedem autorização nem alteram o histórico.
- Solicitação: snapshot imutável dos dados efetivamente confirmados pelo motorista, para auditoria administrativa.

## Formulário único
Nome completo, foto, carro/moto, marca, modelo, cor obrigatória nos dois casos, placa, categoria somente para carro, vagas compatíveis e município. Ocultar dados já completos em resumo editável, não pedir novamente e destacar pendências. Permitir editar foto na mesma experiência; upload no bucket avatars com pasta por usuário.

## Critérios de aceitação
- Só mostra sucesso após persistência confirmada: 'Solicitação enviada com sucesso. Aguardando análise administrativa.'
- Erro de upload ou de cadastro não pode gerar sucesso falso.
- Uma solicitação pendente por usuário; alterações de status explícitas.
- Aprovação exclusivamente administrativa; nenhuma liberação do radar sem autorização ativa.
- Cor do veículo validada no backend e incluída no snapshot da solicitação e na fila de análise.
- Preservar compatibilidade de solicitações legadas e eventos de auditoria.
- Testes: formulário vazio/parcial/completo, carro/moto, troca de foto, envio repetido, análise/rejeição/correção/aprovação, acesso sem autorização, persistência após recarregar.

## Implantação
Não publicar nem aplicar SQL na produção antes de revisão, migração incremental idempotente, testes estáticos e homologação funcional com motorista e administrador.
