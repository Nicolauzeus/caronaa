# CARONAA — Operações de Mobilidade unificadas (22/11/2026)

## Produto e escopo
Módulos F02/F03/F04/F05/F07/F09. Preservadas: conta única, consentimentos, tarifa F03/F07, autenticidade de GPS, pagamento Pix, raio de despacho e permissões administrativas.

### Navegação
1. Central: painel ao vivo e mapa Google. Camadas Todos / Corrida Rápida / Caronas. Camada compartilhada combina ofertas, pedidos e pontos de embarque das corridas compartilhadas confirmadas sem chamar esses pontos de GPS ao vivo.
2. Viagens: subabas Caronas, Solicitações, Correspondências. Componentes OperationPage existentes reutilizados; URLs históricas mantidas para links antigos.
3. Pessoas: subabas Motoristas e Passageiros. Mesma tabela administrativa com último acesso autenticado (últimos 30 dias) quando disponível, sem presumir online quem está apenas cadastrado.
4. Relatórios: histórico e resultados, exportações e agendamentos por e-mail (infraestrutura obrigatória). Período e serviço permanecem filtros válidos; PDF agrega dados da fonte real.
5. Inteligência: funil por pessoas distintas, cotações por preço, horários de pico e de menor movimento, mapa de calor, usuários autenticados, consumo Maps, demanda F07 por município.
6. Configurações: WhatsApp persistido com edição administrativa. Valor verificado no banco: +244944175424 (não hardcode).

### Banco incremental
- `0239_admin_shared_operations_live.sql`: read-only, admin-only, ofertas/pedidos futuros com coordenadas válidas. Sem alteração dos contratos de match/despacho.
- `0240_admin_operations_intelligence.sql`: agregação por pessoa sem inflar com múltiplas chamadas; cotações F02/F03/F07 e pedidos/aceites/conclusões, e lista de municípios para pedidos F07. Origem livre de caronas não implica município.
- `0242_admin_intelligence_shared_request_dedupe.sql`: evita contagem múltipla de um mesmo pedido compartilhado quando há mais de uma tentativa de matching.
- `0241_admin_shared_active_ride_map.sql`: amplia snapshot para caronas confirmadas/em andamento com embarques contratados. **Não** infere GPS do motorista.

Instaladas com dry run e queries de verificação no banco do projeto. Todas as RPCs de leitura verificam `auth.uid()` + papel admin e restringem a exposição dos dados a contas autorizadas.

### Integridade das métricas
- Visitante anônimo ou pessoa que apenas abriu o aplicativo antes da migração 0237 não pode ser identificada retroativamente pelos logs do Google Maps.
- Usuários autenticados únicos podem ser medidos a partir da instrumentação instalada em 0237 e publicação do frontend que a chama. Mudança de papel pode fazer um mesmo usuário aparecer nas categorias sem duplicar o total.
- Cotações são tarifas realmente emitidas e podem repetir a mesma pessoa; não confundir com buscas Google Places.
- Consultas Google Maps internas não equivalem ao consumo faturado do Google Cloud.
- Apenas F07 possui município de solicitação suficientemente registrado para esse painel; ofertas F02/F03 não recebem classificação territorial heurística.
- Gráficos por hora incluem períodos de ZERO pedidos ao analisar horários menos movimentados.
- Histórico e PDF usam dados reais; nenhuma projeção dos antigos +108 pedidos.

## Homologação mínima necessária
- [ ] GitHub Actions recebe runner, `npm run check`/typecheck e suíte Vitest passam
- [ ] Lovable sincroniza a última main e publica preview/produção (atualmente falta crédito)
- [ ] Testar em desktop/Android/iPhone as 6 abas com navegação por hash, troca de tema e reload
- [ ] Central com oferta compartilhada futura real, pedido aberto real e corrida compartilhada em andamento
- [ ] Validar GPS real/F07, 90 segundos de validade, atualizações a cada 10 segundos, sem interferir na experiência motorista/passageiro
- [ ] Confirmar pedidos Flash sem motorista, aceites posteriores, expirados e cancelamento dentro das regras de servidor
- [ ] Validar perfis Motorista/Passageiro com e sem histórico de acesso autenticado
- [ ] Conferir filtros Hoje/7d/30d/Personalizado e modalidades, sem divergência de contagens
- [ ] Imprimir PDF colorido com logo oficial, sem sidebar, com consumo Google Maps e usuários autenticados
- [ ] Compartilhar PDF por WhatsApp Web Share (fallback exige anexo manual) e por e-mail com Resend configurado
- [ ] Configurar Secrets do agendador e validar diário/semanal/mensal, entrega e logs; desativado enquanto infraestrutura não estiver pronta
- [ ] Validar privacidade das RPCs como usuário comum, assinante não-admin, e conta sem sessão

## Pendências externas/bloqueadores
1. GitHub Actions: execuções anteriores falharam sem iniciar etapas/runner. O código aqui não corrige a indisponibilidade do runner/conta.
2. Lovable: `needs_attention: out_of_credits`. Commit na main não comprova publicação.
3. Envio agendado: credenciais Resend e DNS/remetente verificado + token/runner ainda exigidos. Não afirmar que e-mail chegou ao destinatário se apenas a API aceitou a mensagem.
4. GPS e município: auditoria não substitui habilitação legal/operacional; usar somente os municípios aprovados.

**Status**: alterações de código implementadas, migrações de consulta validadas, E2E e publicação pendentes. Não afirmar conclusão integral antes da homologação.
