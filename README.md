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

**Cadastro e acesso sem bloqueio geográfico (decisão de 16/11/2026):** pessoas dentro e fora do Ceará podem criar conta e entrar no aplicativo. Cadastro por e-mail, login com Google e retorno de autenticação não exigem GPS nem confirmação de estado. A opção **Outra região** permanece disponível no onboarding. Autenticação, confirmação de e-mail, conclusão do perfil e regras de campanhas vinculadas continuam seguindo seus fluxos existentes; a cobertura e a autorização operacional da Flash/F07 são verificadas separadamente para cada serviço.

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

### Destaque pontual de destino — estreia Kaluanda Night (20/11/2026)

Em 20/11/2026, a festa **Kaluanda Night (PUB vibe)** ocorre no endereço informado pelos organizadores: **Rua Edmilson Medeiros, 23, Redenção — CE**. Apresentar um único atalho discreto em campos de **destino** nos fluxos de mobilidade de passageiros e motoristas, sem banners, pop-ups, etapas extras, anúncios, alteração da gaveta ou interferência no mapa. Não destacar no campo **origem**, nem em formulários de pesquisa e rotinas recorrentes.

A recomendação é visível para qualquer usuário em 20/11/2026 (fuso America/Fortaleza) e, para viagens de saída após a festa, até 06:00 de 21/11/2026; então desaparece automaticamente. Nunca cobrar uma busca Google para apenas exibir o card. Somente após toque explícito no destaque, buscar o endereço no Google Places do servidor; não usar coordenadas inventadas nem centroide de rua. Se o número 23, a rua, Redenção ou CE não forem confirmados, solicitar busca manual, sem selecionar destino nem disparar precificação. O uso do destaque não altera o orçamento, os filtros territoriais de cobertura, o GPS, as tarifas, a modalidade ou a seleção livre de outros destinos.

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

**Cadastro profissional unificado com a conta universal (17/11/2026):** a rota `/auth` é a **única** criação de conta, login e recuperação de senha para passageiros e motoristas, inclusive mototaxistas. O usuário pode indicar `MOTORISTA` no cadastro universal, que persiste essa intenção via onboarding, **sem conceder autorização profissional**. A antiga rota `/cadastro-motorista` não deve mais pedir e-mail/senha nem chamar `auth.signUp`: após conta universal confirmada e onboarding básico concluído, ela apresenta **somente os dados profissionais ainda necessários** (WhatsApp, região de atuação declarada, matrícula e foto), status da solicitação e acesso ao cockpit quando autorizado. Primeiro e último nome vêm pré-preenchidos da conta universal e permanecem editáveis no complemento; o e-mail não precisa ser digitado outra vez. Um deep link para o complemento pode passar por `/auth` e `/onboarding` sem duplicar contas ou contornar bloqueios de campanha. As decisões administrativas, proteção da foto, RLS, F07 e consentimento de GPS permanecem inalterados.

**Confirmação de dados antes das corridas (18/11/2026):** a tela de complemento de mototaxista não exibe a identificação “Conta universal” nem apresenta a aprovação como ação do usuário. O botão é **“Confirmar dados e ver corridas”**. A interface verifica primeiro nome, último sobrenome, WhatsApp com DDD, região explicitamente selecionada, matrícula declaratória e foto pessoal válida, lista os campos incompletos com orientações e foco no primeiro campo, e só avança após a persistência e verificação de sucesso via `submit_simple_mototaxi_access` e `get_my_professional_access`. A confirmação registra/atualiza o histórico de habilitação **no servidor** e cria a autorização automaticamente quando todos os dados exigidos foram validados. O destino é `/disponibilidade-profissional`, a tela de corridas/cockpit que pode ser consultada por candidatos, mas que deve mostrar os dados pendentes e bloquear o recebimento/despacho de corridas até autorização automática confirmada, condição financeira, cobertura e consentimento de GPS conforme as regras existentes. Não exigir um segundo formulário de autorização para quem já tem solicitação simplificada de mototaxista; correções são feitas na mesma tela de dados profissionais. Não criar novas migrations nem concessões automáticas.

**Decisão de produto — habilitação automática de motorista com cadastro completo (18/11/2026):** os condutores profissionais de carro e mototáxi deixam de precisar de uma solicitação para análise manual. Quando a conta universal está confirmada e os dados profissionais obrigatórios estão completos, o servidor valida novamente o perfil, o veículo e/ou a matrícula declaratória, registra o resultado auditável e **habilita imediatamente o usuário na plataforma** em transação atômica. No cadastro simplificado de mototaxi, bastam primeiro nome, sobrenome, WhatsApp, região declarada, matrícula e foto própria salva; não exigir CPF, universidade, placa/modelo ou upload de documento nesse fluxo. Para profissionais de carro e cadastro padrão de moto, continuam obrigatórios os dados de veículo requeridos pela modalidade e validados no servidor. Uma conta anteriormente rejeitada, com pedido de correção ou autorização revogada permanece bloqueada para reavaliação pelo suporte; pilotos temporários de homologação não são convertidos em aprovação permanente. Cadastros pendentes e completos são elegíveis à atualização única na migration, sem reenviar solicitação. **A habilitação na plataforma não equivale a verificação de habilitação legal ou licença**, e a operação de corridas continua dependendo de áreas efetivamente habilitadas, políticas tarifárias e financeiras, consentimento GPS e checagens do banco no despacho. Esta decisão **substitui exclusivamente as referências históricas a aprovação administrativa obrigatória** dos fluxos de ingresso profissional nas seções F02/F07, sem remover auditoria, bloqueios, autorização no banco ou mecanismos de suspensão. Implementação: `0204_f02_f07_auto_enable_completed_professionals.sql`.



**Decisão de 19/11/2026 — cadastro profissional único com progresso e ativação imediata:** a conta universal permanece única. O novo motorista conclui em `/cadastro-motorista` quatro etapas (Contato e município → Dados do veículo → Identificação → Revisão). Nome, município selecionado, foto, tipo, marca, modelo, cor, placa e vagas válidas continuam requisitos operacionais; categoria é solicitada apenas para carro e matrícula declaratória apenas para moto. A habilitação permanece transacional e autorizada pelo servidor, preservando auditoria, bloqueios administrativos, município, GPS, segurança, tarifas e consentimentos. A migration 0216 continua sendo pré-requisito e o WhatsApp exigido originalmente por ela passa a ser **opcional** mediante 0218, que deve ser aplicada posteriormente. Nenhum telefone é prova de conta ativa no WhatsApp. O motorista conclui offline e opta por disponibilizar GPS ao ficar online. CPF e uploads documentais rígidos continuam fora do MVP.

**Exceção aprovada — motoristas sem formulário obrigatório (12/11/2026):** após concluir o onboarding básico com o perfil exclusivamente `MOTORISTA`, o usuário pode entrar no aplicativo **sem preencher pesquisas F01**; participação em pesquisas passa a ser opcional para motoristas. Profissionais com **aprovação administrativa efetiva no banco** também não ficam bloqueados pelo formulário, inclusive quando iniciaram o cadastro como passageiro. `PASSAGEIRO` e `AMBOS` sem autorização profissional preservam a exigência atual de pesquisa; solicitações profissionais pendentes não contam como autorização, mas direcionam ao acompanhamento em `/disponibilidade-profissional`, sem exigir pesquisas nem conceder antecipadamente acesso ao radar. O bloqueio específico de campanhas já vinculadas e ainda em pré-lançamento permanece independente dessa dispensa. Essa exceção **não** aprova motoristas, não ignora regras regionais ou financeiras e não permite compartilhar GPS sem consentimento. Dados históricos de pesquisas e CRM permanecem intactos.

**Nova decisão de 19/11/2026 — WhatsApp editável, opcional e independente da operação:** todo usuário autenticado (motorista ou passageiro) pode adicionar, editar ou remover seu WhatsApp em Perfil → Dados pessoais / Dados do condutor, sem novo cadastro. O número é validado por DDD brasileiro e formato de celular, aceita `+55` e também DDD 55; nunca é usado para confirmar a existência de uma conta no WhatsApp. Não exigir número para criar ou aceitar corridas, concluir cadastro profissional, definir GPS ou gerar Pix. Consentimento para contato comercial é separado, explícito, revogável e **não decorre** do cadastro; dados privados só podem ser lidos/escritos pela própria conta ou serviço autorizado. `0218_f02_f07_optional_editable_whatsapp.sql` deve ser aplicada manualmente **depois de 0211/0216 e antes da publicação da UI**. Não alterar automaticamente a exigência de contato em formulários acadêmicos F01 versionados, que têm regras de pesquisa distintas. Números históricos/antigos podem continuar nos snapshots de auditoria, mas o contato operacional atual vem da função autenticada de perfil.

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

**Decisão aprovada em 20/11/2026 — município e macro-região declarados são opcionais para motoristas (substitui a obrigatoriedade prevista em 11, 17 e 18/11):** nenhum motorista de carro ou moto precisa selecionar região ou município residencial/de preferência para concluir o cadastro nem para obter a habilitação automática emitida pelo servidor. Preferências anteriormente salvas são preservadas e não limitam a operação. O município operacional é verificado a partir do GPS consentido ao entrar online, com cobertura habilitada no servidor; receber/aceitar pedidos segue raio de 15 km da origem, tipo de veículo, posição válida e demais filtros operacionais. Não criar GPS fictício, não remover suspensões/negativas, checagens de veículo/foto/e-mail e regras financeiras. A migration incremental `0220_f02_f07_optional_home_region.sql` deve estar aplicada antes de publicar o frontend correspondente. Não converter corridas pendentes em concluídas como parte dessa mudança.

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
- **Pedido F07 sem motorista online (22/11/2026):** a quantidade momentânea de motoristas no radar é informativa, não é pré-requisito para solicitar. Com origem/destino válidos, cotação profissional vigente e cobertura/despacho permitidos no servidor, a pessoa pode escolher Flash Carro ou Moto e confirmar uma única solicitação mesmo com zero profissionais online ou radar indisponível. O pedido permanece `SEARCHING` por até 30 minutos conforme a migration `0228`, com contagem regressiva e cancelamento acessível. Motoristas que entrarem depois podem visualizar a solicitação ainda ativa, respeitando raio operacional de 15 km, tipo de veículo, GPS, autorização e regras financeiras. Expiração encerra a busca sem cobrar, sem simular aceite e sem permitir solicitações duplicadas. Não confundir ausência de motorista com município/modalidade sem autorização ou tarifa indisponível.
- **Radar piloto autorizado no eixo Fortaleza–Maciço (decisão de 11/11/2026):** habilitar a descoberta aproximada de motoristas profissionais aprovados em **Fortaleza, Maracanaú, Pacatuba, Guaiúba, Acarape, Redenção, Aracoiaba e Baturité**. A região de cadastro não restringe a publicação: vale o município atual determinado pelo GPS, confirmado pelo Google no servidor, com consentimento do usuário e `professional_service_regions.public_discovery_enabled` ativo. Se sair da área habilitada, interromper a publicação precisa e continuar monitorando a entrada numa zona permitida enquanto houver consentimento, sem criar localização fictícia. Motorista offline, sem aprovação, com pendências impeditivas ou GPS desatualizado permanece invisível. Descoberta de radar **não** equivale à liberação comercial: tarifas, carro/moto, despacho, viagens intermunicipais e conformidade operacional exigem liberações independentes.
- **Tarifa fixa F07 Acarape/Redenção → Barreira (decisão de 24/11/2026):** novas cotações de Corrida Direta/Flash de **Acarape → Barreira** e **Redenção → Barreira** custam **R$ 30,00** fixos, apenas no sentido informado, nas modalidades já habilitadas e com municípios de origem e destino verificados no servidor. A cotação persistida é o snapshot usado na confirmação. Não ativa cobertura, despacho ou piloto; comissão, pagamentos, elegibilidade e cotações anteriores ficam inalterados. O retorno de Barreira, Acarape ↔ Redenção, os demais trajetos e a carona compartilhada F03 (R$ 6/11 km) mantêm suas regras.
- **Homologação F07 — decisão de 12/11/2026 (ambiente isolado):** disponibilizar Carro e Moto, viagens municipais/intermunicipais e radar nos **17 municípios** do catálogo Fortaleza–Maciço usando as quatro políticas aprovadas `macico-moto-piloto` (R$ 7,50/11 km, 20%), `macico-car-piloto` (base R$ 5,00 + R$ 2,00/km + R$ 0,30/min; mínimo R$ 10,00, 20%), `fortaleza-moto-piloto` (base R$ 3,50 + R$ 1,20/km + R$ 0,20/min; mínimo R$ 6,00, 15%) e `fortaleza-car-piloto` (base R$ 5,50 + R$ 2,20/km + R$ 0,35/min; mínimo R$ 12,00, 15%). Margens mínimas respectivas: R$ 0,50/R$ 1,00/R$ 0,50/R$ 1,00. A operação usa Google Routes, valida município de origem e de destino e grava o destino no snapshot imutável. **A aprovação automática ao clicar Ficar disponível é uma exceção temporária exclusiva do banco e servidor de homologação**, auditada e reversível; o fluxo administrativo e o GPS opt-in de produção permanecem obrigatórios. QR Pix estático aparece somente após concluir uma Corrida Rápida com preço imutável e chave real cadastrada, mas **não é pagamento automático nem confirmação de recebimento**. **Não publicar essas tarifas e flags no banco público.** Ver `docs/f07-homologacao-17-cidades-e2e.md`.
- **Preço das viagens profissionais é independente da tarifa de R$ 6/11 km**; exige especificação comercial antes de cobrança.
- **Informações/documentação textual sem validação rígida automatizada neste MVP**. Antes do serviço real, definir processos proporcionais de segurança, requisitos municipais, seguro/habilitação e regras de transporte profissional aplicáveis. Não declarar essas exigências como concluídas.

**Correção de homologação do radar (12/11/2026):** ao clicar em **Ficar disponível e compartilhar GPS**, o motorista aprovado autoriza explicitamente a presença e o GPS em um único fluxo; não exige segundo botão. A troca/minimização de aba não deve chamar uma exclusão automática de coordenadas: quando o navegador permite atividade em segundo plano, continuar renovando a localização; caso contrário o limite de 90 segundos do servidor evita sinal desatualizado. Mostrar município, coordenadas e hora do último sinal ao próprio motorista. Sem GPS verificável, NÃO registrar coordenadas do centro do município em `professional_driver_locations`. Somente um servidor privado de homologação com controle piloto no banco pode criar um ponto **SIMULADO**, claramente identificado, na tabela isolada `caronaa_f07_simulated_driver_positions`; essa prévia dura até 15 minutos, é visível apenas para o próprio usuário, não entra na descoberta pública, cálculo de ETA nem despacho. A consulta real continua filtrada por tipo **CAR** ou **MOTO** e exclui a própria conta; a visualização diagnóstica é acrescentada separadamente apenas em homologação. Aplicar a migration `0144_f07_radar_diagnostico_proprio.sql` no banco de testes antes de ativar a simulação. Isso não altera tarifas ou autorização administrativa.

**Conciliação de migrations concorrentes (13/11/2026):** o Lovable adicionou `0123_radar_show_self_homologacao.sql`, que removeu a exclusão do próprio usuário da RPC pública sem checagem de homologação. Após `0142` e essa `0123`, aplicar `0145_f07_restaurar_descoberta_publica.sql` para restaurar a exclusão na consulta pública. O próprio motorista é exibido apenas pela função diagnóstica privada criada em `0144`, que nunca altera a oferta real; não aplicar `0144` ou ativar simuladores fora de banco/servidor isolados de homologação.

**Conciliação com a edição Lovable de 13/11/2026:** o arquivo histórico `0123_radar_show_self_homologacao.sql` removeu o filtro do próprio usuário da **RPC pública**. A migration incremental `0145_f07_public_discovery_self_guard.sql` restaura o filtro `l.user_id <> auth.uid()` sem alterar o veículo, o município, o status online ou o TTL. **Aplicar 0145 depois de 0123/0142/0144** no ambiente isolado de homologação; a auto-visualização passa exclusivamente pela função protegida `caronaa_f07_test_self_radar` e jamais pela descoberta pública. A edição antiga do Lovable não substitui a liberação da nova migration.

**Diagnóstico estruturado de publicação GPS F07 (13/11/2026):** a tela de disponibilidade inclui histórico técnico copiável, e o Console identifica eventos com prefixo `[CARONAA][F07][GPS]`. Toda tentativa de publicação recebe uma referência curta, usada também nos logs do servidor; os erros são classificados por etapa (autorização, repasses, presença, rate limit, Google, cobertura e RPC SQL). O servidor registra apenas códigos SQLSTATE, estado booleano de autorização/presença e a existência de configuração de credencial administrativa, sem exibir chaves. Logs e cópia nunca incluem GPS exato, dados pessoais, tokens ou mensagens SQL brutas. A instrumentação não libera motorista ou despacho e não altera o TTL nem a privacidade.

**Aceite F07:** simular disponibilidade, pedido, despacho, aceite, corrida, estados, cancelamento e ausência de profissional; validar conformidade antes de habilitar operação real.

**Controle administrativo de corridas profissionais (20/11/2026):** o Centro de Operações em `/admin/operacoes` abre em "Central ao vivo" e distingue motoristas em corrida, a caminho do embarque, disponíveis para pedidos e com falhas de GPS/cobertura ou habilitação. A fila de "Acessos ao radar" não representa corridas ativas. A migration incremental `0221_f07_operations_command_center.sql` fornece a consulta protegida, incidentes e auditoria. Operações podem registrar, assumir e resolver incidentes sem alterar status da viagem; expirar buscas `SEARCHING` sem motorista após o prazo; e cancelar excepcionalmente `ACCEPTED/ARRIVED` travadas há 15 minutos ou mais **somente antes do embarque, sem pagamento e com justificativa administrativa**. `IN_PROGRESS`, `PENDING_REVIEW`, conclusão, pagamentos e contestações continuam protegidos pelos fluxos existentes. Jamais expor latitude/longitude exata na consulta administrativa resumida. A central é observabilidade e atendimento, não substitui homologação de transporte. Aplicar 0221 no banco antes de publicar a UI.

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

**UX/UI de Operações F09 (branch de desenvolvimento):** seis módulos existentes com navegação por ícones, identidade CARONAA adaptativa (preto #121212, amarelo #FFBB00, branco; Sora/Manrope), mapa prioritário, fila Flash paginada, detalhes com acesso ao histórico individual, cartões em espaço estreito, indicadores consolidados e gráficos baseados em dados reais. Funil de cotações mantém IDs de cotação, cancelamentos terminais são agrupados por responsável e expiração é separada; não mostrar comparações fictícias nem deduzir entrega de push. Histórico com 12 registros por página, busca e CSV limitados à página como antes. Configurações preservam RPCs e auditoria; estilo aplicado somente ao workspace e diálogos de Operações em tela, sem modificar o PDF impresso ou o mecanismo GPS/aceite/Pix. A confirmação visual em navegador (desktop, tablet, mobile, claro/escuro), suíte de regressão, build e homologação completa continuam necessários antes do merge.

**Pessoas, audiência e diagnóstico F07/F08/F09 (branch de desenvolvimento):** 0259 acrescenta histórico privado por conta, perfil de atuação e período, com paginação e evidências por pedido; 0260 registra confirmação declarada pelo cliente autenticado somente para resultado de radar previamente observado; 0261 captura candidatos na inserção de Flash pela regra 0233 antes do limite individual da fila, sem alterar o motor de despacho, e distingue lista vazia de captura ausente; 0262 separa o motivo opcional de tentativa compartilhada cancelada do cancelamento terminal do pedido e resolve nomes atuais de atores/destinatários para o histórico admin; 0263 agrega a cobertura e diagnósticos de audiência sem inferir causalidade. Confirmação de retorno do app não equivale a entrega de push ou visualização. A captura pré-limite não é uma lista de destinatários garantidos; critérios devem ser reconciliados com o radar efetivamente implantado na homologação. As escritas extras são isoladas de erros comuns, com espera por locks limitada onde acionadas na transação principal; tempo total e carga devem ser medidos em homologação. O teste local utiliza PostGIS real quando a extensão está instalada e avisa explicitamente quando substitui apenas a fonte de candidatos por fixture sintética. A aba Pessoas mantém a fonte 0244 e inclui o histórico individual; Inteligência usa a nova audiência, sem alterar as métricas agregadas anteriores ou os PDFs programados. Motivos opcionais disponíveis na home e experiência Flash e telas Minhas viagens/Viagem compartilhada; demais fluxos de supressão/publicação e confirmação de push ainda exigem auditoria. Não publicar sem regressão e validação completa do esquema.

**Integração administrativa e evidências de fila F09 (branch de desenvolvimento):** migration 0258 conserva uma trilha privada de gravações reais da fila municipal Realtime, preservando a atualização original e isolando falhas da escrita adicional com limite de espera de lock. Uma gravação da fila não representa destinatário, envio, visualização ou entrega. O histórico administrativo abre a evidência por pedido, com segundos e fuso America/Fortaleza. Inteligência usa a visão consolidada 0256 com filtros, tratamento de respostas obsoletas e estados de indisponibilidade. PDF manual (impressão, WhatsApp e e-mail) inclui indicadores avançados agregados quando disponíveis; o PDF anexado tem uma terceira página opcional, mantendo duas páginas na ausência dos novos dados. Sem dados pessoais/GPS na nova exportação. As consultas legadas continuam disponíveis e não são uma única transação com a visão avançada. Não declarar a elegibilidade exata na criação nem entrega individual de Realtime sem evidência específica; validação em esquema completo, regressão e desempenho ainda pendentes.

**Integração operacional F07/F09 (branch de desenvolvimento):** 0256 fornece funil por ID de cotação até aceite/conclusão e uma RPC de visão agregada consistente. 0257 reutiliza a RPC autorizada de radar sem reescrever o despacho; registra apenas pares motorista/pedido efetivamente retornados na consulta, de forma idempotente e com escrita de telemetria não bloqueante em caso de erro de gravação. Isso não é censo de elegíveis no instante da criação, nem confirmação de notificação, entrega ou visualização. Não registrar coordenadas nas evidências. O cliente usa fallback legado apenas se a nova RPC não existe. Na home Flash do passageiro, o motivo opcional aparece somente após confirmação do cancelamento original; fechar ou falha da coleta não revertem a corrida. Sem mudança nos preços, GPS, Pix ou regras de aceite. Os testes isolados passam por uma função radar substituta, não validam a regra real de GPS; homologação completa e medição de desempenho continuam obrigatórias. A integração da UI administrativa, demais fluxos de cancelamento e transporte individual de notificações permanece pendente.

**Regras avançadas de Operações F09 (branch de desenvolvimento, não publicadas):** migrations 0253–0255 acrescentam conversão por vínculo persistido de cotação com solicitação/oferta da mesma conta, retenção por coortes de pedidos de igual duração, desempenho por par único serviço/pedido/motorista, classificação de cancelamentos por evidência explícita (inclusive ambígua/desconhecida), sinais de presença por motorista-hora, falhas de envio observadas, incidentes registrados e confirmação bilateral de Pix manual. Não inferir abandono de cotação sem vínculo, ausência de oferta sem telemetria, causalidade de falhas, liquidação bancária ou receita de plataforma. O denominador de cotações compartilhadas inclui ofertas de motoristas. As RPCs são administrativas e somente de leitura. Validação: `POSTGRES_BIN=/usr/lib/postgresql/18/bin node scripts/test-operations-db.mjs` executa 0247–0255 em estrutura mínima isolada com dados sintéticos; homologação com o esquema completo e integração dos consumidores permanecem necessárias.

**Histórico operacional e apresentação (22/11/2026):** pedidos possuem duas dimensões: **aceite** (nunca aceitos versus aceitos ao menos uma vez) e **resultado exclusivo** (aguardando, em atendimento, concluído, cancelado ou expirado). Cancelamentos antes e depois do aceite somam o resultado "canceladas", mas se sobrepõem às dimensões de aceite. Buscas vencidas ainda gravadas como SEARCHING aparecem como EXPIRED no relatório, sem reescrever corridas reais. Em produção, o Histórico & Relatórios mostra exclusivamente as solicitações reais registradas no banco nos cartões, nas taxas, nos gráficos de horários, no mapa de calor e na impressão/PDF. A projeção de +108 pedidos foi desativada por `ENABLE_OPERATIONS_PROJECTION=false` e não integra as métricas operacionais. Não há alterações nos registros reais, valores, GPS, faturamento, perfis ou repasses. As projeções de apresentação permanecem separadas de relatórios operacionais reais. A migration incremental 0235 deve preceder a interface.

**Acesso por perfil no período (migration 0244):** a contagem de dias autenticados dos últimos 30 dias só considera `role_at_access=profiles.active_role` no momento da consulta; uma troca de perfil não faz histórico de acesso como motorista virar acesso como passageiro. Último acesso geral continua identificado com o papel do sinal mais recente.

**Foto ampliável nas listas administrativas (22/11/2026):** ao clicar ou tocar na foto real de um motorista ou passageiro em Operações → Pessoas, abrir diálogo responsivo com imagem ampliada (contain, altura máxima 70dvh), nome e fechamento pelo botão ou Esc, sem sair da tela; o mesmo comportamento vale para as telas F02 antigas. Sem foto disponível, mostrar apenas iniciais sem interação. Preservar a ação de ver detalhes separada da foto. Sem alteração de banco, dados privados ou permissões.

**Decisão vigente — múltiplos veículos e placa, sem matrícula (22/11/2026):** Uma única conta pode cadastrar vários carros e motos na nova tabela professional_driver_vehicles, cada um com placa, marca, modelo, cor e vagas próprios. Apenas um veículo pode ficar ativo no radar por vez; a troca só ocorre offline, sem corridas ou ofertas em aberto, por RPC autenticada que atualiza atomicamente o perfil e a modalidade da autorização F07. Novo veículo completo pode ser cadastrado pela pessoa já autorizada, mas salvar não muda o veículo ativo. A matrícula de mototaxista foi retirada das telas e das validações obrigatórias; a placa é necessária para todos os veículos. Os valores históricos de registration_number permanecem preservados para auditoria, mas não são devolvidos ao passageiro (migrations 0245 e 0246). Esta decisão substitui as antigas regras de 11–19/11 que exigiam matrícula ou dispensavam placa; WhatsApp continua opcional. A habilitação não revoga decisões de bloqueio, avaliação, GPS, segurança nem alterações de preço/pagamento.

**Auditoria de Pessoas F09 — fonte verificada (22/11/2026):** migration incremental `0243_admin_operations_people_truth.sql` substitui contagens de motoristas e passageiros baseadas em ofertas/formulários F02 por **contas existentes em auth.users com profiles.active_role**. Retorna usuários únicos por papel atual (MOTORISTA/PASSAGEIRO), autorização profissional Flash em `professional_driver_authorizations`, presença com GPS recente, solicitações e viagens F07 + compartilhadas por conta, e último acesso medido a partir de `caronaa_app_access_days` desde a implantação da coleta. “Cadastro” não é “online” nem “ativo nos últimos 30 dias”. Usuário autorizado a dirigir mas com papel atual PASSAGEIRO não é contado como motorista ativo; o papel atual pode mudar ao longo do tempo. Acesso é **observado somente após implantação**, nunca retroconstruído com consultas Google Maps. A nova tela usa uma única RPC admin-only e lista responsiva sem scroll interno, com e-mail visível apenas ao administrador, sem telefone/GPS no resumo; páginas antigas F02 permanecem acessíveis para ações documentais e são explicitamente identificadas como recorte de carona compartilhada, não contagem oficial de perfis. Excluir órfãos e leads sem autenticação dos totais de cadastro. No snapshot auditado: 30 contas MOTORISTA + 190 contas PASSAGEIRO (220 no total), 26 profissionais aprovados no perfil MOTORISTA; números variam com novas inscrições, trocas de papel e corridas.

**Consolidação operacional (22/11/2026):** Na Central, o filtro de serviços do mapa atualiza também os indicadores de pedidos aguardando e viagens em andamento, combinando Flash e caronas apenas quando as duas consultas respondem; oferta futura de carona não equivale a motorista profissional online. O rastreamento GPS é específico de Flash e os embarques compartilhados são estáticos.  o departamento de Operações organiza seis módulos no topo: **Central, Viagens, Pessoas, Relatórios, Inteligência e Configurações**. **Viagens** contém Caronas, Solicitações e Correspondências como subtelas da mesma gestão; **Pessoas** contém Motoristas e Passageiros, preservando todas as ações administrativas e links antigos `/admin/caronas`, `/admin/solicitacoes`, `/admin/matching`, `/admin/motoristas` e `/admin/passageiros`. **Relatórios** concentra cotações de preços geradas, histórico transacional, PDFs e agendas de e-mail; **Inteligência** também mostra o card de cotações, junto com análise de horário, presença, funil de contas e uso Google Maps. A duplicação do card entre abas é intencional: ambas usam a mesma RPC e os mesmos filtros, sem somar contagens. Evitar duplicar dashboards ou tabelas visíveis. As migrations incrementais `0239` e `0241` dão ao mapa da Central a visão somente-administrador de ofertas e pedidos compartilhados, além de pontos de embarque de caronas em andamento; **esses pontos estáticos não representam GPS ao vivo** nem autorizam redistribuição de corridas. A migration `0240` (reforçada pela incremental `0242` para não duplicar pedidos compartilhados com várias tentativas de match) apresenta pessoas distintas que cotaram, pediram, receberam aceite e concluíram, e pedidos por município para F07, sempre no fuso America/Fortaleza. Não inferir município de caronas compartilhadas a partir de endereço em texto. Conversão no mesmo período significa interseção de contas, não causalidade de sessão. Em Pessoas, a coluna de último acesso autenticado vem exclusivamente de `0237`, sem inventar histórico anterior. Configurações de suporte permanecem persistidas e editáveis, com número em uso +244944175424 (não hardcode); parâmetros profissionais existentes ficam em um painel avançado recolhível nessa mesma aba, não duplicados em Ferramentas da Central. Esta reorganização não muda preços, acesso profissional, aprovação, GPS, PIX, pagamento ou correspondência de passageiros.

**UI compacta das cotações (22/11/2026):** o gráfico de cotações não usa rolagem interna em nenhuma largura de tela. Até 7 dias, cada dia aparece individualmente; intervalos maiores são exibidos em até 7 faixas cronológicas proporcionais à extensão do período, somando todos os registros de cada faixa sem excluir ou duplicar cotações. Contagens originais, filtro de serviço, RPC e PDF mantidos sem alteração.

**Histórico operacional compacto (22/11/2026):** removido o card redundante de conversão de pedidos. O Histórico de pedidos e corridas possui botão acessível de recolher/expandir, expandido inicialmente. A tabela, filtros locais e paginação recolhem juntos; indicadores, filtros principais, dados reais e PDF permanecem sem alterações. Nenhuma migration necessária.

**Cotações de preço em Histórico & Relatórios (22/11/2026):** migration incremental `0238` implementa RPC administrativa `admin_caronaa_price_quotes_report(date,date,text)` com validação de período, fuso de Fortaleza e filtro de serviço all/flash/shared. Flash conta uma cotação real por `caronaa_quick_fare_quotes.id` emitida em `issued_at`; caronas compartilhadas contam `offer_route_quotes.quote_id` emitidas em `created_at`. Não confundir Google Places/pesquisas de destino com cotações de tarifa ou pedidos efetivamente confirmados. Card principal apresenta cotações emitidas; outro card apresenta contas distintas que cotaram; gráfico diário acompanha os filtros. Os mesmos totais constam no PDF de impressão e no PDF compartilhado por e-mail/WhatsApp. Nunca somar cotações a pedidos nem tratar cotações repetidas da mesma pessoa como usuários novos.

**Engajamento autenticado em Operações (22/11/2026):** a migration incremental `0237` registra dias de presença de contas autenticadas com perfil `PASSAGEIRO` ou `MOTORISTA`. O AuthProvider chama `record_caronaa_app_access` na abertura, retorno ao app/visibilidade e até a cada 5 minutos enquanto ativo, sem GPS e sem chamar para visitantes anônimos. O servidor identifica `auth.uid()`, resolve o papel utilizado e agrega um registro por conta+dia+papel, com throttling de 5 minutos. A RPC de relatório `admin_caronaa_app_engagement` retorna pessoas únicas, passageiros, motoristas, interseção (ambos), ativos por dia e até 500 contas recentes com dias ativos; só admin pode consultar. Pessoa que alterna papéis conta apenas uma vez no total geral. Impressão colorida e PDF de compartilhamento usam agregados, sem lista nominal. A coleta não reconstrói visitas anteriores: acessos nos dias 20 e 21/11 não podem ser inferidos de chamadas Google Maps, onboarding ou GPS. Sinais de presença não equivalem a sessões exatas; `visit_count` é amostra de atividade.

**Google Maps em Operações (22/11/2026):** o Histórico & Relatórios consulta a função administrativa `admin_google_api_usage_report` da migration incremental `0236`, filtrando pelo mesmo período (inclusive datas personalizadas). A contagem utiliza `google_api_usage.created_at` convertido para `America/Fortaleza` e distingue Places, Routes, outros, falhas, chamadas por dia, hora e função de origem. Os indicadores também acompanham a impressão A4 colorida e o arquivo PDF compartilhado por WhatsApp/e-mail. **Fonte é apenas auditoria interna dos wrappers**, não métricas faturáveis do Google Cloud: chamadas diretas de Maps JavaScript no navegador podem ficar fora. Não comparar o número automaticamente com Google Cloud Billing nem afirmar economia sem dados oficiais. A seleção de Corrida Rápida/Caronaas afeta pedidos; Google Maps mostra uso da plataforma inteira no intervalo. Não persistir nenhuma simulação em `google_api_usage`. Acesso somente administrador, via RPC com RLS e sem GPS.

**Compartilhamento de PDF (22/11/2026):** Histórico & Relatórios gera um arquivo PDF A4 horizontal em duas páginas com logo oficial, seis indicadores, conversão, horários e mapa de calor, sem dados pessoais ou GPS. Pelo WhatsApp, em navegadores com Web Share Level 2, o arquivo vai ao seletor nativo para ser anexado à conversa; onde não houver suporte, o PDF é baixado e o WhatsApp abre para o administrador anexá-lo manualmente (a URL wa.me não anexa arquivos automaticamente). Pelo E-mail, um endpoint autenticado só para administradores recebe o arquivo e usa o provedor Resend com anexo PDF; requer `RESEND_API_KEY`, `CARONAA_REPORT_FROM` (domínio verificado) e `SUPABASE_SERVICE_ROLE_KEY` no servidor. Sem credenciais, mostrar erro claro, sem afirmar que enviou. Nenhuma informação fictícia sai pelo compartilhamento.

**PDF executivo de Operações (22/11/2026):** o botão Imprimir / PDF imprime um documento próprio, A4 paisagem e com cores CARONAA, contendo período, serviço, pedidos, aceite/conversão, resultados, horários de pico e mapa de calor. Sidebar, filtros, listagem pessoal, ferramentas e agendamentos não são exportados. O documento usa as mesmas consultas administrativas de pedidos reais. CSS usa `print-color-adjust: exact` e fundos explícitos para preservar cores; no navegador, selecionar "Salvar como PDF". O relatório não inclui GPS, telefone ou lista individual de usuários. Sem alterações no banco.

**Resumos operacionais periódicos (22/11/2026):** Histórico & Relatórios oferece resumos de pedidos, aceites, falhas de aceite, cancelamentos, conclusões e picos por hora. Administradores podem configurar envios diários, semanais e mensais por e-mail com destinatários autorizados; nunca incluir dados pessoais, GPS ou Pix nesses e-mails. Os agendamentos começam desligados e exigem serviço de envio, token secreto de agendamento e executor confiável configurados antes de serem considerados operacionais. O estado enviado ao provedor não garante entrega final. O painel mantém impressão/PDF manual e compartilhamento manual separados do envio agendado.

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


