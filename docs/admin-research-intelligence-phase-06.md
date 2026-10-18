# Departamento 05 — Pesquisa e Inteligência

## Implementado
- Rota /admin/inteligencia-pesquisa com hub próprio.
- Reuso dos componentes ResearchInsights, ResearchCompare e MunicipalResearchOverview.
- Métricas de biblioteca: pesquisas cadastradas, habilitadas e encerradas.
- Visão de método: descoberta, validação de solução, aquisição e qualidade de evidência.
- Links para detalhes de pesquisas reais e Central de Formulários.
- Não altera SQL, respostas do STS nem fontes de BI.

## Roteiro de homologação
1. Abrir /admin/departamentos/research → Centro de Pesquisa e Validação.
2. Conferir contagem de pesquisas, estados e biblioteca.
3. Alternar Metodologia, BI e Dores, Comparações e Municípios.
4. Confirmar BI STS com 35 respostas e dores DOR_01=17, DOR_02=11, DOR_03=11, DOR_04=5, DOR_06=4, respeitando os filtros e denominadores.
5. Conferir que a navegação à pesquisa individual funciona e o Admin anterior permanece acessível.
6. Falha na consulta deve resultar em erro/N/D, sem dados fictícios.
7. Conferir responsividade em 360 px, 768 px e desktop.
8. Testar restrição administrativa em sessão anônima.
9. Executar npm test e npm run build no commit atual e validar Actions.

## Próximas tarefas, não concluídas
- Vínculo seguro pesquisa → CRM → cadastro;
- Identificação de coorte e atribuição UTM persistente;
- Qualidade estatística automatizada por versão e pergunta;
- Indicadores de primeira viagem e retenção comprovados;
- Revisão de usabilidade em todos os formulários.

Nenhuma publicação automática em produção.
