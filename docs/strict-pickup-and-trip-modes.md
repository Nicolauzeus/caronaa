# CARONAA — modos de viagem e encontro em rota estrita

Módulos: F03/F05 (carona e embarque), F06 (respeito à política de desvio), F07 (piloto direto).

## Interface e publicação

A home distingue Carona Compartilhada de Viajar Agora. O primeiro modo preserva
as solicitações e cotações de carona; o segundo monta a mesma experiência usada
por /viagem-rapida, sem criar uma fila ou RPC concorrente. Dados já selecionados
na home são usados para iniciar o formulário direto.

Ofertas pontuais novas pedem uma escolha explícita: Rota Estrita (seleção inicial)
ou Aceitar pequenos desvios. `allowDetours` segue no JSON `p_details` da RPC
`publish_priced_offer`. A migration 0136 grava a política antes de qualquer efeito
da publicação, mantém a cotação confiável e as preferências existentes, bloqueia
alteração posterior e rejeita idempotência com política conflitante. Ofertas
históricas e rotinas permanecem flexíveis, sem alteração silenciosa.

O backend verifica a presença da migration antes de publicar, para não criar uma
oferta perdendo a preferência. O planejador de desvios existente recusa ofertas
estritas. A tarifa R$ 6 por 11 km continua exclusivamente no contrato atual de
cotação rodoviária; `ride-cost.ts` não foi alterado.

## Encontro sugerido

Nos cartões de viagens MATCHED/CONFIRMED, somente participantes autorizados podem
carregar a origem confirmada do passageiro e a polyline da oferta. A geometria
local projeta o passageiro sobre os segmentos da linha, sem API e sem Turf.

Após ação Ver ponto de encontro sugerido e debounce de 600 ms, o backend confere
novamente o participante, o estado, a política e a projeção contra a geometria
salva. Só então consulta Nearby Search (New): raio 400 m, até 5 referências,
ordenação por distância, categorias gas_station, transit_station,
convenience_store, shopping_mall e parking. Solicita apenas id, displayName e
location; não faz Details para cada estabelecimento.

A primeira referência elegível precisa estar a até 400 m da projeção e até 50 m
da rota. O embarque continua projetado na linha do condutor, não dentro do
estabelecimento, para não exigir desvio. Sem resultado elegível ou se Nearby
falhar, usa a própria projeção na via como referência aproximada. Isso não
certifica acostamento, travessia, iluminação ou permissão para parar.

O mapa exibe ícone de pessoa na origem confirmada, pino azul de encontro, linha
do condutor e caminhada pontilhada obtida pelo Google Routes WALK. Não observa
movimentos do mapa/GPS para refazer a busca. Não inventa uma caminhada em linha
reta se o Google falhar. Caminhadas acima de 1,5 km mostram orientação para
combinar outra opção. Os avisos pedem confirmação do lado da via, acesso e parada;
a sugestão não substitui automaticamente o embarque combinado nem modifica
reservas, preço ou consentimentos existentes.

## Economia e privacidade

Cache limitado de promessas em memória: deduplica chamadas em curso, dura cinco
minutos por trajeto e não grava GPS em localStorage. O cache de servidor inclui
participante e viagem; toda leitura de cache é precedida por autorização. O cache
é por processo/sessão, não uma garantia de limite global entre várias instâncias.
Não há consulta a cada pixel, arrasto de mapa ou pulso de GPS.

Viajar Agora mantém quick_ride_request, quick_ride_my_requests, fila, aceite e
transições existentes. Origem/destino fixados disparam uma prévia DRIVE com debounce
e cache. Busca mostra estado real, sem carros fictícios nem ETA antes do aceite.
O contexto de mapa vem de nova RPC privada para os participantes: posição exata
do motorista apenas após aceite, com autorização, disponibilidade e localização
recente; desaparece ao encerrar a viagem. O radar público permanece aproximado.
A aproximação usa DRIVE e recalcula no máximo uma vez por minuto por participante
no processo, não a cada atualização de GPS. Histórico/fila consultam o banco como
antes. Nenhuma região é habilitada pela migration e não há preço, pagamento
profissional ou CPF novo.

## Aplicação e validação

Aplicar `drizzle/migrations/0136_strict_pickup_and_quick_ride_maps.sql` depois das
migrações existentes, antes de publicar a nova versão do aplicativo. É transacional
e aditiva. Não foi aplicada a um banco real neste ambiente: não havia conexão de
administração disponível. As alterações não devem ser anunciadas como homologadas
em produção antes de aplicar SQL e testar duas contas participantes.

Testar: oferta estrita/flexível persistida; idempotência; tentativa de leitura por
outra conta; MATCHED/CONFIRMED e encerramento; Nearby vazio em referência rural;
falha WALK; modo direto criando pedido em município liberado; aceite, ETA,
confirmação de embarque, finalização e interrupção do compartilhamento. APIs Google
ao vivo não foram consultadas por falta de chave REST local. Testes usam mocks.

O build usa a cópia local de asset de validação já documentada em
google-maps-migration.md; nenhum asset faz parte deste commit.

Resultado automatizado: 171 arquivos, 956 testes aprovados (`bunx vitest run
--maxWorkers=4`), `tsc --noEmit` sem erros e build cliente/servidor/Nitro aprovado.
A suíte inclui seleção dos modos e política, projeção em segmentos, pontos fora da
rota, Nearby vazio/falha, deduplicação, acesso por outra conta, ETA antes/depois do
aceite, publicação da preferência e bloqueio de publicação sem a migration.
Os testes de SQL existentes são contratos estáticos; não substituem homologação
transacional/RLS da 0136 em PostgreSQL com duas contas reais.
