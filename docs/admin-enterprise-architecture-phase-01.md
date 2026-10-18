# CARONAA Admin Enterprise — entrega 01: arquitetura organizacional

## Escopo implementado
- Catálogo de nove departamentos e suas categorias em `src/lib/admin/departments.ts`.
- `/admin/departamentos`: biblioteca de departamentos.
- `/admin/departamentos/$department`: visão individual por departamento.
- Integração à navegação desktop/mobile atual em `AdminShell`, sem remover rotas existentes.
- Categorias existentes: link para módulo real; planejadas: sinalização honesta.
- Testes unitários de integridade do catálogo em `src/lib/admin/departments.test.ts`.
- Não cria usuários, papéis, permissões, dados fictícios nem migrações SQL.

## Roteiro de homologação do proprietário
1. Entrar como Superadmin e abrir /admin/departamentos.
2. Conferir os nove departamentos e abrir cada card.
3. Verificar links reais dos departamentos Operações, Growth, Pesquisa, Parcerias e Atendimento.
4. Conferir avisos de categorias ainda planejadas, principalmente Financeiro e Compliance.
5. Confirmar que os menus antigos ainda funcionam e que /admin continua com dashboard existente.
6. Repetir navegação em 360px, 768px e desktop; testar busca no menu e abertura mobile.
7. Confirmar que visitante sem autenticação não acessa /admin/departamentos.
8. Rodar npm test -- src/lib/admin/departments.test.ts e npm run build.
9. Registrar evidências e quaisquer erros, sem publicar em produção.

## Próximas entregas — uma por departamento, cada qual homologada antes do próximo release
1. **Direção e Estratégia:** dashboard executivo de fontes reais, OKR, registro de decisões e riscos; evitar métricas fictícias.
2. **Tecnologia e Produto:** métricas instrumentadas, incidentes técnicos, produto e releases.
3. **Operações de Mobilidade:** integrar caronas, solicitações, matches, motoristas, passageiros; operações locais quando houver regras verificadas.
4. **Crescimento e CRM:** modelo de lead/origem/consentimento, vinculação segura a cadastro e funil de aquisição.
5. **Pesquisa e Inteligência:** unificar pesquisa, aquisição e BI, respeitando histórico STS.
6. **Parcerias e Expansão:** entidades institucionais, pilotos e avaliação territorial.
7. **Atendimento e Segurança:** tickets, denúncias e fluxos de tratamento.
8. **Financeiro:** pagamentos, tarifas, repasses e conciliação reconciliada.
9. **Jurídico e Compliance:** contratos, consentimentos, registro de auditoria e obrigações.

## Bloqueios conhecidos
O Lovable não aceitou a solicitação de verificação por falta de créditos do workspace. Nenhum build validado nessa chamada. Não houve alterações de produção nem no Supabase. Verificar a sincronização da main antes do teste guiado.
