# Modelo 03 — Eventos e Match de Saída

## Objetivo
Pesquisa mobile-first, 2–3 minutos, com 7 perguntas simples + a etapa institucional já existente de perfil, região, horário, dias e flexibilidade. Não pede cadastro só para responder. Após envio oferece acesso aos fluxos reais de busca e publicação de carona.

## Como criar
1. Central de Pesquisas → Novo formulário → Natureza EVENTO → **Evento · Carona na saída**.
2. Configure nome e logomarca autorizada, identificador único, campanha, local e endereço do evento (campo Campus/Unidade), **data exata do evento**, horários de saída mais comuns e ao menos um ponto seguro de embarque.
3. Horários no preset (17h, 18h, 19h, 20h, 21h, 22h) são somente sugestões, **não afirmações sobre o evento**. Ajustar à agenda oficial.
4. Deixar `PLANEJADO` para período de validação. Selecionar `EM_OPERACAO` apenas com fluxos de busca e oferta realmente habilitados para o evento. Sem confirmação de parceria, não inventar parceria.
5. Revisar e publicar o formulário. Replicar como novo formulário para o próximo evento; nunca duplicar respostas nem selos.

## Perguntas da pesquisa
- Transporte de retorno (até duas alternativas) e principal dificuldade.
- Se poderia oferecer lugares; se sim, veículo e capacidade.
- Interesse em carona compatível e principal barreira (opcional).
- Etapa de trajeto: perfil passageiro/motorista/ambos, saída do local do evento, região do destino, horário sugerido ou escolhido, janela de flexibilidade e consentimentos separados.
- A data da viagem é o `launchDate` informado pelo administrador para este evento. O trajeto deve ser de VOLTA, do evento para o destino. Um dia da semana correspondente à data configurada é pré-selecionado.

## Ação depois da resposta
- Quando `EM_OPERACAO` e a data não expirou, **Buscar caronas disponíveis** envia origem, destino, data e horário à página existente `/buscar`. Ela consulta ofertas reais e retorna resultados vazios quando não houver match.
- **Preparar uma oferta** envia os mesmos dados e lugares declarados à página existente `/oferecer`. O usuário autenticado revisa veículo, preço, rota e todas as condições antes de publicar.
- Para público com perfil `AMBOS`, aparecem ambas as opções. Nenhuma cria reserva ou publicação automaticamente.
- Quando em planejamento/adiamento ou data passada, mostrar apenas registro de interesse e aviso de indisponibilidade operacional.
- O registro opcional de interesse já é feito pela RPC `register_research_interest`, com consentimento explícito e separado da pesquisa.
- URLs não levam coordenadas residenciais, email nem dados sensíveis; são campos aproximados que o usuário confirma no app.

## Inteligência de mercado
Sem migration nova: `get_configured_research_summary` já inclui `TRANSPORT_MODE`, `MOBILITY_PAINS`, `ADOPTION_INTENT`, `JOURNEY_PROFILE`, `JOURNEY_DEPARTURE_TIME` e registros de interesse/ disponibilidade. A coorte pode ser filtrada por `templateKey=EVENTO_MATCH_CARONAA`, instituição/evento, campanha, período, versão, perfil e horário. Permissões administrativas permanecem iguais.

A existência de intenção, lugares declarados ou abertura de fluxo **não equivale a match confirmado, corrida realizada ou pagamento**. Novos códigos do questionário somente ficam disponíveis em relatórios analíticos gerais (com versões) até serem incluídos numa futura migração específica. Nunca contabilizar como valores operacionais.

## Testes guiados
- Evento sem data ou ponto de encontro: criação bloqueada com mensagem clara.
- Evento PLANEJADO: responder sem cadastro; não mostrar CTAs operacionais.
- Evento EM_OPERACAO e data futura: passageiro preenche e encontra a busca com data/horário/origem/destino; confirmar que a busca retorna somente ofertas reais.
- Motorista com 2 lugares: ao aceitar fluxo, vai para `/oferecer` com 2 vagas predefinidas e deve revisar antes de publicação.
- Alterar resposta `Não posso oferecer` e perfil `MOTORISTA`: deve exigir correção.
- Motocicleta: somente um lugar; evento vencido: nenhuma rota de criação específica do evento.
- Consentimentos, duplicação independente, dashboard agregado, versões e selo de participação.
- Mobile 360/390px, tablet, desktop, teclado, leitores de tela e falha de conexão.
- Executar CI, testes TypeScript, RLS e build.

**Sem SQL novo para esta entrega**; usa a infraestrutura 0095. O PR #17 do Modelo 02 continua independente e sua migration 0097 ainda precisa ser instalada antes de usar seus indicadores regionais.
