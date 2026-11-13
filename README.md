# CARONAA — Especificação oficial do produto

> **Documento de referência para ChatGPT, Codex, Lovable e demais desenvolvedores.**  
> **Versão:** 2.0 — especificação funcional inicial • **Data:** 25/10/2026  
> **Status:** visão-alvo e requisitos de produto. **Este documento NÃO significa que todas as funcionalidades já estejam implementadas.**
>
> **LEITURA OBRIGATÓRIA:** antes de criar, alterar, corrigir ou testar qualquer fluxo ou funcionalidade, leia este `README.md` e o `AGENTS.md`. Confirme no código o que já existe, preserve o que funciona e evite duplicar soluções. Em caso de conflito entre uma proposta técnica e as regras de produto aqui descritas, interrompa a alteração conflitante e registre a divergência antes de prosseguir.

## 1. O que é o CARONAA

O CARONAA é uma plataforma de mobilidade **mobile-first** que reúne, numa única conta e no mesmo aplicativo:

1. **Carona compartilhada:** o condutor já pretende fazer um trajeto; o sistema encontra passageiros compatíveis, inclusive em subtrechos e horários próximos. Pode ser pontual ou recorrente.
2. **Viagem imediata / transporte profissional:** o passageiro solicita um deslocamento para agora; motoristas e mototaxistas disponíveis podem atender, conforme a região e as condições para operação.

**Princípio de UX:** o passageiro informa de onde sai, aonde vai e quando precisa viajar. A inteligência de matching, recorrência, preços e desvios atua em segundo plano. **Não criar dois aplicativos, duas contas ou dois fluxos de cadastro redundantes.**

### Regiões prioritárias

- **Fortaleza / Edson Queiroz:** foco inicial na comunidade da **UNIFOR**, sem limitar trajetos ao bairro.
- **Maciço de Baturité:** foco na comunidade da **UNILAB** e na mobilidade regional, incluindo Redenção, Acarape e municípios habilitados; estudar especialmente carro e moto sob demanda.

A região é uma configuração de disponibilidade do serviço, **não** uma restrição automática da origem/destino de todas as viagens. Não presumir lançamento, cobertura integral ou autorização de operação em municípios que ainda não tenham sido habilitados.

## 2. Regras de produto inegociáveis para o MVP

1. **Não solicitar, exigir, armazenar como requisito novo ou bloquear acesso por CPF.** CPF está **fora do escopo do cadastro neste momento**. Não adicionar novamente o campo em formulários, onboarding, perfil, APIs ou validações novas sem decisão explícita.
2. **Documentação de motoristas e mototaxistas é apenas informativa/textual nesta fase.** Marca, modelo, placa e informações declaradas podem ser campos de texto. **Não implementar upload obrigatório de documentos, OCR, verificações externas ou bloqueio automático por validação documental rígida no MVP** sem nova definição. Isto **não dispensa** a avaliação de obrigações legais e de segurança antes de disponibilizar transporte profissional ao público.
3. **Uma conta, múltiplos papéis:** passageiro; condutor de carona compartilhada; motorista/mototaxista profissional, quando a modalidade estiver habilitada. O usuário não precisa criar outra conta para mudar ou acumular papéis.
4. **Nenhum dado fictício como se fosse real:** indicadores, preços reais, mapas, demanda, avaliações e disponibilidades devem vir de fontes reais/autorizadas. Mocks só em testes ou exemplos explicitamente identificados.
5. **Respeitar escolhas e consentimentos:** publicação recorrente, notificações, localização e propostas de desvio não podem ser ativadas silenciosamente.
6. **Nunca afirmar conclusão por tela pronta:** requer validação funcional, persistência, permissões, estados de erro, testes e confirmação de que o fluxo não quebrou módulos existentes.

## 3. Estrutura de navegação e UX

### Menu inferior — quatro destinos

- **Início:** mapa, origem/destino, modos de viagem e atalhos.
- **Oferecer:** publicar carona; ferramentas de disponibilidade profissional apenas para usuários habilitados.
- **Viagens:** futuras, em andamento, histórico, reservas e recorrências.
- **Perfil:** dados pessoais, veículos, papéis, preferências, avaliações e ajustes.

### Tela inicial do passageiro

**Revisão de UX (07/11/2026):** mapa Google em destaque e painel inferior expansível.
As opções são Carona Compartilhada (carro, até três passageiros por pedido), Carona Moto
(uma vaga) e Corrida Direta (piloto regional existente, com preço independente).
Mostrar o preço estimado final, sem expor a fórmula matemática nos componentes da interface.
O cálculo compartilhado descrito em F03 continua inalterado no servidor e na biblioteca.

**Carona entre mulheres:** somente perfis com `profiles.gender = 'FEMININO'` visualizam
os controles opcionais de passageira/condutora. Homens não recebem controles nem mensagens
sobre o recurso. Passageiros com gênero não informado recebem somente uma dica discreta
com link para completar o Perfil; o toggle permanece ausente. Pedidos que optam pelo recurso combinam apenas
com condutoras de ofertas exclusivas para passageiras. Persistir e validar esses filtros
antes do matching; não converter ofertas ou pedidos históricos silenciosamente.
A migration 0137 deve preceder a publicação desta interface.

**Localização e encontro (07/11/2026):** a Home operacional solicita GPS automaticamente
em celular e desktop, respeitando a permissão do navegador. Recusa/indisponibilidade
libera origem manual; uma escolha manual nunca é sobrescrita por uma resposta tardia.
A origem contratada usa o fix de GPS inicial (ou um novo fix solicitado), enquanto o
marcador pode acompanhar o movimento sem refazer cotações a cada atualização.
Coordenadas resolvidas seguem para a cotação rodoviária no servidor e para o piloto F07.
A seleção de Corrida Direta abre `/viagem-rapida`, sem montar o piloto dentro do sheet.

Após uma combinação autorizada, a Home mostra a sugestão de encontro para oferta estrita
ou rodovia identificada nos endereços/ponto de referência salvos da oferta (BR/CE).
Não inferir rodovia apenas por proximidade geográfica. Usar a rota viária salva do
condutor, referência próxima e caminhada Google quando disponível. O mapa exibe os
pontos e a caminhada pontilhada real. Não inventar distância/tempo quando a rota a pé
falhar, nem alterar unilateralmente embarque, política de desvios ou tarifa.
Esta autorização de GPS automático é da Home operacional; F01 mantém GPS após toque.

1. Informar origem (GPS autorizado ou digitação).
2. Informar destino.
3. Escolher **Compartilhar carona** ou **Viajar agora**.
4. Visualizar opções elegíveis com **preço, horário/ETA, embarque, tipo de veículo e avaliação**.
5. Confirmar e acompanhar no mapa.

Não exigir que o passageiro entenda o algoritmo de matching para viajar.

### Identidade visual obrigatória

- Primária: **`#FFBB00`**; dark: **`#121212`**; fontes **Sora / Manrope**.
- Layout minimalista, moderno, mobile-first, campos claros, poucas etapas e feedback de carregamento/vazio/erro/sucesso.
- Priorizar acessibilidade, contraste, alvos de toque confortáveis e textos curtos em português correto.
- Não reintroduzir a identidade verde, telas excessivas, cards aninhados, espaços vazios desnecessários ou perguntas repetidas.

## 4. Fluxos de produto — desenvolver e testar um por vez

> **Convenção:** cada módulo inclui objetivo, fluxo, regras e aceite mínimo. As descrições abaixo são **requisitos**, não relatório de implementação. A sequência recomendada é **F01 → F02 → F03 → F04 → F05 → F06 → F07 → F08 → F09**, respeitando dependências reais já existentes.

### F01 — Formulários simples, dores sociais e participação

**Objetivo:** identificar problemas reais de mobilidade, formar uma base de pesquisa qualificada e alimentar o CRM.

**Modelos:** **universidade**, **rua/comunidade** e **empresa**. Compartilham motor, componentes e códigos padronizados das dores; apresentam apenas perguntas contextuais necessárias.

**Padrão aprovado para universidades (27/10/2026):** a experiência pública da UNILAB de cinco etapas e visual Glass é a referência para UNIFOR e novos campi, inclusive campos de origem/destino, dias e horários habituais de ida e retorno. A etapa de rota deve sempre expor **Minha localização** (GPS somente após toque/permissão) e **Buscar localização** (autocomplete com opção de digitação manual), inclusive no iPhone. Somente a região aproximada pode ser salva; nem a busca nem o GPS são obrigatórios. **PASSAGEIRO e AMBOS devem responder à pergunta única de dores sociais**, com até três escolhas e a dor principal, na etapa 4; **MOTORISTA exclusivamente não recebe essas perguntas**. A interface é reutilizável por instituição via configuração e nunca deve remover dores para passageiros ao reduzir perguntas redundantes. Formulários publicados exigem nova versão imutável para alterações de schema, preservando respostas históricas.

**Universidade acadêmica expressa (F01 V2, revisão 27/10/2026):** novos rascunhos universitários podem optar por cinco etapas: identidade e e-mail; perfil com avanço automático; trajeto e rotina; prioridade do passageiro ou veículo/vagas do motorista **mais um painel único de dores sociais na mesma etapa 4**; e consentimento/registro opcional de interesse. Eliminar perguntas redundantes de custo/orçamento, transporte habitual, modelo de veículo e motivação do condutor do Express V2. O indicador segue em cinco etapas e o objetivo de preenchimento é ~45 segundos (não é uma promessa de tempo garantido). O viewport mobile usa `100dvh`; se o conteúdo não couber por teclado ou acessibilidade, permitir rolagem **interna**, nunca cortar opções. Rua e empresa continuam com o F01 padrão de três etapas. Versões já publicadas permanecem imutáveis; UNIFOR e UNILAB podem receber versões Express novas mediante migrações controladas.

**Fluxo do respondente (ideal: três etapas sem rolagem excessiva):**

```text
Abrir formulário → Identificação/vínculo e intenção
→ Tela única de dores sociais → Rotina, trajeto e horários
→ Contato e consentimento → Salvar resposta e participação no CRM
→ Confirmação / tela de pré-lançamento, se aplicável
```

**Tela de dores — obrigatória nos três modelos:**

- Pergunta única: **“O que mais dificulta seu deslocamento?”**
- Respostas multi-seleção: **ônibus lotados; preço alto do transporte; tempo de espera prolongado; atrasos frequentes; insegurança no trajeto; falta de transporte disponível; desconforto nas viagens; horários incompatíveis; outra dificuldade; nenhuma dessas dificuldades**.
- Selecionar **até três** dores; caso selecione duas ou três, indicar **qual é a principal na mesma tela**.
- A opção **“nenhuma dessas dificuldades”** é exclusiva e mantém a pesquisa honesta; a opção **“outra”** apresenta campo livre curto.
- **Não duplicar** a pergunta de dificuldades noutra etapa. Separar dores reais de preferências de viagem.
- Permitir respostas condicionais por papel: passageiro não responde perguntas irrelevantes sobre veículo.
- **Exceção aprovada para o acadêmico Express V2 (27/10/2026):** quem escolhe exclusivamente **MOTORISTA** não responde às dores de transporte coletivo nem à dor principal; após selecionar veículo e vagas, segue diretamente para ativação. **PASSAGEIRO** e **AMBOS** continuam respondendo às dores sociais. Esta exceção não altera versões históricas: mudanças de condições precisam de uma nova versão publicada e de validação equivalente no banco.
- **Capacidade declarada:** em **MOTO**, fixar uma única vaga de passageiro sem permitir edição. Em **CARRO**, oferecer chips de 1–4 vagas e entrada manual de 1–4; não criar reservas automaticamente.

**Criação de formulário no admin (fluxo-padrão mobile-first):** ao tocar em **+ Novo formulário**, exibir primeiro três cartões grandes, selecionáveis e legíveis no celular: **Universidade**, **Rua/comunidade** e **Empresa**. Este é o padrão para todos os novos formulários F01; não enviar o administrador diretamente ao construtor técnico extenso. Após escolher o modelo, pedir somente **nome da instituição/comunidade, região, título e datas de início/fim**; **campus** somente na universidade. Gerar sugestão de **código exclusivo** automaticamente (editável em opções avançadas) e disponibilizar **lançamento** opcional. Criar somente **rascunho**; revisão, identidade visual e publicação continuam ações explícitas. Preservar estados de publicação e histórico. A identidade da participação/selo usa a **chave estável do formulário**, não um título editável.

**Construção avançada:** manter os modelos históricos e o editor completo em ação secundária claramente identificada, sem reescrever nem converter formulários publicados. Personalizações do F01 padrão devem manter as **três etapas** e a seção de dores com seleção, dor principal e campo Outra. A experiência acadêmica expressa F01 V2 é uma alternativa separada com cinco etapas, conservando as mesmas dores obrigatórias.

**Preenchimento mobile-first:** largura adequada a 320–430 px, campos com alvo de toque confortável, grade de escolhas responsiva, navegação fixa com área segura, texto curto e validação junto ao campo. Etapa 1: identidade/vínculo; etapa 2: **todas as dores e a principal na mesma tela**; etapa 3: interesse, trajeto habitual em bairros/localidades, dias, horário, e-mail e consentimentos. Não perguntar frequência se os dias já forem coletados. Rolar apenas quando o conteúdo real não couber; nunca esconder opções para evitar scroll.

**CRM:** capturar respostas, dor principal, demais dores, região, origem/destino aproximados, horários, intenção (pedir/oferecer), contexto institucional, consentimento e origem do lead; associar múltiplas participações a **um contato**, sem fundir formulários. O **CRM unificado** deve combinar pesquisas de qualquer código de `research_forms` com respostas STS históricas (`form_submissions`) e Pitch (`pitch_contacts`), preservar cada participação e consentimento, oferecer filtros combinados e status administrativos persistentes. Identidade de contato só é consolidada com chave de contato efetivamente informada; participações anônimas permanecem separadas. Dados pessoais, estado do relacionamento e respostas completas devem ficar disponíveis apenas a administradores autorizados. O badge verde de domínio institucional reconhecido é um indicador de formato/configuração, **não** comprova matrícula, identidade, verificação ou direito a liberar antecipadamente a plataforma. Nenhuma pesquisa cria reserva, viagem, pagamento ou oferta automaticamente; interesse no pré-lançamento exige consentimento separado. Usuário participante de duas pesquisas ainda em pré-lançamento deve visualizar **as duas contagens regressivas** separadamente.

**Ficha executiva no CRM (27/10/2026):** o contato é identificado por nome real ou, quando ausente, por e-mail/WhatsApp já autorizado; as participações ficam separadas por pesquisa e data, com quatro níveis de leitura: Contato e status; Rotina de deslocamento; Interesse e disposição a pagar; Dores e barreiras. Campos desconhecidos aparecem em Outras respostas, sem valores inventados, e UUIDs/JSON/identificadores técnicos permanecem em auditoria colapsada por padrão. Rótulos e enums são traduzidos apenas na interface por dicionário compartilhado, mantendo os valores originais, permissões, estados e consentimentos do CRM. **Não regravar versões de formulários ou respostas históricas** para melhorar a apresentação.

**Revisão mobile da ficha F09:** no celular, a ficha ocupa a tela inteira com cabeçalho fixo, botão explícito para voltar e conteúdo rolável; no desktop, mantém diálogo dimensionado. As participações são mostradas em resumos compactos (origem, data, perfil, trajeto/dor quando informados), com apenas uma expandida por vez. O resumo não representa uma rota operacional confirmada. Códigos internos de formulário não aparecem no resumo e UUIDs/JSON ficam em auditoria recolhida. A migration `0123_crm_semantic_answer_details.sql` amplia exclusivamente a RPC **admin** existente, acrescentando metadados `semanticCode`, rótulo e resposta da versão publicada; não modifica respostas históricas. A interface deve aceitar o payload antigo quando 0123 não estiver aplicado, mantendo demais campos em **Outras respostas**. Executar 0123 depois de 0120 e 0122, sem conceder acesso público aos dados.

**WhatsApp acadêmico (27/10/2026):** a confirmação final dos formulários Academic Express exige celular brasileiro com DDD e máscara `(DD) 9XXXX-XXXX`, para PASSAGEIRO, MOTORISTA e AMBOS. A informação é persistida em uma tabela privada com autorização de vínculo, integrando o CRM; mensagens comerciais exigem consentimento opcional distinto. A migration `0122_academic_whatsapp_crm.sql` deve ser aplicada antes da implantação da interface. Formulários e respostas históricas não são reescritos.

**Localização no celular (F01):** todos os formulários que coletam origem (universidades, rua/comunidade, empresas e pesquisas configuradas sem origem fixa de evento) oferecem **Usar localização atual** e **Buscar localização** antes do campo de origem, inclusive em telas de 320px. O GPS só é solicitado após toque e permissão; em caso de recusa, timeout ou ausência de HTTPS, o usuário pode buscar ou digitar o bairro normalmente. Buscas oferecem sugestões de locais e entrada manual. Respostas armazenam apenas região aproximada, sem coordenadas precisas. Nos formulários acadêmicos de cinco etapas, o conteúdo volta ao topo ao mudar de etapa para tornar os botões visíveis.

**Indicadores:** ranking de dores por região/instituição/perfil, demanda por horários e trajetos, interesse na solução e, posteriormente, métricas reais de impacto. **Respostas de pesquisa validam a existência de problemas percebidos; o impacto do CARONAA precisa ser medido posteriormente com dados observados.**

**Aceite F01:** três modelos respondíveis; seleção e dor principal persistidas; CRM organizado; sem duplicidade indevida; branch por perfil correto; selos e contagens independentes; testes de validação/permissões e UX mobile.

### F02 — Cadastro, conta única e perfis

```text
Criar conta → Nome, contato, região e foto (progressivamente)
→ Acesso como passageiro → (opcional) ativar Oferecer
→ Informar veículo e modalidade → Usar recursos do papel autorizado
```

- **Passageiro:** nome, região, foto, contato/login e avaliação baseada em viagens realizadas.
- **Motorista de carro / mototaxista:** nome, região, foto, tipo de veículo, **modelo e placa em texto**, avaliações; demais informações do condutor **declaratórias e textuais** neste MVP.
- **CPF não é campo deste MVP**; **sem validação documental rígida** como condição técnica geral de cadastro.
- Uma pessoa pode ser passageira e condutora. Dados já fornecidos não são pedidos a cada oferta.
- Profissionais e modalidades só ficam **efetivamente disponíveis ao público** após a decisão de habilitação da operação regional e análise de conformidade aplicável. Não confundir essa condição operacional com implementar agora uma checagem documental automatizada.

**Exceção aprovada — cadastro simplificado de mototaxista (11/11/2026):** em uma única conta, o mototaxista pode criar acesso por e-mail e senha confirmada, informar primeiro nome, último sobrenome, WhatsApp com DDD, região (Maciço de Baturité ou Fortaleza), matrícula profissional declaratória e foto pessoal. Não solicitar CPF, universidade, veículo, placa ou modelo nesse fluxo exclusivo. O cadastro exige confirmação de e-mail; a solicitação é imediata após completar os dados e a foto. A fila administrativa existente decide APROVAR, PEDIR CORREÇÃO ou REJEITAR; nenhuma escolha ou matrícula autodeclarada concede aprovação automática. O gate de campanhas acadêmicas não impede a solicitação/consulta da disponibilidade profissional, mas viagens pagas e descoberta no radar continuam condicionadas à autorização administrativa, regras de débitos, política regional e consentimento explícito de GPS. O município real de atuação é informado posteriormente na disponibilidade, não durante o cadastro simplificado. Contas de teste `motorista01` e `motorista02` seguem a mesma aprovação manual, sem whitelist por nome.

**Exceção aprovada — motoristas sem formulário obrigatório (12/11/2026):** após concluir o onboarding básico com o perfil exclusivamente `MOTORISTA`, o usuário pode entrar no aplicativo **sem preencher pesquisas F01**; participação em pesquisas passa a ser opcional para motoristas. Profissionais com **aprovação administrativa efetiva no banco** também não ficam bloqueados pelo formulário, inclusive quando iniciaram o cadastro como passageiro. `PASSAGEIRO` e `AMBOS` sem autorização profissional preservam a exigência atual de pesquisa; solicitações profissionais pendentes não contam como autorização. O bloqueio específico de campanhas já vinculadas e ainda em pré-lançamento permanece independente dessa dispensa. Essa exceção **não** aprova motoristas, não ignora regras regionais ou financeiras e não permite compartilhar GPS sem consentimento. Dados históricos de pesquisas e CRM permanecem intactos.

**Aceite F02:** conta única, passagem de passageiro para condutor sem segundo cadastro, atualização de veículo, persistência e controle adequado de acesso.

### F03 — Oferecer carona pontual e cálculo do valor compartilhado

```text
Oferecer → Origem/destino → Data, hora e vagas
→ Mapa com rota rodoviária e preço estimado → Confirmar publicação
→ Receber solicitações → Aceitar passageiros
```

**Regra-base de preço da carona compartilhada:**

```text
Tarifa do trecho (R$) = distância rodoviária do trecho (km) × 6 / 11
Referência: 11 km = R$ 6,00
```

- Calcular por **trecho efetivamente contratado por cada passageiro**, e não necessariamente pela distância total do condutor.
- Usar distância **pela malha viária**, não linha reta. Arredondar somente no resultado monetário, em centavos.
- Exemplos: **5,5 km = R$ 3,00; 11 km = R$ 6,00; 22 km = R$ 12,00**; trecho de 5 km ≈ **R$ 2,73**.
- Mostrar valor antes da confirmação. Não impor tarifa mínima, valor dinâmico ou extras não especificados.
- Exibir veículo previamente salvo, capacidade/vagas e pontos de embarque; não repetir dados do perfil.

**Política de trajeto (F03/F05):** ofertas pontuais novas registram a escolha explícita entre
**Aceitar pequenos desvios** e **Rota Estrita (Ponto de encontro)**. Em rota estrita,
o encontro sugerido permanece sobre o corredor viário do condutor. Estabelecimentos
próximos são referências, não certificados de segurança; quando não houver referência,
mostrar o ponto projetado na rota com confirmação das condições de acesso e parada.
A sugestão não altera automaticamente o embarque combinado, reservas ou tarifas.
A publicação dessa política exige a migration 0136. Ofertas históricas e rotinas
mantêm seu comportamento anterior, sem conversão silenciosa.

**Oferta pontual (07/11/2026):** carro com 1–4 vagas; moto com uma vaga e aviso de capacete extra.
A escolha de veículo e a restrição opcional para passageiras são salvas antes da alocação.
Manter revisão explícita antes de Publicar Viagem, inversão de trajeto, saída imediata e agendamento.
Ofertas anteriores mantêm os dados existentes; novas ofertas usam os limites aprovados.

**Aceite F03:** tarifa de 11 km exata, subtrechos corretos, arredondamento, mapa, limites de vagas e publicação persistida.

### F04 — Caronas recorrentes, publicação autorizada e alertas

```text
Publicar oferta → Sugerir rotina quando houver intenção/padrão de uso
→ Motorista escolhe dias e horário → Autoriza publicação automática
→ Sistema cria ocorrências futuras → Identifica interessados compatíveis
→ Envia alertas consentidos → Passageiros solicitam vagas
```

- Repetir por **dias da semana**, horário e período; permitir pausa, edição e cancelamento de **uma ocorrência** sem apagar toda a rotina.
- Reconhecer padrões a partir de ofertas fornecidas pelo próprio usuário; **não rastrear viagens privadas para inferir rotinas sem permissão**.
- Configurar antecedência de publicação, limite de vagas por ocorrência e prevenção de duplicatas.
- Notificar passageiros com mesmo destino ou **subtrechos compatíveis**, considerando proximidade e hora de embarque.
- Notificações dependem de preferências/consentimento e precisam evitar spam, incluindo opções de silêncio.
- Publicação recorrente **nunca habilitada por padrão**.

**Aceite F04:** programar dias úteis, omitir uma quarta-feira, pausar rotina, verificar vagas e notificações corretas sem duplicidade.

### F05 — Pedir carona e matching por rota/subtrechos

```text
Origem + destino + quando viajar → Consultar caronas
→ Comparar trajetos viários, sentido, horários e vagas
→ Classificar melhores opções → Mostrar preço e embarque
→ Solicitar/confirmar vaga → Acompanhar viagem
```

- Comparar posições e progresso **ao longo da rota**, sem exigir origem/destino exatamente iguais.
- Permitir embarque e desembarque intermediários, respeitando a **ordem do trajeto**.
- Avaliar janela de horário no ponto do passageiro, caminhada aceitável, desvio e ETA.
- Controlar lotação por **segmentos do percurso** e proteger a última vaga contra concorrência.
- Classificar sugestões: **compatível, aproximada, indisponível**. Nunca mostrar match incompatível como confirmação garantida.
- Priorizar viagens com menor inconveniência, horário confiável e preço transparente.

**Aceite F05:** A→E atende passageiros A→C e B→D quando viáveis; rejeita sentido oposto e horário incompatível; não vende mais vagas que a capacidade.

### F06 — Desvios inteligentes e oportunidades de rota

```text
Oferta publicada → Encontrar demanda próxima → Agrupar interessados
→ Calcular alternativas em vias reais → Estimar km e minutos adicionais
→ Comparar receita incremental e custo do desvio
→ Oferecer sugestão clara ao motorista → Aceitar/rejeitar
→ Se aceita, reconfirmar passageiros impactados e atualizar oferta
```

- A plataforma identifica pontos próximos à rota com demanda suficiente e **sugere** trajetos alternativos potencialmente úteis.
- A comparação considera **passageiros adicionais, tempo, distância extra, combustível/custo estimado, preço dos subtrechos, disponibilidade de vagas e impacto nas reservas atuais**.
- Não confundir **receita bruta adicional** com vantagem econômica. Em carona compartilhada, respeitar a finalidade de compartilhamento de custos e verificar aderência regulatória.
- O motorista define/desativa a tolerância a desvios; **o sistema nunca altera unilateralmente uma viagem confirmada**.
- Não revelar localização precisa de potenciais passageiros a motoristas não autorizados antes da etapa adequada de confirmação.
- Limitar alertas a oportunidades relevantes e explicar o benefício e o custo de cada opção.

**Aceite F06:** demanda simulada próxima gera alternativas calculadas, com diferenças explícitas; rejeição preserva rota; aceite respeita tempo, vagas e reservas existentes.

### F07 — Encontrar viagem imediata (carro e mototáxi)

```text
Passageiro → Viajar agora → Origem/destino → Carro ou moto elegível
→ Exibir estimativa de preço → Solicitar
→ Buscar profissionais online com base em ETA e elegibilidade operacional
→ Profissional aceita → Acompanhar chegada
→ Viagem → Encerramento, pagamento e avaliação
```

- O serviço profissional é **distinto** da carona compartilhada: destino é definido pela demanda do passageiro.
- Condutor controla **Ficar online/offline** e aceita ou recusa solicitações.
- Mostrar identidade/veículo, localização permitida, ETA, preço e cancelamento claros.
- Evitar estado de busca infinito: limites, timeouts, ausência de profissionais e recuperação de erro.
- **Radar piloto autorizado no eixo Fortaleza–Maciço (decisão de 11/11/2026):** habilitar a descoberta aproximada de motoristas profissionais aprovados em **Fortaleza, Maracanaú, Pacatuba, Guaiúba, Acarape, Redenção, Aracoiaba e Baturité**. A região de cadastro não restringe a publicação: vale o município atual determinado pelo GPS, confirmado pelo Google no servidor, com consentimento do usuário e `professional_service_regions.public_discovery_enabled` ativo. Se sair da área habilitada, interromper a publicação precisa e continuar monitorando a entrada numa zona permitida enquanto houver consentimento, sem criar localização fictícia. Motorista offline, sem aprovação, com pendências impeditivas ou GPS desatualizado permanece invisível. Descoberta de radar **não** equivale à liberação comercial: tarifas, carro/moto, despacho, viagens intermunicipais e conformidade operacional exigem liberações independentes.
- **Homologação F07 — decisão de 12/11/2026 (ambiente isolado):** disponibilizar Carro e Moto, viagens municipais/intermunicipais e radar nos **17 municípios** do catálogo Fortaleza–Maciço usando as quatro políticas aprovadas `macico-moto-piloto` (R$ 7,50/11 km, 20%), `macico-car-piloto` (base R$ 5,00 + R$ 2,00/km + R$ 0,30/min; mínimo R$ 10,00, 20%), `fortaleza-moto-piloto` (base R$ 3,50 + R$ 1,20/km + R$ 0,20/min; mínimo R$ 6,00, 15%) e `fortaleza-car-piloto` (base R$ 5,50 + R$ 2,20/km + R$ 0,35/min; mínimo R$ 12,00, 15%). Margens mínimas respectivas: R$ 0,50/R$ 1,00/R$ 0,50/R$ 1,00. A operação usa Google Routes, valida município de origem e de destino e grava o destino no snapshot imutável. **A aprovação automática ao clicar Ficar disponível é uma exceção temporária exclusiva do banco e servidor de homologação**, auditada e reversível; o fluxo administrativo e o GPS opt-in de produção permanecem obrigatórios. QR Pix estático aparece somente após concluir uma Corrida Rápida com preço imutável e chave real cadastrada, mas **não é pagamento automático nem confirmação de recebimento**. **Não publicar essas tarifas e flags no banco público.** Ver `docs/f07-homologacao-17-cidades-e2e.md`.
- **Preço das viagens profissionais é independente da tarifa de R$ 6/11 km**; exige especificação comercial antes de cobrança.
- **Informações/documentação textual sem validação rígida automatizada neste MVP**. Antes do serviço real, definir processos proporcionais de segurança, requisitos municipais, seguro/habilitação e regras de transporte profissional aplicáveis. Não declarar essas exigências como concluídas.

**Aceite F07:** simular disponibilidade, pedido, despacho, aceite, corrida, estados, cancelamento e ausência de profissional; validar conformidade antes de habilitar operação real.

### F08 — Acompanhar viagem, notificações, pagamentos e avaliação

```text
Reserva confirmada → Aviso e dados do embarque → Condutor a caminho
→ Embarque → Rastreamento durante viagem → Desembarque
→ Pagamento/liquidação conforme modalidade → Avaliação → Histórico
```

- Mapa acompanha posição/ETA com permissões explícitas; preservar privacidade e encerrar compartilhamento quando a viagem terminar.
- Estados sincronizados e consistentes entre condutor/passageiro; permitir suporte, cancelamento e tratamento de falhas de conexão.
- Notificações: nova oportunidade, vaga solicitada/confirmada, alteração de rota, chegada, início e conclusão.
- Avaliações apenas de viagens concluídas, sem notas inventadas.
- **Modelo financeiro acordado para viagens comerciais elegíveis:** plataforma busca **15% líquidos**, motorista **85%**, e passageiro paga a tarifa de processamento separadamente (**Modelo B**). Validar a implementação real do split, webhooks, estornos e regras por modalidade antes de afirmar a liquidação.
- Não transpor automaticamente o modelo financeiro profissional para a carona compartilhada sem decisão de negócio e avaliação de conformidade.

**Aceite F08:** testar eventos de ponta a ponta, notificações sem duplicações, mapa, cancelamento, repasses e avaliações consistentes.

### F09 — CRM, BI e mensuração de impacto social

```text
Formulários + perfis + ofertas + solicitações + viagens concluídas
→ Identidade e permissões → CRM/BI por instituição e região
→ Dores, demanda, oferta, conversão e impacto observado
→ Decisões de produto/expansão
```

- **Uma identidade, múltiplas participações** em formulários distintos.
- Segmentos: universidade, rua, empresa, região, intenção passageiro/condutor, dor principal, horário e demanda.
- Métricas: distribuição das dores, trechos procurados, oferta recorrente, taxa de match, conversão pesquisa→viagem, espera, economia estimada e utilização real.
- Separar **resposta declarada**, **estimativa** e **resultado verificado**. Agregações devem minimizar exposição de dados pessoais/rotas individuais.
- Nunca alimentar dashboards reais com dados mockados ou métricas inventadas.

**Aceite F09:** participantes de dois formulários aparecem corretamente, BI agrega sem contar a pessoa duas vezes como contato e indicadores distinguem estimativas de resultados reais.

**Ponte BI → CRM:** análises de pesquisa oferecem acesso ao CRM com recorte compartilhável por instituição, perfil e dor. No CRM os filtros de origem, destino, horário e orçamento pertencem à **mesma participação**, evitando juntar a origem de uma resposta com o destino de outra. A quantidade de respostas elegíveis do BI não deve ser apresentada como número de contatos acionáveis; nenhuma autorização de comunicação é inferida. A tela de respostas legadas da STS permanece disponível separadamente, e a operação de contatos fica centralizada em `/admin/relacionamentos`.


## 5. Princípios técnicos e integração com o projeto existente

- **Não reescrever tudo do zero.** Inspecionar e reaproveitar serviços, componentes, migrations, testes e permissões já existentes.
- Referências a examinar antes de mexer em fluxos: `src/lib/ride-cost.ts` (tarifa), `src/lib/ride-matching.ts` (matching), `src/lib/ride-routines.ts` (recorrências), `src/lib/ride-opportunities.functions.ts` (oportunidades), `src/routes/_authenticated/oferecer.tsx`, `src/routes/_authenticated/home.tsx` e `src/components/research/` (formulários).
- Manter integrações reais existentes (autenticação, banco, CRM, mapas, pagamentos, Lovable). Não mudar contratos, migrations ou regras de acesso sem analisar consumidores e consequências.
- Banco: privilégios por perfil, RLS/autorizações no servidor, idempotência, concorrência de reserva de vaga e proteção de dados sensíveis.
- Formulários publicados e pesquisas antigas exigem compatibilidade, migrações planejadas e testes; não apagar respostas para simplificar UI.
- Sem validação documental rígida **não significa** dispensar autenticação, validação básica dos campos, segurança da aplicação, políticas de privacidade ou adequação legal.
- Mudanças grandes devem ser modulares, testáveis, com rollback quando envolverem dados/infraestrutura. Não realizar migrations destrutivas sem plano e autorização.

## 6. Definition of Done por fluxo

Antes de declarar qualquer F01–F09 como concluído:

- [ ] Leu **README.md e AGENTS.md** e identificou o fluxo/versão envolvidos.
- [ ] Auditou a implementação real, distinguindo **existe / parcial / ausente**.
- [ ] Definiu alterações mínimas, dependências, riscos e o que será preservado.
- [ ] Implementou frontend mobile-first, backend/persistência e permissões necessários.
- [ ] Cobriu estados loading, vazio, erro, offline/cancelamento quando aplicáveis.
- [ ] Executou testes unitários, integração e testes orientados a fluxo, ou relatou o que não foi possível testar.
- [ ] Verificou que não reapareceram **CPF**, **validação documental rígida**, mocks disfarçados de reais ou telas duplicadas.
- [ ] Documentou resultado, testes executados, arquivos alterados e pendências, **sem declarar sucesso não comprovado**.
- [ ] Atualizou o README e o AGENTS.md **quando houver decisão aprovada que altere o contrato de produto**.

**Roteiro obrigatório de resposta de agentes ao trabalhar num módulo:**

```text
1. Módulo: F0X — objetivo e regras do README aplicadas
2. Situação atual: implementado / parcial / ausente (com arquivos examinados)
3. Alterações feitas: arquivos, migrações, contratos e UX
4. Testes: comandos, cenários e resultados verificáveis
5. Pendências/riscos: o que ainda NÃO está pronto
6. Documentação: conflito com README? houve atualização autorizada?
```

## 7. Ordem recomendada

| Etapa | Módulo | Principal teste |
| --- | --- | --- |
| 1 | **F01** Formulários e dores sociais | Tela única de dores, CRM e participações |
| 2 | **F02** Cadastro e perfis | Conta única, sem CPF, sem validação documental rígida |
| 3 | **F03** Oferta e preço compartilhado | 11 km = R$ 6,00; tarifa por subtrecho |
| 4 | **F04** Carona recorrente | Dias, exceções, permissão e notificações |
| 5 | **F05** Matching por rota | Subtrechos, sentido, ETA e vagas |
| 6 | **F06** Desvios inteligentes | Oportunidades, custo/benefício e consentimento |
| 7 | **F07** Transporte profissional | Online, solicitação, despacho e segurança |
| 8 | **F08** Viagem/pagamento/avaliação | GPS, estados, cobrança e pós-viagem |
| 9 | **F09** CRM e BI | Impacto, conversão, privacidade e segmentação |

A ordem é orientação de organização; corrigir previamente um bloqueio de segurança ou uma dependência técnica é permitido, desde que relatado.

## 8. Desenvolvimento, Lovable e governança das alterações

Projeto: [Nicolauzeus/caronaa](https://github.com/Nicolauzeus/caronaa). Editor [Lovable](https://lovable.dev/projects/a55d36f2-9ca3-417b-b6b0-2f968a65d3a2).

**Para todo agente — ChatGPT, Codex, Lovable ou colaborador:**

1. **Ler este README antes de propor ou executar mudanças.** Depois, ler `AGENTS.md` e verificar o código do módulo.
2. Identificar qual fluxo **F01–F09** será afetado e confrontar a implementação com as regras.
3. Quando houver conflito com este documento, **não substituir silenciosamente a regra**: solicitar decisão do responsável pelo produto.
4. Não criar funcionalidades fora do escopo, não reintroduzir CPF/checagem documental rígida e não alterar a tarifa da carona por iniciativa própria.
5. Preferir mudanças pequenas com testes objetivos e preservar dados reais e compatibilidade.
6. Atualizar a documentação após decisões de produto aprovadas. O README é a **fonte de verdade de intenção funcional**, e o código/testes são a fonte de verdade do **estado realmente implementado**.

A integração Lovable–GitHub requer preservar histórico compartilhado; **não usar force-push, rebase de commits já publicados ou operações que apaguem histórico**.

### Comandos locais

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

> **Regra final:** **CARONAA simples na interface, inteligente na operação, mensurável no impacto.** Nenhum desenvolvimento novo deve contrariar estes fluxos sem autorização de uma revisão do produto.


