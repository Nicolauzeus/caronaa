# CARONAA · Pesquisa acadêmica expressa (0113)

## Escopo

- **UNIFOR** código `0K9K09K`: versionamento não destrutivo de v2 → v3; históricos de respostas, versões e recibos permanecem como estavam.
- **Novos modelos de universidade urbana**: o template padrão utiliza `ACADEMIC_EXPRESS_V1`.
- **UNILAB/regional publicada**: mantida na versão original por conter perguntas de transporte profissional regulamentado. Não converter automaticamente uma pesquisa regional com profissionais em um fluxo apenas de carona compartilhada.
- Outros formulários existentes seguem seu esquema e suas condições originais.

## Etapas

**Passageiro / Motorista**: identificação + perfil → rota e horários → preferência do perfil → ativação com consentimentos (**4 telas**).

**Ambos**: identificação + perfil → rota e horários → campos de motorista → preferências de passageiro → ativação (**5 telas**).

A escolha do perfil avança automaticamente somente quando nome/vínculo/e-mail (caso a coleta esteja ativa) estão preenchidos. Em dispositivos pequenos ou com teclado, a área de conteúdo pode rolar internamente; nunca cortar campos ou controles para forçar uma altura fixa. Botões de toque a partir de 52 px; barra 3 px; foco e acesso por teclado.

## Redundâncias removidas

Não há segunda pergunta sobre dor principal, segunda disposição de pagar, três perguntas de intenção ou promessa de economia não calculada. Passageiro não responde veículo/vagas. Motorista não responde modo de transporte/custo do passageiro. Ambos reutilizam o mesmo trajeto e horários.

**Rota e horários:** dados em `research_journeys`; não são uma viagem publicada. **E-mail:** somente em `research_lead_contacts` com autorização específica, sem newsletter implícita. **Nome:** na resposta sob a RLS já existente, com finalidade informada.

## Limites da ativação

1. Domínio `@unifor.br` (ou outro cadastrado pelo admin) é somente **indicação visual**. Conta com e-mail confirmado **não comprova vínculo/matrícula**. Não dar badge institucional ou furar o gate de campanha pela checagem do domínio.
2. Conclusão da pesquisa **não cria conta**; o participante pode escolher cadastro normal depois. Uma conta não deve ser criada em nome de terceiro sem verificação da titularidade.
3. Não criar automaticamente oferta, pedido, reserva, QR, Pix, cobrança ou promessa de embarque para `launchDate`. A data é previsão sujeita a confirmação institucional.
4. `Registrar interesse` é opção separada, afirmativa, que chama `register_research_interest`. Erro nesta etapa não deve falsificar a conclusão da pesquisa.
5. Valores de economia/repasse só devem aparecer quando houver rota, tarifa e situação de pagamento confirmadas — sem dados simulados.

## Ordem do rollout

1. CI: testes unitários, TypeScript, integração PostgreSQL, mobile/desktop, suíte geral, build.
2. Merge na `main`, sincronização de fonte com o Lovable.
3. Executar `0113_unifor_academic_express_publication.sql` em transação, com auditoria prévia de versão ativa (v2), e validar v3 após commit. **Não** aplicar antes do novo frontend estar sincronizado.
4. Testar como visitante, com perfis PASSAGEIRO, MOTORISTA e AMBOS, inclusive voltar e mudar de perfil.
5. Confirmar publicação efetiva no domínio público separadamente do merge.

### SQL de verificação (somente leitura)

```sql
SELECT f.code,v.version_number,v.published_at,
       v.schema_json->>'experience' AS experience,
       (SELECT COUNT(*) FROM public.research_answers a
        WHERE a.form_id=f.id AND a.version_id=v.id) AS saved_answers
FROM public.research_forms f
JOIN public.research_form_versions v ON v.form_id=f.id
WHERE f.code='0K9K09K'
ORDER BY v.version_number DESC;

SELECT to_regprocedure('public.guard_academic_express_capacity()') IS NOT NULL
 AS capacity_guard_installed;
```

### Retorno à experiência anterior

**Nunca** atualizar/despublicar a v2 ou reescrever respostas históricas. Se a v3 precisar ser suspensa, desabilitar temporariamente a coleta via estado de formulário e criar **v4** copiando o esquema original da v2 para uma nova publicação aprovada. Registrar a decisão e a reconciliação de indicadores por versão.
