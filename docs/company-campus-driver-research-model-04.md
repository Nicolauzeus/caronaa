# Modelo 04 — Empresa próxima à universidade

## Finalidade e hipótese
Pesquisar se colaboradores de uma empresa situada perto de uma universidade poderiam compartilhar lugares **em rotas que já realizam**, sem desvios indesejados, com estudantes próximos. Captar demanda, capacidade, horários e condições de confiança; nunca confundir uma resposta de pesquisa com habilitação, carona publicada, reserva ou pagamento.

## Como configurar
1. Admin → Central de Formulários → **Novo formulário**, natureza **EMPRESA**, modelo **Empresa próxima à universidade · motoristas**.
2. Definir código único, título, empresa, unidade, endereço institucional, **universidade/instituto próximo** (campo próprio), município/região, campanha/origem e horários de turnos. Preencher dias e horários realmente praticados; o preset oferece apenas sugestões editáveis.
3. Informar data confirmada ou **prevista** de início, conforme realidade. Se a empresa não aprovou formalmente a iniciativa, deixar **parceria não confirmada**. A inclusão do nome de uma universidade nas proximidades não comprova parceria com ela.
4. Configurar pontos seguros de embarque se existentes, política de uso, logomarca apenas se autorizada. Revisar e publicar o rascunho.
5. Para reutilizar em outra empresa/universidade: selecionar o modelo novamente, preenchendo **nova identificação, unidades, instituição próxima, horários e campanha**. Não copiar respostas, consentimentos ou selos.

## Questionário (até dez questões, condicionais)
- Transporte atual e se dirige carro até a empresa.
- Para quem dirige: frequência, lugares livres, disposição de levar estudantes, condição mais importante e desvio máximo aceitável.
- Para todos: maior dificuldade atual, interesse na solução e no lançamento.
- No passo estruturado já existente: perfil passageiro/motorista/ambos, dia, horário, ponto de partida e região de destino, sentido, flexibilidade e consentimentos individuais.
- Perguntas de motorista desaparecem do formulário caso o colaborador não dirija.
- Um colaborador com **zero vagas ou sem interesse em oferecer** não pode escolher perfil MOTORISTA/AMBOS para registrar disponibilidade. Quem não dirige ainda pode participar como passageiro.
- Interesse em receber informações **não é autorização automática para comunicação comercial**; esta é separada no passo institucional.

## Mensagem ao público
Apresentar a proposta de forma curta, nomeando a empresa, a unidade e a universidade próxima. Mostrar a condição real da parceria e a data/estado do início; nunca afirmar que a empresa já autoriza o transporte ou que a universidade aderiu por simplesmente estar perto.

## Inteligência de mercado e CRM
Os seguintes indicadores são agrupados por código estável (com denominadores por versão, instituição, campanha, região, horário e perfil):
- Transporte atual (`TRANSPORT_MODE`), dificuldade (`MOBILITY_PAINS`).
- Motoristas que dirigem (`COMPANY_DRIVES_CAR`), frequência de carro (`COMPANY_DRIVING_FREQUENCY`), potencial de lugares (`SEATS_AVAILABLE`).
- Intenção de oferecer (`RIDE_OFFER_INTENT`), fatores de confiança (`TRUST_FACTORS`) e desvio máximo aceitável (`COMPANY_MAX_DETOUR`).
- Intenção de adoção (`ADOPTION_INTENT`) e participação no lançamento (`LAUNCH_PARTICIPATION_INTENT`).
- Na rotina institucional: perfis, horários, interesses e disponibilidades explicitamente registradas (`DRIVER_AVAILABILITY_REGISTERED`).

**Atenção:** lugares e disponibilidade são declarados, e correspondência de rotas só é comprovada com dados e confirmação operacional. Nenhum percentual de pesquisa deve aumentar métricas de corridas realizadas ou pagamentos. Não compartilhar rotas, contato ou identificação individuais com empregadores ou universidades; análises externas só agregadas, considerando limiares mínimos de grupo.

## Implantação — dependências
- `0095_reusable_research_infrastructure.sql` e `0096_research_trash_and_guarded_deletion.sql` já pertencem à base do projeto.
- O PR #17 (Modelo 02) introduz `0097_regional_university_market_metrics.sql`. A nova migration **`0098_company_campus_research.sql` deve ser aplicada depois da 0097**, pois sua função de BI preserva os novos indicadores regionais da 0097 e adiciona os corporativos.
- `0098` acrescenta o campo JSON `nearbyUniversity` à validação da configuração e atualiza a função agregadora institucional, sem criar tabelas de colaboradores ou alterar respostas antigas.
- Fazer backup antes e testar primeiro em homologação. **Não aplicar novamente as migrations 0095 e 0096 só porque a numeração foi regularizada no GitHub**. Conciliar histórico manual de aplicação antes da automação.
- Sem a `0098`, a criação de formulários com o novo campo falhará na validação SQL e os novos indicadores não aparecerão no BI. **O merge do código não aplica SQL no Supabase.**

## Testes guiados
1. Criar rascunho empresarial, logo autorizado e instituto próximo; alterar horário e data; publicar apenas após revisão.
2. Testar motorista com dois lugares e confirmação; verificar que só grava intenção, não oferta, cobrança ou reserva.
3. Testar motorista com zero lugares e resposta "aceitaria": bloqueio coerente.
4. Testar pessoa sem carro: campos de motorista ocultos e impossibilidade de salvar como MOTORISTA/AMBOS.
5. Testar negativa de oferecer carona: não deve registrar disponibilidade em perfil motorista.
6. Testar horários de saída/destino via interface mobile e mudança de dados do campus; consentimentos, pesquisa anônima, RLS e duplicação para outra empresa.
7. Conferir no BI contagens por versão e empresa; filtragem por `nearbyUniversity`; respostas sem identificação pessoal.
8. Confirmar que o selo representa **participação na pesquisa**, jamais vínculo com empresa ou universidade.

Executar `npm test`, `npx tsc --noEmit`, `npm run build` e pipelines GitHub de pesquisa/integração/visualização. Nenhum teste deve publicar ofertas reais em produção.
