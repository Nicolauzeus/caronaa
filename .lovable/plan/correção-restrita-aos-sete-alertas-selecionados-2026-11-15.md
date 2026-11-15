# Correção restrita aos sete alertas selecionados

## Resultado da análise

Três políticas aceitam qualquer registro ou leitura. A correção abaixo mantém envio anônimo, mas impede que visitantes definam estados internos, vínculos de terceiros ou valores financeiros finais. A configuração pública de preços será limitada ao registro oficial `singleton`. Não altera regras de corrida ou consentimento e não exige cadastro nos formulários.

Quatro alertas pertencem à extensão PostGIS instalada em `public`: três funções e seu catálogo. O proprietário é o serviço gerenciado; a tentativa anterior de alterar o catálogo foi recusada. A função de leitura identificou PostGIS **3.3.7**, e o papel de migração usual `postgres` não pode atuar como proprietário nem alterar `pg_extension`. Não apagar/recriar a extensão, trocar proprietário ou mascarar os alertas.

## Aprovação solicitada

Aplicar **somente o SQL completo abaixo** às três políticas selecionadas, e verificar os resultados. Os quatro alertas PostGIS permanecerão ativos enquanto não houver permissão para a correção administrada. Nenhum outro alerta será alterado ou ignorado.

### SQL completo das políticas

```sql
ALTER POLICY "Allow public insert to pitch_contacts"
ON public.pitch_contacts
WITH CHECK (
  interest IN ('INVESTIDOR','PARCEIRO','AMBOS')
  AND length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(whatsapp)) BETWEEN 1 AND 50
  AND length(message) <= 10000
  AND status = 'NOVO'
  AND suggestion_status = 'NOVA'
  AND notes IS NULL
);

ALTER POLICY "Público lê configurações de preços"
ON public.pricing_settings
USING (id = 'singleton');

ALTER POLICY "Visitante insere solicitação"
ON public.service_requests
WITH CHECK (
  length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND status = 'recebido'
  AND privacy_policy_accepted IS TRUE
  AND lead_id IS NULL
  AND client_id IS NULL
  AND internal_notes IS NULL
  AND agreed_price = 0
  AND agreed_deadline IS NULL
  AND agreed_payment_terms IS NULL
  AND revision_history = '[]'::jsonb
  AND admin_adjusted_total IS NULL
  AND admin_notes IS NULL
  AND final_currency IS NULL
);
```

As políticas administrativas existentes não serão alteradas. Usuários autorizados pela política administrativa continuam com acesso próprio; visitantes não poderão usar a política pública para introduzir decisões administrativas. Dados existentes não serão atualizados nem apagados.

## PostGIS: bloqueio e preparação necessária

A orientação oficial é mover a extensão sem destruição para `extensions`, fora da exposição pública. Essa operação exige o proprietário gerenciado e preparação das funções existentes: ajustar referências `public.st_*`, tipos e operadores e manter caminhos fixos de busca compatíveis. Não executar uma mudança ampla sem inventário e autorização separados.

O serviço administrador precisa fazer a transferência em transação, preservando dados e dependências; a versão intermediária indicada pela documentação para esta instalação é `3.3.7next`. O acesso do projeto não tem os privilégios exigidos. Não marcar os quatro alertas como corrigidos antes da transferência e verificação.

## Testes e relatório

- Conferir as três expressões reais após aplicação; confirmar ausência de condições tautológicas nas políticas selecionadas.
- Verificar contatos administrativos com os testes existentes e preservar leitura pública do singleton.
- Revalidar o scanner e marcar como corrigidos somente os alertas efetivamente resolvidos.
- **Módulos:** F01/F09 e segurança geográfica F03–F08. **Status:** três correções propostas; quatro bloqueadas por propriedade da extensão. **Arquivos:** plano e migration incremental se aprovada. **Testes:** inspeção somente leitura de políticas, colunas, funções e privilégios. **Riscos:** confirmar compatibilidade dos envios externos não presentes neste código; nenhum sucesso de envio real presumido. **README:** preservado; sem CPF, mudanças de tarifas ou alteração de dados históricos.

**Corrigidos:** 0 antes da aplicação.
**Restantes:** 7 selecionados antes da aplicação.
**Resumo:** executar nova verificação após as correções; o scanner detecta problemas comuns, mas não substitui testes avançados de invasão.