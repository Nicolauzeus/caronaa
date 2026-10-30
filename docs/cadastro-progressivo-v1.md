# Cadastro progressivo — entrega inicial (29/10/2026)

Implementação na branch `feat/progressive-onboarding`. **Não aplicar em produção sem testes.**

## Contrato
- Cadastro e-mail/senha no `/auth`, com Google e recuperação preservados.
- Novo `/onboarding`: região → vínculo → papel → revisão, sem exigir WhatsApp ou trajeto.
- Fortaleza → UNIFOR; Maciço de Baturité → UNILAB; outras regiões não ganham cobertura automaticamente.
- Uma conta pode assumir PASSAGEIRO, MOTORISTA ou AMBOS. A escolha do onboarding não concede permissão para oferta de viagens.
- Persistência RLS por usuário e migration aditiva `0124_progressive_onboarding.sql`.
- Não tocar em versões publicadas, dados de pesquisas, receipts nem RPC de lançamento.
- O guard existente de `/_authenticated/route.tsx` permanece autoridade de navegação para contas bloqueadas; políticas no banco permanecem obrigatórias.
- Mobile-first 100dvh, safe area, dark glass minimalista, Sora/Manrope e #FFBB00 / #121212.
- O fluxo novo não obriga contas antigas a refazer cadastro.

## Pendente antes de ativação
1. Auditar banco vivo e confirmar que número 0124 não colide com migrations recentes.
2. Executar migration apenas em homologação após backup, validar grants e RLS com anon, owner e outro usuário.
3. Validar o fluxo de confirmação de e-mail com o provedor real e redirects de login/Google.
4. Implementar recuperação segura e sugestões de dados das pesquisas; **ainda não implementadas**. Nunca vincular por coincidência de e-mail.
5. Validar o funil do CRM e feature flag de rollout; **ainda não implementados**.
6. Executar `npx tsc --noEmit`, `npm test`, `npm run build` e E2E mobile 320/360/390/430 px.
7. Validar UNIFOR e UNILAB, contas antigas e duas contagens regressivas, sem desbloqueios indevidos.
8. Rever o catálogo territorial e estados de usuário para expansão antes de ampliar a cobertura.

## Regra de merge
Manter a branch isolada até concluir integração, testes e validação em homologação. Nada de deploy automático ou reescrever histórico da branch Lovable.

## Revisão técnica adicional — 29/10
- Retomada do progresso em login por senha e callback de confirmação.
- O onboarding recupera badges somente pela RPC existente e recibos privados verificados; a associação automática de respostas completas não foi implementada.
- A alteração de região invalida papel e vínculo anteriores, exigindo nova revisão.
- A conclusão relê o banco e valida os campos; a navegação consulta o gate de lançamento.
- A tela permite rolagem vertical em viewports compactos, preservando a área de ação.
- Casos unitários adicionais cobrem instituição incompatível, vínculo comunitário, ausência de papel e expansão.
- **Execução de testes não realizada:** acesso de terminal ao GitHub falhou por DNS neste ambiente. Os arquivos foram gravados via conector; não considerar testes aprovados.
- **Atenção:** o uso de uma tabela de onboarding com permissões de escrita pelo titular serve apenas para preferências declaradas. Nunca tratar esses campos como verificação de matrícula ou permissão para publicar carona.
- Falta auditar conflito com outras migrations em branches paralelas e efetuar teste de integração com banco real.
