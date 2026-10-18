# Infraestrutura reutilizável de pesquisas — 0095

## Escopo

Base para os cinco modelos oficiais solicitados: duas modalidades universitárias, eventos com caronas, empresas próximas ao ensino e caronas entre colaboradores. Os cinco questionários específicos não foram escritos nesta entrega, conforme a diretriz de implementá-los nos próximos prompts. Os modelos existentes continuam disponíveis.

A auditoria encontrou catálogo e editor funcionais, versões publicadas imutáveis, publicação atômica, respostas anônimas, consentimento de pesquisa, recibos privados e selos de participação. Faltavam configuração institucional persistente, contexto histórico dessa configuração, horários por perfil, trajetos estruturados, manifestação de interesse separada e agregação por coorte com denominadores condicionais.

## Implementação

- O administrador pode configurar uma pesquisa ao escolher um modelo na Central de Formulários. O caminho de rascunho sem configuração continua disponível.
- As configurações existentes podem ser mantidas na aba Configurações do detalhe da pesquisa. Pesquisas históricas encerradas não recebem esse editor.
- Instituição, identificador, unidade, endereço institucional, coordenadas opcionais, campanha, origem informada, região, data, fuso, situação, horários, perfis e política ficam em estrutura própria no banco.
- A configuração admite dias e horários gerais ou específicos por perfil. Os horários iniciais são sugestões editáveis, sem atribuição a uma instituição real.
- Política de público e referência de preço são estruturadas. A referência de preço exige uma origem quando houver valor; não é cotação, cobrança ou alteração de tarifa.
- A identidade visual permanece no gerenciador de marca existente, com autorização institucional. Não se copia automaticamente a imagem de outra instituição.
- Cada salvamento tem revisão, responsável e horário; atualização concorrente exige a revisão esperada. Cada resposta nova guarda o contexto de configuração utilizado no envio.
- A cópia recebe formulário, código, versão, seções e perguntas próprios, com referências condicionais remapeadas. Não copia respostas, recibos ou selos. A configuração é independente, o lançamento volta a planejado e a confirmação de parceria é removida.
- As cópias preservam também os limites numéricos de modelos antigos que dependiam do identificador da pergunta.

## Resposta Pública e Interesse

Pesquisas sem configuração mantêm o envio existente. As configuradas usam um RPC transacional que grava resposta e trajeto conjuntamente. Os gatilhos existentes continuam verificando publicação, disponibilidade, vínculo entre versão e pesquisa, consentimento e conteúdo das respostas.

O passo de trajeto registra perfil, modalidade, sentido, dias, horários, escolha explícita de “Outro horário”, flexibilidade e regiões aproximadas. Reutiliza o componente de localização e seu catálogo/geocodificador, quando disponível. Coordenadas são opcionais e arredondadas a três casas pelo servidor. Uma descrição sem coordenadas continua sendo declaração para pesquisa; não é evidência suficiente para correspondência de rota.

Em percursos somente de volta, os intervalos sugeridos de retorno são usados. Mudar o sentido inverte os campos de origem e destino, sem alterar silenciosamente o horário informado. Ida e volta têm horários separados.

Após confirmar a resposta:

1. Passageiro pode autorizar e registrar interesse em procurar carona.
2. Motorista pode autorizar e registrar disponibilidade.
3. Perfil ambos permite ajustar trajetos e confirmar cada papel independentemente.
4. Interesse em transporte profissional permanece como pesquisa; o endpoint de interesse em carona recusa essa modalidade.

Os registros são identificados como `INTERESSE_REGISTRADO` e `DISPONIBILIDADE_REGISTRADA`, nunca como oferta publicada, reserva, correspondência ou viagem confirmada. Não há criação automática de viagem, cobrança, repasse ou contrato.

Para uma solicitação/oferta efetiva, o participante continua no aplicativo e usa os fluxos autenticados existentes, com suas validações de rota, preço e consentimento. Esta entrega não transporta automaticamente os dados da pesquisa para uma publicação real. Não foi criado um novo motor de correspondência nem uma aproximação por bairro ou horário para substituir o motor operacional.

A data e a situação configuradas aparecem no início e na conclusão. A conclusão consulta novamente a configuração e a atualiza a cada minuto enquanto estiver aberta. As respostas históricas mantêm seu snapshot, mesmo que a comunicação de lançamento mude.

## Consentimento e Segurança

- Participação na pesquisa, contato comercial, compartilhamento com parceiros e manifestação futura de interesse têm confirmações próprias.
- Nenhuma conta é exigida para responder ou manifestar interesse. Publicações e reservas efetivas continuam exigindo a autenticação dos serviços existentes.
- O recibo privado continua servindo para a associação voluntária do selo à conta com e-mail confirmado. O selo comprova participação no questionário, não matrícula, emprego, identidade ou credenciamento.
- Contato institucional, jornadas, recibos e snapshots completos não têm leitura anônima. A configuração pública omite o contato institucional.
- As novas tabelas têm RLS e não concedem escrita direta aos clientes. Ações administrativas de Pesquisa continuam limitadas ao administrador global, em coerência com a migração 0094; nenhum papel ou acesso adicional foi concedido.
- Respostas configuradas não podem usar o INSERT público simples para contornar o passo de trajeto. A flag de configuração é protegida contra inconsistência com o registro persistido.
- O envio é idempotente, com bloqueio por pesquisa/recibo e comparação do conteúdo original. Repetir um recibo com outro trajeto não substitui silenciosamente o primeiro.
- Leituras agregadas excluem contato, localização e texto livre também no RPC anterior de resumo do questionário. Os dados originais continuam disponíveis somente nos fluxos autorizados de análise individual.

## Semântica e Inteligência

Permanecem os significados de `DOR_01` a `DOR_06`, `TRANSPORT_MODE`, `COST_PER_TRIP`, `TRAVEL_TIME`, `MOBILITY_PAINS`, `PERCEIVED_SAFETY`, `ADOPTION_INTENT` e `TRUST_FACTORS`. Nenhuma resposta histórica foi recodificada.

| Código novo de pergunta       | Tipo             | Significado                                              |
| ----------------------------- | ---------------- | -------------------------------------------------------- |
| `RIDE_OFFER_INTENT`           | Sim/não          | Disponibilidade declarada para oferecer carona           |
| `BOOKING_INTENT`              | Sim/não          | Intenção declarada de solicitar carona                   |
| `MOBILITY_MODE`               | Escolha única    | Modalidade pretendida                                    |
| `NORMALIZED_DEPARTURE_TIME`   | Horário          | Horário local HH:mm                                      |
| `TRAVEL_FREQUENCY`            | Escolha única    | Frequência declarada de deslocamento                     |
| `ACCEPTABLE_FARE_RANGE`       | Faixa de valores | Faixa aceitável por trecho                               |
| `WILLINGNESS_TO_PAY`          | Sim/não          | Disposição declarada a pagar                             |
| `QUOTE_ACCEPTANCE_INTENT`     | Sim/não          | Intenção declarada de aceitar cotação; não é aceite real |
| `ACQUISITION_SOURCE`          | Escolha única    | Origem declarada no questionário                         |
| `LAUNCH_PARTICIPATION_INTENT` | Sim/não          | Intenção de participar do lançamento                     |

Editor e banco verificam os tipos desses códigos. Em pesquisas configuradas, códigos analíticos repetidos na mesma versão são rejeitados na publicação. Alterar um enunciado continua removendo sua classificação anterior, como no editor existente.

Dimensões de jornada são agregadas separadamente em `JOURNEY_PROFILE`, `JOURNEY_MODE` e `JOURNEY_DEPARTURE_TIME`. Os registros explícitos posteriores ao envio usam `PASSENGER_INTEREST_REGISTERED` e `DRIVER_AVAILABILITY_REGISTERED`. Não são eventos de criação de carona.

O Centro de Pesquisa tem a aba Coortes institucionais, com filtros por pesquisa, instituição, campus, campanha, modelo, perfil, modalidade, horário local, período UTC, região institucional, origem da campanha e versão.

Para cada pergunta/versão, o banco calcula:

- Elegíveis: respondentes para os quais a pergunta era visível.
- Responderam: elegíveis que informaram valor não vazio.
- Selecionaram: respondentes distintos por alternativa; múltiplas escolhas podem superar 100% na soma.
- Percentual sobre a base elegível; base zero não produz uma taxa fictícia.

As novas coortes não incluem STS histórico nem eventos de navegação. A origem da campanha é a origem configurada pelo administrador, não comprovação de canal individual de aquisição. Regiões institucionais são filtros de configuração, não endereço residencial.

O painel diferencia os nove níveis de evidência. Aceite real de cotação, criação de oferta/solicitação, correspondência, viagem, pagamento e nova utilização permanecem `N/D` enquanto não houver integração operacional e vínculo de identidade/coorte verificados. Nenhuma resposta “eu pagaria” compõe receita ou pagamento.

A exportação CSV contém somente colunas agregadas, versão, classificação, categoria e denominadores. Contatos, coordenadas e recibos não entram no arquivo; fórmulas de planilha são neutralizadas.

## Implantação em Homologação

Nada foi aplicado no banco de produção. A migration preparada é `drizzle/migrations/0095_reusable_research_infrastructure.sql`.

1. Fazer backup e confirmar que as migrations até 0094 estão presentes no ambiente de homologação, em especial 0070–0079 e 0089–0093.
2. Revisar 0095 e aplicá-la uma única vez em transação no ambiente de homologação. A estrutura de autenticação deve ser a do Supabase e o proprietário dos RPCs deve permanecer confiável.
3. Publicar o frontend correspondente somente no ambiente de homologação e testar com administrador, usuário comum e visitante.
4. Criar uma pesquisa de teste, revisar os dias/horários, adicionar identidade visual autorizada e publicar pelo editor existente.
5. Responder sem conta, repetir o envio para testar idempotência, registrar interesses separadamente e conferir a análise por versão.
6. Alterar a data, conferir a comunicação pública e confirmar que o snapshot anterior não mudou.
7. Duplicar, verificar novos IDs/código/versão e ausência de respostas/selos. Testar arquivamento, restauração e remoção somente com dados de teste e pelas funções existentes.
8. Homologar as evidências antes de autorizar implantação produtiva. Não ativar transporte profissional ou acesso exclusivo a colaboradores apenas por configurar campos nesta pesquisa.

As configurações não são backfilled em formulários já publicados: a nova flag começa falsa. Formulários sem configuração continuam funcionando pelo contrato anterior. Configurar uma pesquisa existente é uma decisão administrativa explícita.

Se a migration ainda não estiver instalada, os novos recursos exibem erro de disponibilidade e não simulam persistência. Não há fallback que crie um rascunho parcialmente configurado. Não remover tabelas novas para reverter uma implantação com respostas: desabilitar as pesquisas e planejar recuperação preservando jornadas, revisões e recibos.

## Matriz de Testes

| Área           | Cobertura                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Configuração   | Datas, fusos, coordenadas, horários, perfis, origem de preço e parceria não presumida                                         |
| Cópia          | IDs/condições remapeados, limites numéricos preservados, novo código, versão e contexto independente                          |
| Publicação     | RPC existente, versão imutável, consentimento e validação semântica                                                           |
| Horários       | Sugestões, Outro horário, sentido, horários por perfil e limite de flexibilidade                                              |
| Condições      | Limpeza transitiva de descendentes ocultos e base elegível no banco                                                           |
| Consentimentos | Pesquisa obrigatória, comercial/parceiros opcionais e interesses separados por perfil                                         |
| Segurança      | RLS real com roles `anon`/`authenticated` no PostgreSQL temporário, administrador e usuário comum, proteção de dados privados |
| Integridade    | Transação sem rascunho órfão, revisão concorrente, recibo idempotente e snapshot histórico                                    |
| Evidência      | Disposição a pagar separada de pagamento, nenhuma corrida automática, profissional não ativado como carona                    |
| Exportação     | Somente agregados e proteção contra fórmulas                                                                                  |
| Visual         | 375, 768, 1280 e 1440 px, configuração, pesquisa pública, jornada e análise                                                   |

Comandos disponíveis:

```sh
npm test -- --maxWorkers=2
npx tsc --noEmit --pretty false
npm run build
node scripts/test-research-infrastructure.mjs
PLAYWRIGHT_MODULE=/tmp/caronaa-admin-browser/node_modules/playwright/index.mjs node scripts/test-research-navigation.mjs
```

O teste SQL usa `pg_virtualenv` e um cluster PostgreSQL local descartável, sem ler `.env` ou URL de banco produtivo. A autenticação tem fronteiras mínimas de teste; funções, políticas, triggers e migrations de pesquisa são reais. A instalação local usada foi PostgreSQL 18; a validação final no PostgreSQL/Supabase de homologação continua necessária.

O teste visual usa serviços simulados exclusivamente em `tests/research-browser`, com componentes reais e cache Vite isolado. Capturas e `results.json` ficam em `/tmp/caronaa-research-visual`. Não comprova publicação ou operação em uma instalação remota.

O workflow Research Quality foi ampliado para testes, TypeScript, PostgreSQL efêmero, navegador e build, com artefatos visuais. As verificações são executadas localmente; o workflow remoto não foi disparado porque não houve commit/push ou publicação.

## Evidências Locais

- TypeScript e build concluídos sem erros.
- Suíte completa: 106 arquivos e 605 testes aprovados; execução confirmada com `--maxWorkers=2` e código de saída zero.
- 52 verificações SQL aprovadas em banco descartável.
- 12 verificações de página/viewport aprovadas, com capturas em quatro larguras.
- ESLint nos novos módulos: nenhum erro e um aviso de Fast Refresh por exportação de função auxiliar junto ao componente.
- Servidor local verificado com HTTP 200; CI remoto ainda não executado.

Passageiro e motorista podem ajustar trajetos independentemente antes de cada confirmação. O RPC de interesse recebe um quinto argumento opcional `p_journey`; valida os horários do perfil contra o snapshot da resposta e persiste cada planejamento separadamente. Essa etapa não altera a resposta original nem amplia consentimentos comerciais ou de compartilhamento.

## Limites Deliberados

- Os cinco novos questionários serão implementados nos próximos prompts.
- O registro de interesse é funcional e persistente; a conversão automática em carona autenticada ainda não está integrada.
- Política de público-alvo é configuração da pesquisa, não prova de vínculo empregatício ou autorização operacional. Serviços exclusivos exigem validação real de pertencimento antes da publicação efetiva de trajetos.
- Transporte profissional depende de regulamentação, aprovação e habilitação fora desta pesquisa.
- Indicadores de transação e utilização real dependem de vínculo explícito com os serviços operacionais. Não há inferência por bairro, horário, nome ou e-mail.
- Não foram aplicadas migrations ou feitas escritas de teste em produção; não houve commit, push ou deploy.
