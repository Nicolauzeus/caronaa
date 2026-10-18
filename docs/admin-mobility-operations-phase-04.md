# CARONAA Admin Enterprise — Departamento 03: Operações de Mobilidade

## Implementação
- Rota `/admin/operacoes`, sob a proteção administrativa existente.
- Entrada no catálogo `/admin/departamentos/operations`.
- Indicadores reais obtidos via `getOperationalMetrics` e RPC `get_operational_metrics`.
- Intervalos 7, 30, 90 dias, atualização manual e estado de erro.
- Comparativo de ofertas/solicitações e correspondências, taxas com denominadores da fonte.
- Navegação para caronas, solicitações, matching, motoristas e passageiros.
- Sem alterações na lógica de match, no ciclo de vida de viagens ou na cobrança.
- Mobilidade profissional local explicitamente planejada e não simulada.
- Nenhuma migração nova.

## Testes guiados
1. Entrar no Admin e abrir /admin/departamentos/operations → Centro de Operações.
2. Alterar período para 7, 30 e 90 dias, comparando resultados com a RPC no mesmo recorte.
3. Confirmar que o gráfico apresenta contagens absolutas; correspondências são subconjunto das ofertas ou solicitações, não total adicional.
4. Conferir taxas de correspondência, de utilização das ofertas e de assentos, principalmente denominadores.
5. Confirmar que falha na RPC mostra erro e N/D sem inventar zero.
6. Abrir Caronas, Solicitações, Correspondências, Motoristas e Passageiros; voltar sem perder navegação.
7. Conferir que nenhuma operação de match, cancelamento, disponibilidade ou viagem foi alterada pelo dashboard.
8. Testar viewport 360px, 768px e desktop, labels, foco e contraste.
9. Testar rota privada sem sessão e com conta comum, confirmando 403.
10. Rodar npm run build e npm test e verificar GitHub Actions para o último commit.

## Pendências operacionais deliberadamente não incluídas
- Despacho de mototaxistas e motoristas profissionais em tempo real.
- Observabilidade e alertas operacionais ativos.
- SLA de aceitação, tempos de espera geográficos e mapa operacional com fonte validada.
- Teste E2E de viagem e pagamento.

## Estado
Código enviado à main. Não publicado em produção. Não homologado no Lovable.
