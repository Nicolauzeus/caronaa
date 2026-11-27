# F07 — Validação da janela Flash

## Módulo e situação atual

O README permite pedir Flash com cotação válida mesmo sem motorista online, mantendo busca de até 30 minutos, cobertura autorizada, raio de 15 km, GPS, autorização e regras financeiras.

Na consulta de 27/11/2026, a janela **já estava renovada por outra ação**, até **27/12/2026 às 14:56 (Fortaleza)**, com `enabled=true`. Não apliquei nenhuma alteração ao banco nesta tarefa.

## Verificações

- Conta autenticada: `caronaa_quick_region_status` retornou **ENABLED nas 34 combinações**, Carro e Moto nos 17 municípios do catálogo.
- **116 testes passaram em 15 arquivos**, cobrindo cotação, cobertura, despacho, solicitação sem motorista online, falha do radar, cotação ausente e expiração.
- A função instalada `caronaa_quick_submit_quoted` mantém cotação pertencente ao passageiro, prazo válido, origem/destino autorizados, idempotência e `SEARCHING` por **30 minutos**.
- Os testes de interface usam serviços simulados; não criei corrida real nem validei o fluxo completo no APK ou no celular. Avisos de atualização React fora de `act` apareceram, sem falhas nos testes.

## Alterações e arquivos

Apenas registro de validação neste relatório e em `roadmap.md`; nenhum preço, consentimento, permissão ou código operacional foi alterado.

## Pendência e alinhamento ao README

A renovação de **90 dias não foi aplicada**. A orientação anterior de simplesmente renovar esse controle no banco público omitiu uma restrição importante: o README e as instruções do projeto reservam esse piloto de homologação a banco e servidor isolados. O banco disponível nesta sessão é compartilhado com o aplicativo publicado.

É necessário decidir se a intenção é renovar um ambiente isolado de testes ou aprovar uma revisão expressa da regra para operação pública. A segunda opção exige revisar os efeitos do piloto e seus bloqueios antes de habilitar qualquer exceção; não equivale a licença ou liberação legal de transporte.

### SQL solicitado — apresentado para revisão, não executado

```sql
UPDATE public.caronaa_f07_pilot_control
SET enabled = true,
    expires_at = now() + interval '90 days',
    updated_at = now()
WHERE id = true;
```

Não será usada a alternativa contínua nem removido `activated_at`. A aprovação do SQL não deve ser confundida com autorização automática para retirar a separação entre homologação e produção.

## Revisão solicitada — operação pública (27/11/2026)

O proprietário escolheu **revisar a operação pública**, não aprovar automaticamente a renovação. A leitura das funções instaladas confirmou que o controle atual tem duas responsabilidades:

1. Permite a cobertura comercial em `caronaa_quick_region_status` quando modalidade, radar, despacho e tarifa também estão habilitados.
2. Permite que a função privilegiada `caronaa_f07_pilot_activate_driver` emita autorizações temporárias e marque presença disponível. A renovação não chama essa função nem aprova contas por si só, mas prolonga o período em que ela pode ser utilizada; não renova automaticamente as autorizações individuais já emitidas.

Por isso, o UPDATE isolado acima **não é a proposta recomendada para produção**. Uma janela de serviço público deve ser independente das exceções de homologação.

### Proposta de regra para aprovação

- Autorizar a preparação de uma janela pública de **90 dias contados da ativação**, sem operação contínua e sem ativação imediata nesta revisão.
- Limitar Carro/Moto aos municípios e tarifas explicitamente aprovados para produção; o catálogo de 17 cidades e suas quatro tarifas de teste não se tornam comerciais automaticamente.
- Separar o controle de operação pública do controle de testes, sem desligar o serviço vigente durante a transição. Não alterar `activated_at` para contornar a expiração.
- Manter a habilitação normal do motorista no servidor, dados completos, suspensões/rejeições, veículo ativo, regras financeiras, GPS real consentido e filtros operacionais. Não converter autorizações temporárias em permanentes.
- Preservar o raio de **15 km**, a cotação imutável, a autorização de origem/destino e a regra de pedir com **zero motoristas**, buscando por até **30 minutos**, sem cobrança antes da conclusão.
- Manter simulações e ativações temporárias de homologação restritas ao ambiente isolado; não estender essas exceções à produção.
- Preservar a tarifa compartilhada F03 de **R$ 6/11 km**, as tarifas profissionais vigentes e os snapshots históricos. Qualquer adoção comercial de tarifas de teste exige decisão separada.
- Não tratar aprovação de produto como licença de transporte: conformidade municipal, habilitação, seguro e segurança operacional continuam exigindo avaliação antes da liberação real.

### Sequência após aprovação da proposta

Auditar todos os consumidores do controle e as configurações comerciais; preparar alteração incremental com SQL completo, reversão e testes; apresentar o SQL para **nova aprovação explícita**; somente então aplicar e validar o fluxo autenticado de cotação → solicitação → leitura do pedido, inclusive ausência de motoristas. Não criar pedidos reais nesta revisão.

### Resultado desta revisão

**Módulos:** F07, com preservação de F02/F08. **Status:** proposta, não ativada. **Arquivos:** este relatório e `roadmap.md`. **Verificação:** leitura das funções efetivamente instaladas; nenhum novo teste funcional executado. Os 116 testes relatados acima pertencem à etapa anterior. **Pendências:** aprovação desta regra, configuração comercial/conformidade, SQL completo aprovado e validação real. **README:** regra vigente preservada; alteração contratual somente após aprovação expressa do escopo proposto.