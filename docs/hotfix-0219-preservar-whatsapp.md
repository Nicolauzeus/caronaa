# Hotfix 0219 — preservar WhatsApps já cadastrados

A implementação 0218 criou uma tabela nova (`caronaa_account_whatsapp`) sem importar todos os números e permitiu que um formulário de motorista com WhatsApp vazio sobrescrevesse telefones existentes com NULL.

## Correção
- Mantém o número no Perfil e no cadastro, antes e depois de editar outras informações.
- Retira a possibilidade de apagar um telefone preenchendo o campo vazio.
- Cadastro de motorista não sobrescreve número existente se o campo opcional vier vazio.
- Recupera números existentes em `professional_driver_contacts`, `professional_mototaxi_profiles` e no `snapshot->>'whatsapp_e164'` de `professional_access_requests`.
- Preserva o número já preenchido na nova tabela; não sobrescreve edições legítimas.
- Consentimento de CRM permanece independente do número.
- O WhatsApp continua opcional para usuários novos.
- Se as três fontes estiverem vazias, a migração **não poderá reconstruir o valor**; será necessário backup/PITR, logs autorizados ou atualização voluntária do usuário.

## Ordem de implantação
1. Aplicar **apenas** `drizzle/migrations/0219_whatsapp_preservar_existentes.sql` no Supabase SQL Editor (depois de 0218). Executar o arquivo inteiro como transação.
2. Consultar uma conta afetada pelo editor do Perfil e confirmar que o número antigo voltou a aparecer.
3. Publicar o frontend já atualizado após a aplicação do SQL.
4. Testar edição de número, edição de outros dados sem tocar no WhatsApp e cadastro profissional com campo vazio.
5. Não reexecutar a migration 0218, pois ela redefine as funções antigas.

**Nota:** a aplicação do SQL não está automatizada pelo GitHub.
