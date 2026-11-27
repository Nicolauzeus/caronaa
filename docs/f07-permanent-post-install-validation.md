# F07 — validação após instalação da operação permanente

**27/11/2026.** O proprietário informou que o SQL foi executado no banco de produção.
Não foi reexecutado nem alterado nesta revisão. O acesso Lovable/Supabase desta sessão
retornou HTTP 403 (`project_blocked_by_connection_access`). Portanto, instalação e
permissões reais não foram reconfirmadas. O arquivo de tipos foi sincronizado
pontualmente com as duas tabelas e duas RPCs do SQL versionado; isso **não é** o
resultado de `supabase get_types` nem valida o restante do schema instalado.
Preservados os tipos históricos e assinaturas das RPCs existentes.

## Validação automatizada

```sh
bun install --frozen-lockfile
bunx vitest run src/test/f07-retired-controls.test.ts src/test/quick-ride-push-dispatch.test.ts src/test/f07-passenger-demand-waiting.test.ts src/lib/quick-rides/f07-homologation.test.ts src/test/f07-permanent-operation-types.test.ts
bunx tsc --noEmit
bun run build
```

O teste histórico de homologação fica em `src/lib/quick-rides/`, não em
`src/test/`. Ele valida fixtures históricas, não as tarifas atuais. O workflow
F07/F08 agora executa esses testes, TypeScript, a suíte completa e o build
independentemente de uma falha nos testes, desde que a instalação funcione.

Com acesso autorizado ao projeto Lovable, executar `supabase get_types` (schema
public), revisar o diff de `src/integrations/supabase/types.ts` e confirmar
as duas tabelas e duas RPCs novas antes de versionar a geração completa.

## Banco instalado

Executar somente `scripts/sql/f07-public-operation-post-install-check.sql` em
uma sessão autorizada de administração; é uma auditoria de leitura.
Esperado: linha única do controle habilitada sem prazo; tabelas com RLS e
políticas somente de leitura administrativa; anon sem acesso; authenticated
sem escrita direta; RPC administrativa exige usuário admin; gate privado
restrito ao serviço; três consumidores comerciais usam o gate permanente;
atalhos de ativação aposentados sem grants; 34 combinações habilitadas.
Não alterar a suspensão administrativa se ela tiver sido intencional.

## Playwright

Teste autenticado, com duas contas dedicadas, passageiro sem pedido ativo e
motorista profissional autorizado e offline. Sem simular GPS, sem alterar
presença, sem clicar em confirmar corrida. Cotações reais podem ser persistidas
para a conta de teste e expiram normalmente; o app pode emitir a telemetria
normal de uso. O teste verifica o RPC comercial autenticado para as 34
combinações e as duas rotas reais. Não usar contas de clientes.

```sh
# instalar Playwright em diretório separado (não altera os lockfiles do app)
npm install --prefix /tmp/caronaa-playwright playwright --no-save --package-lock=false
node /tmp/caronaa-playwright/node_modules/playwright/cli.js install chromium
# exportar paths locais de storageState de sessões de teste válidas; não versionar
export PLAYWRIGHT_MODULE=/tmp/caronaa-playwright/node_modules/playwright/index.mjs
export CARONAA_F07_PASSENGER_STORAGE_STATE=/caminho/privado/passageiro.json
export CARONAA_F07_DRIVER_STORAGE_STATE=/caminho/privado/motorista.json
export CARONAA_F07_LIVE_SMOKE=1
bun scripts/test-f07-production-browser.mjs
```

Os storage states contêm credenciais de sessão: manter fora do repositório e
não compartilhar nos logs. A origem é o domínio publicado `https://caronaa.com`.
Sem credenciais ou acesso, não declarar Playwright aprovado.

## Evidências e limites

Relatório anterior à instalação: 42 verificações SQL locais, 111 testes
focados, build automático OK; 5 falhas conhecidas de localização na suíte
completa; não confundir com nova execução. Nesta revisão, sem acesso ao
Lovable/Supabase, sem dependências instaladas no contêiner e sem autenticação
de teste para o navegador. O status do CI precisa ser consultado no GitHub.
Nenhuma corrida, pagamento, tarifa ou alteração de banco foi realizada.
