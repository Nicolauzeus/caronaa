# Lixeira de pesquisas e exclusão definitiva — migração 0096

## Regra de negócio

1. **Arquivar** mantém a pesquisa na biblioteca e desativa o formulário público.
2. **Mover para a lixeira** marca `trashed_at`, preserva respostas, vínculos e versões, mantém `status=ARQUIVADO` e `is_enabled=false`; a biblioteca e os painéis agregados não exibem pesquisas na lixeira.
3. **Restaurar** retorna ao estado anterior (`RASCUNHO`, `PUBLICADO` ou `ARQUIVADO`), **sempre com link público desativado**. O administrador deverá habilitar explicitamente uma versão publicada depois de revisar.
4. **Excluir definitivamente** somente na lixeira e apenas quando não houver respostas históricas/STS, leads, pilotos, selos de participação ou imagens armazenadas. É permitido excluir respostas comuns da própria pesquisa sem vínculos, com confirmação por código, frase `EXCLUIR DEFINITIVAMENTE`, aceite expresso e número de respostas idêntico ao diagnóstico recente.
5. Pesquisas históricas `ENCERRADO` permanecem protegidas. Respostas, pesquisas ou selos existentes **não são alterados pela execução da migração**.
6. A exclusão e a auditoria usam uma transação PostgreSQL: erro de chave estrangeira ou alteração de vínculos cancela tudo. O log de ciclo de vida preserva código, UUID, ação, autor e contagem de respostas, sem conteúdo pessoal.
7. Formulários movidos para a lixeira não podem ser publicados nem editados por update normal; a checagem é no banco, não só no menu. RPCs legadas de hard delete têm EXECUTE revogado de usuários autenticados.

## Cuidado especial com imagens e vínculos

As mídias existentes no Supabase Storage bloqueiam a exclusão até serem removidas pelo administrador via **Storage API**. Nunca exclua registros de `storage.objects` diretamente por SQL, pois isso não elimina os arquivos físicos.

Selos vinculados são **bloqueadores definitivos** da exclusão direta, inclusive quando todos os outros contadores são zero. Não os apague nem faça cascata para liberar a exclusão. Se existir retenção obrigatória, reclamação, litígio, necessidade regulatória ou política de privacidade aplicável, mantenha a pesquisa na lixeira e envolva o responsável pelo tratamento dos dados antes de proceder.

As consultas de elegibilidade são orientativas. As RPCs de exclusão repetem as validações transacionalmente, exigindo conta com papel `admin`; usuários com acesso departamental simples não podem executar.

## Bancos que já receberam a lixeira manualmente

Em bancos onde os 6 objetos da lixeira já estão instalados, **não execute de novo** o SQL. A renumeração do arquivo apenas corrige a ordem do repositório. Confira o estado atual do banco e registre a execução no mecanismo de migrations sem reaplicar DDL destrutivo.

A infraestrutura institucional é a migration `0095_reusable_research_infrastructure.sql`, instalada antes da lixeira `0096_research_trash_and_guarded_deletion.sql` em novos ambientes.

## Implantação

**Não executar em produção antes de backup verificável e homologação.** A migração 0096 altera políticas e cria RPCs; deve ser aplicada na instalação Lovable/Supabase correta, depois da 0093. `drizzle/migrations/meta/_journal.json` apenas registra a migration no repositório: merge no GitHub **não aplica SQL no banco**.

1. Em homologação, confirmar backups e aplicar `drizzle/migrations/0096_research_trash_and_guarded_deletion.sql` completo, em transação.
2. Testar com uma pesquisa fictícia de 2 respostas **sem vínculos**: mover para lixeira, constatar que o link público fica desativado e que as respostas são preservadas.
3. Restaurar a pesquisa e conferir que o link continua **inativo**; habilitar manualmente somente se houver uma versão publicada.
4. Mover novamente, verificar o total e excluir definitivamente confirmando o código, a frase e o aceite. Verificar ausência da pesquisa/versões/respostas e presença do evento de auditoria.
5. Criar teste com `research_participation_badges` vinculado e confirmar que a exclusão **não aparece/é negada pela RPC**. Repetir com lead, piloto e submissão legada em dados de teste.
6. Confirmar que a pesquisa na lixeira bloqueia a navegação direta do editor e nunca participa dos relatórios agregados da biblioteca.
7. Testar sessões `anon`, usuário comum, administrador departamental sem papel global e `admin`; apenas o último pode consultar e executar as RPCs.
8. Simular divergência de `p_expected_answers` ou tentativa de apagar com código/frase incorretos; verificar rollback completo.
9. Validar fluxo e acessibilidade em 360/390/768/1280px e executar `npm test`, `npm run build` e checks de CI.

Consultas somente de leitura para verificação:

```sql
SELECT to_regprocedure('public.trash_research_form(uuid)') AS trash,
       to_regprocedure('public.restore_trashed_research_form(uuid)') AS restore,
       to_regprocedure('public.permanently_delete_trashed_research_form(uuid,text,text,bigint)') AS permanent_delete;
SELECT count(*) AS na_lixeira FROM public.research_forms WHERE trashed_at IS NOT NULL;
SELECT action,form_code,answer_count,created_at
  FROM public.research_form_lifecycle_audit ORDER BY created_at DESC LIMIT 25;
```

**Não testar exclusão definitiva na UNILAB real.** A funcionalidade aceita resposta comum não vinculada, mas não protege contra perda de dados por decisão administrativa; confirmação é responsabilidade de um administrador global autorizado.
