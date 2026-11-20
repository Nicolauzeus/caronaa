# CARONAA - Centro de Operacoes F07 (20/11/2026)

## Decisao funcional
O painel Admin > Operacoes > Centro de Operacoes inicia por **Central ao vivo**.
A antiga "Solicitacoes (0)" era exclusivamente acesso ao radar; passa a chamar **Acessos ao radar**, sem representar viagens abertas.

## Fontes
- Auth/autorizacao: professional_driver_authorizations
- Disponibilidade: flash_driver_presence + professional_presence
- GPS: professional_driver_locations e timestamps/precisao (90 s, 150 m)
- Cobertura: professional_service_regions e caronaa_service_municipalities
- Corridas: professional_quick_rides
- Tratamento: caronaa_f07_operations_incidents e caronaa_f07_operations_audit
- Contestacoes: aba anterior, fluxo administrativamente auditado

**Leitura somente por admin:** public.admin_f07_operations_snapshot. O resultado nao inclui latitude/longitude exata; o banco mantem os dados geograficos so nos contratos operacionais existentes. A consulta da central ocorre a cada 20 segundos quando a aba esta visivel; nao ha webhook de Google Maps introduzido aqui.

## Estados do motorista
- IN_TRIP: motorista em corrida em andamento
- TO_PICKUP: aceita ou chegou, antes do inicio
- READY: autorizacao, online, presenca e GPS recente/preciso e cobertura habilitada
- OFFLINE: motorista nao ativou disponibilidade
- GPS_STALE: sem sinal valido nos ultimos 90 s ou precisao acima de 150 m
- OUTSIDE_COVERAGE: GPS em municipio nao habilitado para esta modalidade
- NOT_AUTHORIZED: cadastro nao habilitado ou suspenso
- RESTRICTED: restricao de acesso devolvida pelo servidor

Uma pendencia de revisao de encerramento nao bloqueia automaticamente novas corridas. A central informa "Em revisao" e encaminha a "Contestacoes". Corridas longas ou sem transicao por alguns minutos sao **sinais para conferencia**, nao falhas comprovadas.

## Acoes de operacao
- Abrir ocorrencia por motorista/corrida, com categoria, prioridade e descricao
- Assumir e resolver ocorrencia com justificativa persistida e trilha de auditoria
- Regularizar apenas busca SEARCHING cujo prazo passou e sem motorista, mudando para EXPIRED
- Cancelar atribuição travada de ACCEPTED/ARRIVED após 15 min sem mudança de estado, apenas sem embarque/pagamento e com justificativa administrativa auditada
- Navegar a contestacoes para avaliar encerramento com as regras existentes
- Consultar acessos ao radar sem conceder autorizacao silenciosa

**Nao oferece:** forcar status COMPLETED, alterar preco ou pagamento, apagar dados de corrida, ativar GPS sem consentimento, liberar motorista suspenso, alterar tarifas/zonas.

## Implantacao
1. Aplicar a migration 0220 (municipio de cadastro opcional).
2. Aplicar a migration 0221 (central F07) no Supabase conectado ao projeto.
3. Verificar que ambas retornaram sem erros; recarregar schema e publicar o novo frontend.
4. Abrir /admin/operacoes como admin: a primeira aba deve ser Central ao vivo.
5. Comparar contagens com consultas SQL e validar que todas variam ao vivo.
6. Abrir com uma conta sem admin: as RPCs novas devem falhar com SQLSTATE 42501.
7. Testar um motorista disponivel com GPS atual e um com heartbeat expirado.
8. Testar corrida ACCEPTED/ARRIVED/IN_PROGRESS, REVISÃO e busca SEARCHING expirada.
9. Abrir e resolver uma ocorrencia de teste; confirmar autor, hora e justificativa na auditoria.
10. Regularizar uma busca expirada em homologacao; confirmar que nao afetou pagamentos ou corridas ativas.
11. Testar largura 360 px, 768 px e desktop, cabecalho fixo admin e rolagem quando necessaria.
12. Executar typecheck, testes unitarios e build antes de publicar a interface operacional.

## Riscos nao resolvidos por esta fase
- A lista e limitada a 500 motoristas e 400 corridas recentes; numeros da tela representam os dados retornados. Adicionar paginacao server-side para grande escala.
- Estado de viagem longa pode ser valido; uma transicao sem atualizacao nao comprova problema.
- Se a migration 0221 nao for aplicada, o frontend exibira o erro explicito da consulta.
- A consulta nao substitui auditoria regulatoria nem verificacao de licencas/seguro exigidos.
- Nao foi executado pagamento real, aceite de corrida real nem deploy automatico.
