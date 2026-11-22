# CARONAA — Auditoria de conclusão de Operações (22/11/2026)

## Diagnóstico verificado: Histórico & Relatórios

Consulta real do período de sete dias, em 22/11/2026: 72 pedidos F07, 0 solicitações de carona compartilhada no recorte.

- 31 pedidos aceitos pelo menos uma vez; desses, 21 concluídos e 10 cancelados depois de aceitos.
- 41 pedidos nunca aceitos; desses, 24 cancelados antes do aceite, 16 expirados (15 já gravados como EXPIRED, 1 vencido ainda gravado como SEARCHING) e 1 aguardando no prazo.
- Portanto, 72 = 21 concluídos + 34 cancelados + 16 expirados + 1 aguardando; 34 = 24 cancelados sem aceite + 10 cancelados após aceite. Indicadores antes exibidos misturavam duas dimensões, não se tratava de 34 pedidos adicionais.
- A migration 0235 expõe as partições explicitamente e projeta busca vencida como expirada no relatório, sem alterar status real no banco.
- Cenário de apresentação: +108 solicitações hipotéticas aguardando, somente enquanto o administrador ativa o botão, com rótulos permanentes. Nunca persistir, enviar no CRM, inventar pessoas nem alterar históricos/repasses. Exemplo do recorte: 72 reais + 108 demonstrativos = 180 no cenário; aguardando: 1 real + 108 = 109; nunca aceitos: 41 +108 =149. Com aceite =31, concluídos=21, cancelados=34 e expirados=16 permanecem reais.

## Pendências para concluir Operações (priorizadas)

1. **P0 — Validar release:** restaurar runners do GitHub Actions (job CARONAA Quality falha antes de executar etapas), passar Vitest, build e testes visuais em desktop e mobile; confirmar que Lovable recebeu a main e publicar versão verificada.
2. **P0 — Homologação ponta a ponta F07:** passageiro solicita com 0 motoristas; entra motorista elegível dentro do raio de 15 km; pedido recebe aceite sem duplicar e sem alterar preço; testar cancelamento, expiração, restabelecimento de rede, GPS stale e corrida concluída sem pagamento automático.
3. **P0 — Integridade e governança de KPIs:** normalização operacional de pedidos vencidos, contagem exclusiva por status, cancelamentos antes/depois de aceite, eventual motivo do cancelamento, confirmação de tarifa final versus pagamento efetivamente conciliado e reconciliação de modalidade compartilhada em períodos com volume real.
4. **P1 — Central com todas as modalidades:** o Centro de Operações renderiza o cockpit F07; falta integrar caronas compartilhadas, ofertas/solicitações/matches com camadas específicas, filtros de serviço e locais sem expor GPS preciso antes de autorização.
5. **P1 — Arquitetura da navegação:** organizar Caronas + Solicitações + Correspondências como gestão de despacho/matching, com subtelas; Motoristas + Passageiros como Pessoas, mantendo permissões e ações atuais; avaliar duplicações com ferramentas e indicadores do Centro.
6. **P1 — Engagement de aquisição e perda:** instrumentar eventos reais de entrada na Home, intenção, cotação, solicitação, visualização por motorista, aceite, cancelamento e expiração. Mostrar conversão de visitantes→pedidos→aceites→conclusões sem confundir pessoas distintas com número de pedidos.
7. **P1 — Territorialidade e horário:** filtros por município de origem, modalidade, dia da semana e horários; mapa de calor de oferta × demanda com dados efetivos, sem recompor históricos de presença inexistentes.
8. **P1 — Relatórios e comunicação:** configurar serviço Resend, remetente verificado e GitHub workflow com secrets seguros e runners; testar disparos diário, semanal e mensal, webhooks de entrega e retentativa, exportação integral por filtro (CSV atual é só da página) e PDF paginado com relatório legível.
9. **P2 — UX:** remover altura vazia excessiva no gráfico, melhorar o mapa de calor em 320–430 px sem zoom horizontal permanente, preservar marca #FFBB00/#121212, permitir leitura sem cortes, loading, erro e estados vazios.
10. **P2 — Observabilidade e segurança:** logs estruturados de erro de despacho sem dados sensíveis, limites de consulta, incidentes, auditoria de ações administrativas e testes RLS/privacidade.
11. **P2 — Suporte:** confirmar que todas as superfícies que apontam para WhatsApp usam a configuração persistida +244944175424 e que edição administrativa atualiza cliente e motorista sem hardcode, com auditoria.

## Critério de aceite

Nada de demonstrações confundidas com tração real. Os dados do banco, o CRM, o mapa e os relatórios externos continuam reais. Qualquer projeção deve ter origem, método e identificação explícitos.

Ainda não há confirmação de que todos os testes passam em GitHub Actions nem de publicação final do frontend.
