# Admin CARONAA: Visão Geral e navegação

Data: 18/10/2026. Trabalho local na branch `main`, sem commit, push ou deploy.

## A. Diagnóstico

O Admin já era uma área única, protegida por `AdminGuard`, com `AdminShell`, catálogo de departamentos e navegação contextual por hash. Foram identificados 29 módulos de rota sob `src/routes/admin`, incluindo a Visão Geral, o índice de departamentos e o endereço legado de departamento. A reorganização aproveita essa estrutura.

### Mapa dos departamentos

As contagens abaixo distinguem arquivos de rota de módulos funcionais oferecidos pela navegação. Uma página pode hospedar várias abas. Endereços de detalhe não representam departamentos adicionais.

| Departamento | Arquivos de rota | Módulos principais existentes                                                            | Preservação e diagnóstico                                                                                                                                                                                                                              |
| ------------ | ---------------: | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Direção      |                1 | Visão executiva, metas, decisões, riscos                                                 | Métricas agregadas, registros e histórico preservados. Cabeçalho competia com o título do shell; funil repetia a análise da Visão Geral.                                                                                                               |
| Tecnologia   |                1 | Incidentes; bugs, melhorias e releases                                                   | Registros e transições preservados. Observabilidade e integrações continuam planejadas, sem indicadores fabricados.                                                                                                                                    |
| Operações    |                6 | Centro operacional, caronas, solicitações, correspondências, motoristas, passageiros     | Monitoramento, presença profissional e ações operacionais preservados. Título e identificação de departamento eram repetidos; fonte de métrica mostrava nome interno de RPC.                                                                           |
| Growth e CRM |                3 | Usuários e detalhe, leads, campanhas                                                     | Consentimentos, busca, filtros e mudanças de estado preservados. Consulta limitada a 300 leads e 150 campanhas já existia; não equivale a total histórico de aquisição.                                                                                |
| Pesquisa     |                8 | Inteligência, formulários e detalhe, respostas e detalhe, validação e dor, oportunidades | Editor, publicação, arquivamento, exclusão autorizada, restauração, modelos, selos e participação preservados. Biblioteca fazia três consultas de métricas sem apresentar os resultados; abas de inteligência e detalhe não eram restauráveis por URL. |
| Parcerias    |                3 | Relacionamentos, instituições, pilotos, expansão                                         | As duas URLs de relacionamento continuam compartilhando o mesmo componente. Ações e recortes municipais preservados. Contagem limitada aos registros carregados, como antes.                                                                           |
| Atendimento  |                2 | Sugestões, tickets, denúncias e incidentes                                               | Protocolo, prioridade, busca, filtros e tratamento preservados. Falha de consulta podia coexistir com mensagem de lista vazia.                                                                                                                         |
| Financeiro   |                1 | Visão financeira, transações                                                             | RPCs de leitura, período, moedas e separação entre confirmado, reembolso e repasse preservados. Erros mostravam mensagem de infraestrutura e número de migração. Não há conciliação implementada.                                                      |
| Compliance   |                1 | Contratos, auditoria, regulamentação                                                     | Histórico, prazos, referências e estados preservados. Erros de consulta e lista vazia não estavam suficientemente diferenciados.                                                                                                                       |

### Problemas confirmados

- O roteador ativava o link `/admin` por prefixo, produzindo dois itens `aria-current="page"` no navegador real. Detalhes também podiam ativar a aba errada por fallback ao primeiro módulo.
- O shell repetia o nome do departamento no breadcrumb, na faixa de abas e no cabeçalho da página. A faixa oferecia mais um acesso à lista completa de departamentos.
- `/admin/departamentos/:department` adicionava uma etapa com abas, outro cabeçalho e um botão para a página funcional.
- A Visão Geral destacava quatro indicadores de vínculos, repetidos em outra aba, antes de distinguir aquisição, operação e recorrência. Havia duas visualizações do mesmo funil e vários indicadores operacionais repetidos.
- O selo visual de status verde ao lado de “Últimos 30 dias” não representava uma consulta de saúde do sistema.
- Abas locais usavam substituição de histórico, prejudicando o botão Voltar. Abas de pesquisa mantidas somente em estado local se perdiam ao atualizar a página.
- O menu mobile era um diálogo manual sem as garantias de foco, Escape e retorno de foco do componente modal já disponível no projeto.
- Falhas de carregamento eram apresentadas como restrição de acesso, ou exibiam mensagens técnicas. Em algumas listas, o erro também era acompanhado de “nenhum registro”.

### Autorização realmente existente

O backend consulta `has_role(user_id, 'admin')`. As políticas e RPCs administrativas usam esse mesmo papel. O enum de usuários também possui `moderator` e `user`, mas esses papéis não recebem acesso administrativo global. Não foi encontrada uma matriz de permissões por departamento nem um papel `superadmin` implementado.

Consequentemente, todos os nove departamentos permanecem disponíveis ao `admin` autorizado e indisponíveis aos demais perfis. Não foram criados papéis, concessões ou filtros visuais apresentados como segurança. RLS, verificações de RPC, middleware autenticado e regras de escrita não foram modificados. A segmentação departamental exige um projeto de autorização próprio e não está implementada nesta entrega.

## B. Melhorias implementadas

### Visão Geral

1. Contexto objetivo, com título único e atualização de indicadores.
2. Indicadores essenciais: usuários da base completa, solicitações elegíveis, ofertas elegíveis e caronas concluídas do período. Cada indicador tem recorte, carregamento, indisponibilidade e link pertinente.
3. Atenção necessária: filas reais do serviço `loadAdminOperations`, sem alertas inventados. Filas zeradas são omitidas; se todas estiverem vazias, a mensagem identifica exatamente o escopo consultado.
4. Acompanhamento por abas: aquisição, operação e pesquisa, pessoas e recorrência. Os dados complementares anteriores continuam acessíveis, incluindo vínculos institucionais, taxas, assentos, cancelamentos e recorrência.
5. Atividade contextual para acompanhar metas, sem reproduzir os nove departamentos em cards.

As consultas continuam nas funções e agregações existentes. React Query, já instalado e configurado no aplicativo, permite carregamento independente e nova tentativa sem substituir falhas por zero. As consultas de métricas compartilham início e fim do recorte de 30 dias; usuários e filas operacionais indicam que representam a situação atual.

### Navegação e componentes compartilhados

- `AdminPageHeader`: título e descrição comuns aos nove departamentos e à Visão Geral.
- `AdminShell`: breadcrumb, ícones por departamento, item ativo exclusivo, foco visível e navegação desktop recolhível.
- Menu mobile baseado em `Sheet`, com foco modal, Escape, fechamento após navegação e fechamento ao migrar para largura desktop.
- `AdminDepartmentTabs`: faixa única, horizontalmente rolável, sem repetir o título nem o índice de departamentos.
- `module-navigation`: correspondência pela rota mais específica, suporte à URL singular de relacionamento, barras finais e endereços antigos de departamentos.
- Endereços legados de departamento redirecionam para os respectivos espaços existentes. O índice de departamentos continua acessível para compatibilidade.
- `useAdminModuleSection`: mudança de aba preserva parâmetros de busca e cria entrada no histórico. Voltar, atualização e links compartilhados mantêm o contexto da aba.
- Pesquisa: análises e detalhes usam o componente `Tabs` existente; abas de detalhe recebem hash, incluindo compatibilidade com `#imagem`. Editor e publicação permanecem nos componentes originais.
- `AdminDataError`: mensagem compreensível, distinção de permissão e registro técnico no console. A Visão Geral oferece nova tentativa por fonte.
- `AdminGuard`: falha de validação deixa de ser tratada como 403; o resultado de autorização fica associado à conta verificada, sem reutilização ao trocar de usuário.

### Duplicações removidas

- Segunda identificação de departamento e link para todos os departamentos acima das abas.
- Cabeçalhos locais redundantes nas nove páginas principais; filtros e botões úteis foram preservados.
- Etapa intermediária dos endereços legados de departamento.
- Indicadores repetidos e segunda visualização equivalente do funil na Visão Geral.
- Três consultas não utilizadas na página da Central de Formulários e cabeçalho repetido antes do catálogo.
- Contagem fixa de 35 respostas no texto metodológico. O texto passa a explicar a limitação amostral sem apresentar um número desatualizado como consulta atual.

## C. Principais arquivos

| Arquivo                                                                      | Finalidade                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/components/admin/AdminOverview.tsx`                                     | Nova organização da Visão Geral, fontes independentes e estados                         |
| `src/components/admin/AdminShell.tsx`                                        | Sidebar, breadcrumb, cabeçalho comum e menu responsivo                                  |
| `src/components/admin/AdminPageHeader.tsx`                                   | Cabeçalho compartilhado                                                                 |
| `src/components/admin/AdminDepartmentTabs.tsx`                               | Navegação contextual única                                                              |
| `src/components/admin/AdminDataError.tsx` e `src/lib/admin/error-message.ts` | Mensagens de erro sem detalhes brutos de infraestrutura                                 |
| `src/components/admin/AttentionQueue.tsx`                                    | Filas reais, carregamento, erro, nova tentativa e vazio                                 |
| `src/components/admin/AdminGuard.tsx`                                        | Diferenciação entre indisponibilidade e acesso negado; vínculo da autorização à conta   |
| `src/lib/admin/module-navigation.ts` e `use-admin-module-section.ts`         | Links profundos, seleção exclusiva, parâmetros e histórico                              |
| `src/routes/admin/index.tsx`                                                 | Rota e metadados da Visão Geral                                                         |
| `src/routes/admin/departamentos/$department.tsx`                             | Compatibilidade por redirecionamento                                                    |
| Páginas principais dos nove departamentos                                    | Remoção de cabeçalhos redundantes e ajuste de estados de erro                           |
| `src/routes/admin/formularios/index.tsx` e `$code.tsx`                       | Biblioteca sem consultas mortas e abas de detalhe por URL                               |
| `src/components/admin/EvidenceChart.tsx`                                     | Correção de inferência TypeScript da linha indexada pelo nome da série                  |
| `src/test/admin-*.test.tsx`, `src/lib/admin/*.test.ts`                       | Regressões de navegação, dados e acesso                                                 |
| `scripts/test-admin-navigation.mjs`, `tests/admin-browser/`                  | Ensaio de navegador isolado com componentes reais e serviços simulados somente no teste |

Nenhuma migração, regra de cálculo financeiro ou contrato de API foi alterado. Nenhum teste existente foi removido. O teste antigo de redirecionamento de formulário foi ajustado para consultar a rota índice correta, respeitando a arquitetura atual do formulário público.

## D. Validação

A primeira rodada completa identificou somente um teste antigo consultando o layout pai de `/formulario`, corrigido sem alterar o comportamento público.

| Verificação                                                                                                                                | Resultado                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --maxWorkers=2`                                                                                                               | 102 arquivos e 584 testes passaram na suíte completa                                                                                               |
| `npx vitest run src/test/admin-guard.test.tsx src/test/admin-research-navigation.test.tsx src/test/admin-overview.test.tsx --maxWorkers=2` | 3 arquivos e 16 testes passaram após os últimos ajustes de acesso e pesquisa; há sobreposição com a suíte completa                                 |
| `npm run build`                                                                                                                            | Build de produção concluído; avisos existentes de plugins, depreciações e tamanho de chunks                                                        |
| `npm run lint`                                                                                                                             | Falhou: 6.700 ocorrências na execução inicial, incluindo formatação e dívida preexistente; não foi silenciado                                      |
| ESLint limitado aos arquivos modificados                                                                                                   | Após formatação: 13 erros de casts `any` já existentes e 1 aviso de dependência de hook já existente; nenhuma reescrita geral de tipagem foi feita |
| `git diff --check`                                                                                                                         | Sem erros de whitespace                                                                                                                            |
| Chromium/Playwright                                                                                                                        | 40 combinações de página e viewport passaram, com capturas; verificações adicionais de histórico, atualização, menu e sidebar passaram             |

O teste visual inicia um Vite separado, usa Chromium e serviços simulados exclusivamente em `tests/admin-browser`. Ele não autentica contra o banco real, não modifica dados de produção e não comprova RLS em uma instalação remota.

Comando reproduzível, usando Playwright instalado fora das dependências do projeto:

```sh
PLAYWRIGHT_MODULE=/tmp/caronaa-admin-browser/node_modules/playwright/index.mjs ADMIN_ASSET_ORIGIN=http://127.0.0.1:5174 node scripts/test-admin-navigation.mjs
```

As capturas e `results.json` ficam em `/tmp/caronaa-admin-visual` por padrão. A matriz cobre 375, 768, 1280 e 1440 px, nas nove páginas principais e na Visão Geral, além de navegação financeira por hash, Voltar, atualização, menu mobile e sidebar recolhido. As capturas permitem revisão visual; não substituem uma auditoria completa de acessibilidade ou de todos os módulos de detalhe.

`ADMIN_ASSET_ORIGIN` aponta para o servidor local do projeto, que serve os ponteiros Lovable da marca. Sem essa opção, o Vite isolado não possui a rota de assets Lovable. Com a opção, o teste também exige que as imagens terminem de carregar com largura válida. `ADMIN_APP_ORIGIN` pode ser informado para verificar os dez endereços administrativos diretamente no aplicativo real usando um navegador sem sessão.

Verificações adicionais concluídas:

- `npx tsc --noEmit --pretty false`: sem erros após o ajuste de tipagem do evento de troca de aba de pesquisa.
- Navegador sem sessão no aplicativo real em `http://localhost:5174`: os dez endereços administrativos exibiram “Acesso restrito”, sem renderizar a navegação interna.
- Rodada visual com assets: 40 combinações aprovadas, incluindo o carregamento do logotipo original pelo ponteiro Lovable.

O ensaio possui diretório próprio de cache Vite dentro da pasta de evidências, para não invalidar dependências do servidor de desenvolvimento do aplicativo. O servidor local foi reiniciado após identificar a interferência entre os caches durante a primeira tentativa de smoke test.

### Limites de homologação

- Não foram executadas escritas, publicação, arquivamento, exclusão ou alterações financeiras em dados reais.
- Não foram fornecidas sessões de contas administrativas e não administrativas para homologação remota. Verificação de acesso cobre testes isolados e inspeção das proteções existentes, não uma sessão real contra o banco.
- A suíte de schemas, participação, publicação e remoção continua sendo a cobertura automatizada disponível. Publicação e edição reais precisam de homologação em ambiente de testes.
- O lint global apresenta dívida anterior extensa. Não foi feita reformatação geral nem silenciamento de regras no repositório. Os arquivos alterados foram formatados; os casts `any` existentes em módulos cujo schema ainda não está nos tipos gerados continuam identificados pelo ESLint.

## E. Pendências e aceite

### Concluído e validado localmente

- Estrutura única com nove departamentos, Visão Geral reorganizada e navegação contextual compartilhada.
- Compatibilidade de URLs, identificação exclusiva da seção ativa, histórico de abas, menu mobile e navegação recolhível.
- Fontes reais preservadas, sem dados de demonstração na aplicação; estados de erro e vazio diferenciados nas alterações.
- Testes isolados de permissão, mudança de conta e estados de dados.

### Implementado, ainda sem homologação remota

- Integração das telas reorganizadas com a instalação real e os dados administrativos existentes.
- Fluxos sensíveis de pesquisa e relatórios financeiros reais após a mudança de navegação.

### Não implementado

- Permissões por departamento e por ação, pois o modelo de autorização atual só concede administração global. Não há uma matriz prévia que a UI possa consumir.
- Saúde tecnológica, integrações instrumentadas, repasses e conciliação que já estavam planejados no catálogo.

### Fases posteriores

- Homologação com contas e dados de teste; desenho e implementação transacional da matriz de permissões, se aprovada como escopo próprio.
- Auditoria responsiva de cada módulo de detalhe, revisão ortográfica integral e redução da dívida global de lint.
- Paginação de listas que ainda usam limites fixos e persistência mais abrangente de filtros, sem apresentar amostras limitadas como totais globais.

Não se declara aceite integral de todos os critérios: a segmentação departamental e a homologação de operações reais permanecem pendentes.

## F. Git e publicação

Branch de trabalho: `main`. Nenhuma branch nova, commit, push ou publicação foi realizada. O histórico publicado foi preservado.

O arquivo gerado `src/routeTree.gen.ts` já estava modificado antes deste trabalho e foi preservado. `.env` e dados reais não foram alterados.
