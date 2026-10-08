# Mobile-first: home e ativação STS

## Mapeamento

- Home: `src/routes/_authenticated/home.tsx`; a rota autenticada mantém o guard existente.
- Shell: `AppShell`; navegação desktop preservada, mobile usa `Sheet`/Radix lateral.
- Publicação: `create_ride_request` e `create_ride_offer`; os triggers existentes continuam gerando matches.
- Solicitações: `ride_requests`, estados `open`, `matched`, `cancelled`.
- Ofertas: `ride_offers`, estados `available`, `full`, `cancelled`.
- Viagens: `rides`, incluindo `CONFIRMED` e `IN_PROGRESS`; conclusão/PIN não foram alterados.
- Inscrições: `form_submissions`; vínculo confirmado em `form_submission_account_links`, existente desde 0035.
- Origem STS rastreável: `form_ride_publications`, migration 0037, chave única `(submission_id, kind)`.

## Dados e conversão

Uma publicação exige origem, destino, data concreta, horário exato e quantidade válida.
A ativação STS também exige valor explícito; oferta exige confirmação do público aceito.
Coordenadas reais são preservadas quando disponíveis; mudança textual limpa as coordenadas antigas.

- **Suficientes**: campos válidos, vínculo confirmado, viagem futura no período STS. A primeira publicação pode ser criada ao abrir a home.
- **Parciais**: rota conhecida mas faltam horário exato, quantidade, valor total ou preferência. Mostrar trajeto pré-preenchido para confirmação.
- **Insuficientes**: rota incompleta. Mostrar os dados conhecidos, sem publicar.
- **Expirados**: inscrição/viagem passada ou evento encerrado. Não ativar.

O formulário atual captura janelas de horário, não horário exato. Não se converte `19_20` em uma hora arbitrária.
`driverPrice` é preço por vaga e não é tratado como valor total da viagem.
`HOJE` refere-se à data da inscrição em America/Fortaleza, não à data do login.
Vários dias não são reduzidos silenciosamente a um único dia. Datas/horários exigem confirmação.
`AMBOS` exige confirmação do papel para publicação; não gera duas publicações silenciosas.

## Proteções

A criação e o registro da origem ocorrem na mesma transação, com lock na inscrição.
Repetição retorna o mesmo identificador; cancelar uma publicação não recria automaticamente outra.
Não se vincula inscrição de outro usuário ou sem confirmação. Inscrições inválidas/canceladas são rejeitadas.
Uma publicação ativa existente não é sobrescrita nem complementada automaticamente.
Os papéis não são permanentes: a home permite pedir ou oferecer, independentemente do perfil inicial.

## Interface

A home não bloqueia a ação esperando os dados secundários. Não há feed, métricas ou mapa decorativo.
O mapa OpenStreetMap é mostrado com coordenadas reais da saída ou de uma publicação ativa.
Sem GPS/permissão, pedir a saída explicitamente. Não há motor de rota viária novo nem linha de rota inventada.
O drawer expõe somente destinos existentes. Administração depende de `user_roles` no banco e mantém os guards administrativos.
A tela de oferta recebe o trajeto selecionado, inclusive coordenadas, sem alterar o restante do fluxo.

## Implantação

Aplicar `drizzle/migrations/0037_sts_first_publication.sql` no banco antes de habilitar a ativação STS em produção.
Esta alteração não executa DDL com a chave pública nem altera RLS das tabelas existentes.
Teste isolado: `node scripts/test-ride-security.mjs --sts`.
Os testes de publicação futura STS têm janela fixa e informam skip após o evento; rejeição de datas passadas continua testada.
