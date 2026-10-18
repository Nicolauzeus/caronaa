# Departamento 08 — Financeiro e Administrativo

## Entrega
- `/admin/financeiro` e links no catálogo de departamentos.
- Relatórios agregados por moeda, provedor e status, restritos ao admin.
- Consulta read-only de até 50 pagamentos recentes sem dados pessoais.
- Indicadores filtrados em 7, 30 e 90 dias; não soma moedas distintas.
- Fonte `public.payments` com status PAID, REFUNDED e demais estados da transação.
- Nenhuma cobrança, reembolso ou transferência implementada nesta interface.
- Sem valores simulados; não rotular pagamentos registrados como repasses conciliados.

## Migração
Após backup, instalar individualmente `0087_finance_read_only_reporting.sql` no SQL Editor. O runner completo de migrações não deve ser executado antes de reconciliar o histórico.
```sql
SELECT to_regprocedure('public.get_admin_finance_summary(timestamptz)') AS resumo,
       to_regprocedure('public.get_admin_finance_recent(timestamptz,integer)') AS recentes;
```

## Homologação
1. Entrar como Superadmin em /admin/financeiro.
2. Confirmar resumo por moeda e status comparando com SELECT agregado em public.payments.
3. Alternar 7, 30, 90 dias.
4. Confirmar REFUNDED separadamente; nunca classificar como receita.
5. Confirmar que sem pagamentos aparecem estados vazios, não transações fictícias.
6. Confirmar que não há botões para emitir cobrança, reembolsar ou transferir.
7. Testar acesso sem admin às RPCs: deve receber erro de permissão.
8. Testar 360px, 768px e desktop.
9. Executar testes e build e verificar GitHub Actions.
10. Não publicar até autorização.

## Próximas etapas
- Validar a origem de custos de processamento, saldo, liquidação e repasses.
- Construir conciliação quando houver evidência verificável do provedor.
- Adicionar controle de despesas e orçamento com modelagem específica.
- Não calcular divisão financeira com valores hipotéticos.
