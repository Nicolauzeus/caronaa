# Proteger o catálogo de referências geográficas

## Único alerta selecionado

A tabela `public.spatial_ref_sys`, pertencente à extensão geográfica PostGIS, está sem proteção por linha e permite escrita a visitantes e usuários autenticados. Isso permite adulterar referências usadas em cálculos geográficos.

Correção limitada a essa tabela: ativar RLS, permitir somente leitura das referências públicas e remover escrita dos clientes. Não modificar dados, extensão, outras funções ou outros alertas.

**Aprovação solicitada:** aplicar exatamente o SQL abaixo. Esta autorização é necessária pela regra do projeto de aprovação prévia de alterações de banco.

## SQL completo

```sql
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.spatial_ref_sys
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spatial_ref_sys
  TO anon, authenticated;
GRANT ALL ON TABLE public.spatial_ref_sys
  TO service_role;

CREATE POLICY spatial_ref_sys_public_reference_read
  ON public.spatial_ref_sys
  FOR SELECT
  TO anon, authenticated
  USING (true);
```

Referências geográficas são públicas, não dados pessoais. A leitura é preservada para evitar regressões em operações geográficas; visitantes e usuários não terão política nem privilégios de alteração.

## Verificação e limitações

- Confirmar RLS ativo, leitura permitida e INSERT/UPDATE/DELETE/TRUNCATE bloqueados para os clientes.
- Conferir operações geográficas de leitura sem alterar registros ou viagens.
- Revalidar somente este alerta e atualizar seu estado com a ferramenta de segurança após comprovar a correção.
- A tabela pertence a uma extensão e é administrada pelo serviço. Se a execução recusar por propriedade/permissão, parar e relatar; não trocar proprietário nem recriar a extensão.
- Não alterar nem ignorar qualquer outro alerta.

## Relatório de desenvolvimento

**Módulo:** segurança da base geográfica utilizada por F03–F08. **Status:** diagnóstico confirmado; aplicação aguardando aprovação. **Arquivos:** somente este plano, seguido do SQL incremental gerado pela ferramenta se autorizado. **Testes:** leitura confirmou ausência de RLS e privilégios amplos; correção ainda não aplicada. **Riscos pendentes:** permissões do proprietário da extensão e validação após aplicação. **README:** preservar cálculos rodoviários, consentimentos, tarifas e regras de acesso das corridas; nenhuma mudança de produto.

**Corrigidos:** 0 problemas.
**Restantes:** 1 problema selecionado; demais alertas fora deste escopo.
**Resumo:** após corrigir, executar nova verificação; o scanner identifica problemas comuns, mas não substitui testes avançados de invasão.