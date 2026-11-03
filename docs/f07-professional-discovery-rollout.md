# F07 — Descoberta geográfica de motoristas profissionais (entrega parcial)

## Escopo implementado (03/11/2026)

- Migration `0128_professional_location_discovery.sql`: regiões desabilitadas por padrão, autorização explícita de profissionais, GPS privado com RLS e RPC de consulta aproximada para usuários autenticados.
- `/disponibilidade-profissional`: compartilhamento opcional, GPS contínuo enquanto visível, renovação a cada 30 s, interrupção ao ocultar a página/desabilitar o estado ou perder sinal.
- `/home`: campo município e pontos aproximados no mapa com consulta a cada 15 s, estado vazio/erro e aviso de que o despacho ainda não está liberado.
- Consulta só retorna profissionais aprovados, disponíveis, com heartbeat e GPS recentes (< 90 s), na região explicitamente habilitada.
- As coordenadas públicas são arredondadas a 2 casas decimais (aproximadamente 1 km na latitude), não representam ponto de embarque e não expõem o UUID real. O identificador diário é pseudônimo e não deve ser usado para autorização.

## Instalação controlada (NÃO executar em produção sem homologação)

1. Verificar que `professional_presence` e `set_professional_presence(boolean,text)` existem na base (migration 0083 foi previamente marcada como processada por autorização do responsável).
2. Fazer backup e aplicar somente a migration 0128 em ambiente de teste; confirmar que `professional_service_regions`, `professional_driver_authorizations` e `professional_driver_locations` estão com RLS ativa e nenhuma policy pública.
3. Sem regiões cadastradas e sem profissionais aprovados, a RPC deve retornar **lista vazia**. Usuário não autenticado não pode executar as RPCs.
4. Um administrador autorizado, usando sessão de banco privilegiada e processo auditado, pode cadastrar explicitamente município de teste e autorizar motorista de teste. A configuração inicial é intencionalmente OFF. Não criar permissão de autoaprovação pelo usuário ou simples flag no frontend.
5. Só em ambiente controlado habilitar `public_discovery_enabled` para o município testado. `dispatch_enabled` permanece false; não existe motor de despacho nesta entrega.
6. Testar GPS negado, localização inválida, offline, região não habilitada, heartbeat de 90 segundos, troca de município, logout, duas sessões, aba oculta e acesso direto indevido às tabelas.
7. Executar `npm run test`, `npm run build`, teste no celular, teste de políticas na instância Supabase e observar métricas antes de qualquer publicação.

## Não implementado — não liberar serviço comercial

- Criação de solicitação de corrida profissional, fila, algoritmo de despacho, timers de oferta, aceite transacional e atribuição exclusiva.
- Navegação a um passageiro, transições de corrida, chat/notificações, cancelamentos, avaliação profissional e suporte.
- Política tarifária profissional, cotação homologada, cobrança, split, reembolsos ou pagamento de motoristas.
- Homologação municipal, segurança operacional, seguro, validações legais e integração de GPS em segundo plano para aplicativo nativo.
- Testes automatizados e build **ainda não executados** nesta entrega (ambiente de repositório privado não disponível para execução local).

## Cuidado com dados pessoais
Acesso preciso é exclusivo da própria chamada de atualização do motorista. Outros usuários recebem apenas posições arredondadas. Em produção exigir política de retenção, informação clara aos profissionais, auditoria e monitoramento de abuso/consultas em massa antes de ampliar a descoberta.

## Relatório
- Módulos: F07 (descoberta de presença), base preliminar F08.
- Estado: parcial, protegido por configuração desligada por padrão.
- README/AGENTS: preservados. Nada de CPF, tarifa de carona alterada ou viagem fictícia publicada.
