# CARONAA F01 — Pesquisa acadêmica expressa V2 (novos rascunhos)

## Compatibilidade e publicação

- O schema `ACADEMIC_EXPRESS_V1` e os históricos de UNIFOR (código público `0K9K09K`) não são atualizados. UNILAB e formulários tradicionais permanecem no motor atual.
- Novos rascunhos `F01_UNIVERSIDADE` com a opção **Experiência acadêmica expressa** usam `ACADEMIC_EXPRESS_F01_V2`. Rua e empresa mantêm o modelo simplificado F01 de três etapas.
- Não é criada uma versão publicada sem ação explícita no Admin. Requer `research_configurations`, `research_lead_contacts` e `0110_research_survey_window`.
- `0116_academic_f01_domain_hint_and_guard.sql` é aditiva: indicador de domínio no lead, proteção no servidor de dores sociais, capacidade de motocicleta e 1–4 vagas nas respostas F01 V2. Exige execução controlada após validação. Nenhuma migração foi aplicada por este PR.

## Fluxo e privacidade

1. Nome completo, vínculo (quatro opções) e e-mail autorizado para contato.
2. Passageiro, motorista ou ambos; seleção avança automaticamente.
3. Região de origem, destino editável (campus configurado), dias e horário. GPS só mediante toque; a busca reversa produz o nome aproximado da localidade e **não grava coordenadas precisas**.
4. Campos específicos do perfil, depois a **única** seleção de dores sociais com até três respostas, dor principal e texto Outra. Dois painéis compactos na mesma etapa 4; nenhuma redundância entre papéis.
5. Resumo, aceite da pesquisa, autorização separada para identificação por e-mail, marketing opcional e registro de interesse **também opcional**. Ambos pode autorizar registro de interesses de passageiro e motorista.

Envio: `submit_configured_research_answer` grava respostas e rotina de forma idempotente; `capture_research_lead` grava contato no CRM; `register_research_interest` grava intenção declarada somente com aceite. Responder **não** registra viagem, oferta, reserva, pagamento ou acesso especial. O domínio configurado para o e-mail é apenas um indício, não prova de titularidade/matrícula.

O pré-lançamento exibe dias até a data configurada e preserva separação entre diferentes formulários/contagens. Sem data de início, não promete viagem inaugural.

## Validação e rollout

1. Validar permissões de Admin e dependências DB: 0095, 0103, 0110, 0113 e migration 0116. Executar 0116 em homologação primeiro; migrar produção com backup e observabilidade.
2. `npm install --no-audit --no-fund` (o repositório tem lockfile em atualização), `npx tsc --noEmit`, `npm test -- src/lib/formulario src/components/research/AcademicExpressForm.test.tsx src/components/admin/SimpleResearchCreator.test.tsx`, `npm run build`.
3. `node scripts/test-research-navigation.mjs` com Playwright disponível. Verificar 375×667 e 393×852, com screenshots de cinco etapas (painel adicional da quarta etapa incluído).
4. Testar no Admin `TESTE-CAMPUS` com região não cadastrada, domínio arbitrário, rascunho, revisão e publicação explícita. Testar também RPC indisponível, concorrência de código e falha com cleanup.
5. Validar como visitante e conta confirmada; e-mails institucionais e comuns; perfis Passageiro/Motorista/Ambos; consentimento de contato, retorno em erro parcial e participação em duas campanhas.
6. A publicação e as migrations são ações operacionais separadas do merge no GitHub. Não aplicar `0113` novamente para converter formulários legados; é uma migration específica à versão UNIFOR já publicada.

## Critérios que não podem ser simulados

- Não afirmar que há carona inaugural marcada ou matches garantidos apenas por responder.
- Não liberar cadastro sem verificação por coincidência do domínio.
- Não ocultar campos num aparelho com teclado aberto só para afirmar 'zero scroll'; a página usa altura do viewport e contém o formulário, com rolagem interna apenas quando estritamente necessária.
- Testes e screenshots devem ser executados de fato; a existência dos testes no repositório não equivale a uma execução aprovada.
