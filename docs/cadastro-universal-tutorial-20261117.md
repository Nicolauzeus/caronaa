# Cadastro universal e tutorial de primeiro acesso — 17/11/2026

## Fluxo aprovado
- A tela `/auth` apresenta login limpo. No link **Criar conta**, escolher **Passageiro** ou **Motorista** antes de nome completo/e-mail/senha.
- A seleção é intenção declarada (`initial_usage_role` no `user_metadata` para e-mail/senha). Não concede habilitação profissional.
- Google usa a intenção temporária exclusivamente para UX, e o onboarding autenticado grava a opção escolhida na tabela proprietária (RLS). Em OAuth iniciado no login, escolha no onboarding.
- O onboarding novo persiste somente `usage_role`, conclui como `BASIC_COMPLETED/DONE` e redireciona por `resolvePostOnboardingDestination`, com gate de campanha preservado.
- Região, vínculo, instituição, veículo, GPS e pesquisa não são campos obrigatórios da criação da conta. Nunca preencher OTHER/COMUNIDADE automaticamente.
- Uma conta suporta pedir e oferecer: a preferência inicial não substitui autorizações específicas da F07 ou a aprovação administrativa.

## Migration obrigatória
`drizzle/migrations/0201_universal_signup_first_run.sql`.
Executar na base correta **antes** de homologar o novo onboarding com contas novas. Cria:
- restrição de conclusão para intenção escolhida, sem obrigar região/vínculo;
- `tutorial_eligible` (default false);
- `tutorial_seen_at`.

A migration é aditiva: não altera registros históricos nem RLS. Não altera autorizações, preços, comissões, GPS ou cobertura profissional. O novo onboarding mostra erro quando a conclusão no banco falha; não afirma ter concluído sem persistência.

## Guia animado
- Após conclusão do onboarding, e somente quando o gate de campanha permite acesso, a experiência autenticada mostra três slides automáticos, específicos para passageiro ou motorista.
- Controles: próximo, pausa/reprodução, pular, começar a usar, redução de movimento.
- Conclusão e pulo salvam `tutorial_seen_at` no banco; a próxima sessão/dispositivo não apresenta novamente.
- Contas históricas já `BASIC_COMPLETED` não recebem apresentação automaticamente, pois `tutorial_eligible` inicia como false.
- O Perfil oferece **Rever tutorial de primeiros passos**, sem editar direitos nem cadastro.

## Homologação indispensável (ainda não declarada concluída)
1. Aplicar migration em homologação, inspecionar constraint, colunas, RLS e backups.
2. Criar conta PASSAGEIRO com e-mail confirmado e validar `usage_role`, `BASIC_COMPLETED`, redirecionamento e tutorial de passageiro.
3. Criar conta MOTORISTA e validar texto do tutorial de motorista, oferecer carona regular, e comprovar que F07 continua bloqueada sem aprovação.
4. Testar Google em cadastro e login, inclusive confirmação de e-mail e ausência de preferência prévia.
5. Verificar conta antiga completa: login sem onboarding nem tutorial automático; conta incompleta: seleção e conclusão.
6. Testar refresh, relogin, outra máquina, pular guia e retornar ao Perfil para rever.
7. Validar campanha bloqueada, que deve continuar em `/aguardando`, sem apresentação do tutorial antecipada.
8. Verificar mobile 320/360/390/430px, Safari iOS, Android Chrome, Firefox e desktop 1366×768, teclado, zoom 200% e prefers-reduced-motion.
9. Rodar `npx tsc --noEmit`, `npm test`, `npm run build` antes de publicar em produção.

## Limitações
Não há prova neste documento de migration aplicada ou dos testes executados. Commits no GitHub e sincronização no Lovable não equivalem a publicação da nova versão no domínio de produção.

## Complemento profissional sem segundo cadastro (17/11/2026)
- `/cadastro-motorista` deixa de ser ponto de criação de conta e autenticação: visitantes entram em `/auth` e usuários incompletos passam por `/onboarding`.
- Se o usuário iniciou pela rota profissional, a intenção é preservada após login, confirmação de e-mail e onboarding, sem ignorar o gate de pré-lançamento.
- Com a conta universal concluída, a tela profissional recolhe só informações específicas para solicitação de aprovação; os nomes vêm da conta e o e-mail fica apenas informativo.
- A autorização de mototaxista é administrativa e continua necessária para F07. A seleção `MOTORISTA` não concede direitos e não exige formulário F01.
- Testes regressivos: `src/test/auth-regional-access.test.tsx`, `src/test/professional-universal-flow.test.tsx` e `src/lib/onboarding/universal-driver-entry.test.ts`. Execução real de testes/build depende de CI funcional ou terminal local.

## Confirmação mobile-first e entrada em corridas — 18/11/2026
- O formulário profissional não mostra mais o e-mail da conta em destaque nem o botão “Solicitar acesso ao radar”.
- O botão **Confirmar dados e ver corridas** valida nome, sobrenome, WhatsApp, região, matrícula e foto; indica todas as pendências e concentra a correção no próprio formulário.
- Ao confirmar, o backend persiste os dados e registra a solicitação de análise na mesma RPC já existente. Somente após resposta verificada a aplicação abre `/disponibilidade-profissional`.
- Na tela de corridas, solicitações pendentes ou com dados faltantes são indicadas; os controles de atendimento continuam sujeitos à autorização profissional do servidor, repasses, cobertura, GPS e consentimento.
- A rota simplificada não exige um segundo envio manual de autorização. O fluxo padrão de cadastro de motorista não profissional não é alterado.
- Testar também foto externa sem upload, arquivo maior que 5 MB, dados ausentes, retorno de erro RPC, pedido pendente e aprovado, refresh e navegador mobile.
