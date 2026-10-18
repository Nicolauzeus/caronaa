# Central de Formularios - Homologacao das melhorias de gestao

## Requisitos de banco
Conferir backup e aplicar:
- `0078_research_draft_management.sql` (exclusao atomica de rascunhos vazios)
- `0079_research_duplicate_form.sql` (duplicacao administrativa)

Comandos de verificacao sem mutacao:
```sql
SELECT to_regprocedure('public.delete_empty_research_draft(uuid)') AS delete_draft,
       to_regprocedure('public.duplicate_research_form(uuid)') AS duplicate_form;
SELECT code,title,status,is_enabled FROM public.research_forms ORDER BY created_at DESC;
```

## Teste guiado
1. Acessar a Central, editar titulo de formulario de teste e conferir que o codigo/URL nao mudou.
2. Criar um rascunho sem respostas, excluir e confirmar remocao no catalogo.
3. Duplicar um formulario publicado e verificar copia em RASCUNHO desabilitada, codigo unico e sem respostas importadas.
4. Arquivar um formulario ativo, verificar status ARQUIVADO, is_enabled=false e bloqueio de novas respostas.
5. Restaurar e verificar estado PUBLICADO ou RASCUNHO, sempre desabilitado ate a nova ativacao.
6. Acessar em janela anonima a URL de uma pesquisa publicada e habilitada; nao deve exigir autenticacao.
7. Compartilhar pelo WhatsApp, copiar URL e baixar QR Code; testar URL real no dominio publico.
8. Conferir protecao do STS encerrado: nenhuma exclusao ou arquivamento e 35 respostas preservadas.
9. Testar viewport 360px, 768px e desktop, navegacao por teclado e estados de erro.
10. Rodar npm ci, npm run test, npm run build e conferir GitHub Actions no commit final.

## Dominio publico
Por padrao, o link compartilhado fora do Lovable Preview usa https://caronaa.com.
Caso o dominio de publicacao seja outro, configure `VITE_PUBLIC_SITE_URL` apontando para a origem publica correta. Preview dentro de lovable.dev nao substitui acesso anonimo ao dominio publicado.

## Limites atuais
A ausencia de autenticacao foi confirmada na definicao da rota publica e nas politicas publicadas do banco, mas a causa de redirecionamentos anteriores nao foi reproduzida em browser anonimo; exige teste real.
Nao marcar CI, comportamento de producao ou migracoes como validados sem executar as verificacoes.
