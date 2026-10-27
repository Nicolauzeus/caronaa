# F01 — CRM unificado + fluxo exclusivamente motorista (27/10/2026)

## Decisão de produto e compatibilidade

A exceção definida para o Express Acadêmico V2: perfil **MOTORISTA** não responde nem recebe as perguntas de dores de passageiros. O perfil **AMBOS** responde às dores como passageiro. Perfis publicados anteriormente permanecem imutáveis: não remover campos nem respostas de versões históricas, inclusive UNILAB V4/V5 e UNIFOR V1/V3.

O componente AcademicExpressForm mantém cinco etapas visuais; a quarta pode dividir-se em subpainéis para passageiro/ambos. MOTORISTA vai do veículo e vagas diretamente para a ativação.

- MOTO: 1 vaga obrigatória, preenchida automaticamente. O seletor é ocultado.
- CARRO: chips 1–4 e entrada numérica 1–4. O usuário pode ajustar antes de seguir.
- Caso a versão publicada ainda requeira dores para motorista, a UI apresenta erro explícito de atualização necessária em vez de enviar um recibo inválido.

## CRM multiformulários — proveniência de dados

`getUnifiedCrmContacts` em `src/lib/crm/unified-crm-service.ts` lê, sem alterações:
1. `pitch_contacts` pela política RLS atual de admins.
2. `form_submissions` e `form_submission_pain_points` (STS histórico e origens próprias), também por RLS.
3. `research_answers`, `research_form_versions`, `research_journeys`, `research_lead_contacts`, `research_forms` e configurações apenas pela RPC de administrador `get_admin_research_crm_rows`.

Não existe tabela geral `research_leads`: o nome real é `research_lead_contacts`. Nunca repetir nem inferir e-mail de participantes anônimos. A ficha mantém o `raw_payload` de **cada** participação, identificado por origem, formulário e horário. A consolidação por e-mail normalizado (ou telefone consentido, quando não há e-mail) não mistura respostas de campanhas. Pessoas sem identidade de contato mantêm registros separados. Fonte e filtro de origem não exigem hardcoding de códigos: UNIFOR, UNILAB e outros formulários provêm do catálogo. STS e Pitch são fontes históricas adicionais.

`unified_crm_contact_statuses` persiste status sem alterar as tabelas originais, com RLS admin para leitura e escrita. O WhatsApp só é clicável se aquele **número específico** tiver consentimento de contato, não apenas vínculo de e-mail ou outra participação. A flag de domínio institucional é indício de configuração, não verificação de titularidade. A exportação CSV neutraliza fórmulas de planilha e usa somente contatos já autorizados no painel.

As duas rotas administrativas exibem filtros, indicadores, ficha completa e CSV. Telas antigas STS/Pitch continuam acessíveis para operações legadas. A consulta pagina cada origem para impedir o truncamento silencioso das primeiras 1.000 linhas; acima de 20.000 por fonte apresenta erro explícito e requer paginação do servidor.

## Migrações (NÃO aplicadas nesta implementação)

- `0119_academic_driver_no_passenger_pains.sql`: substitui a guarda de V2 de forma compatível e cria uma **nova versão publicada** com as condições por papel para todo formulário ativo que ainda esteja no Express V2 sem essas condições (por exemplo, UNILAB-1 V5→V6). Respostas anteriores permanecem intocadas. Depende de `0116`; aborta se existir rascunho aberto.
- `0120_unified_multiform_crm.sql`: nova RPC de leitura admin-only e tabela de status protegida por RLS. Depende das estruturas atuais da pesquisa e dos papéis admin existentes.
- `0117_unifor_f01_v4_rollout.sql` foi alinhada ao Express V2: a migração UNIFOR só deve ser aplicada se houver decisão de atualizar a versão publicada dessa campanha. Não é pré-requisito do CRM.

**Ordem operacional segura:** backup do banco → validar `0116` e o frontend → executar `0120` → publicar o frontend compatível → executar `0119` → validar novas respostas de motorista, moto e carro, em UNILAB V6 e outros Express V2. Nunca executar `0118` novamente se a UNILAB já estiver em V5 ou superior. Não executar migrações automaticamente pelo merge.

## Testes de aceite

Rodar a partir do clone real do repositório (Node/Bun e dependências presentes):

```bash
bunx vitest run src/lib/crm/unified-crm-service.test.ts src/components/admin/UnifiedCrmWorkspace.test.tsx src/components/research/AcademicExpressForm.test.tsx src/lib/formulario/academic-express-schema.test.ts src/lib/formulario/unifor-compact-groups.test.ts
npx tsc --noEmit
npm run build
```

Verificar:
- MOTORISTA: seleção MOTO define automaticamente 1 vaga, não solicita dores, vai para ativação, sem submissão inválida.
- CARRO: entrada manual/seleção 1 a 4; valor 5 rejeitado; sem dores para somente motorista.
- PASSAGEIRO e AMBOS continuam com dores obrigatórias e a principal coerente.
- Ficha CRM agrupa participação da mesma pessoa em UNIFOR, UNILAB e STS por e-mail, conservando cada registro separado.
- Perfis investidor/parceiro do Pitch; filtros compostos; status com RLS, WhatsApp com consentimento e exportação segura.
- Sem alteração de documentos de motorista, CPF, pricing ou lógica de matching.

**Execução nesta sessão:** a tentativa de `bunx vitest run` no runtime disponível falhou com `bunx: command not found` (exit 127). Este runtime também não tem clone do repositório nem dependências, e o GitHub não oferece runners pagos disponíveis nas últimas execuções; portanto resultados Vitest/TypeScript/Vite continuam **não verificados**, sem qualquer declaração de 100% aprovado.
