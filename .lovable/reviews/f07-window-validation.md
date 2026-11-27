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