# F07 — Radar piloto Fortaleza–Maciço (migration 0142)

## Decisão de produto (11/11/2026)

O corredor principal CE-060/CE-356 foi aprovado para **radar de localização aproximada**:
Fortaleza, Maracanaú, Pacatuba, Guaiúba, Acarape, Redenção, Aracoiaba e
Baturité. Os demais municípios do inventário F07 permanecem com a configuração
administrativa anterior. Nenhum município fora da lista se habilita apenas por
estar no Ceará.

**Regra:** motorista aprovado cadastrado em região diferente pode aparecer no
município em que realmente se encontra, desde que o município atual esteja
habilitado para descoberta. Não comparar `profiles.city`,
`professional_mototaxi_profiles.region_code` ou onboarding com a posição GPS.
Um motorista de Redenção em Maracanaú pode aparecer em Maracanaú, e vice-versa.

## Autoridade e privacidade

- Usuário aceita explicitamente o GPS no navegador. Autorização prévia é
  lembrada por conta; preferência offline impede retomada automática.
- O frontend chama `publishVerifiedProfessionalPosition` no TanStack Server.
  Apenas o servidor autentica o usuário, verifica aprovação, bloqueio financeiro,
  disponibilidade online, limita consultas e resolve o **município atual** pelo
  Google Maps/Places, exigindo estado Ceará e país Brasil.
- A nova RPC `publish_verified_professional_position` aceita **service_role**
  apenas. A RPC antiga que confiava no município do client perde EXECUTE.
- O banco revalida município habilitado, autorização administrativa, menos de
  três débitos e is_available=true antes de salvar GPS e atualizar município
  operacional numa operação atômica.
- Fora da zona ou quando o Google não identificar o município, apaga-se a
  posição privada publicada. O GPS consentido pode continuar observando a
  reentrada numa zona permitida, sem publicar enquanto estiver fora.
- O radar apresenta localização **aproximada (0,01°)** e pseudônimo diário; não
  revela coordenadas precisas, identidade de motorista nem histórico de deslocamento.
  Apenas sinal fresco (90 segundos), online e autorizado aparece.
- Nenhuma permissão de GPS em segundo plano com app fechado é prometida.

## Separação comercial obrigatória

`0142` ativa somente `professional_service_regions.public_discovery_enabled`
nas oito cidades. Não modifica `caronaa_service_municipalities.car_enabled`,
`moto_enabled`, `professional_service_regions.dispatch_enabled`,
`caronaa_quick_tariff_policies.published` ou `intermunicipal_enabled`.
O mapa pode exibir profissionais do piloto mesmo com `status=WAITLIST`.
O pedido de corrida remunerada permanece bloqueado pelo gate de tarifa, modo
e despacho até liberação operacional/regulatória específica.

## Instalação / ordenação

1. Preservar R4/main e backup. Confirmar migrations **0128, 0131, 0133, 0139,
   0141** e os objetos correlatos no banco.
2. Publicar o frontend/backend com
   `src/lib/professional-radar.functions.ts` e os dois clientes atualizados.
   Verificar a variável **SUPABASE_SERVICE_ROLE_KEY** somente no servidor;
   nenhuma chave privilegiada pode ir ao frontend.
3. Em homologação, aplicar `drizzle/migrations/0142_radar_corredor_localizacao_verificada.sql`
   como transação única. Essa migration revoga a antiga RPC pública, portanto
   não aplicá-la antes do frontend novo ser implantado. Nenhum deploy GitHub
   ou Lovable é prova automática de atualização do domínio customizado.
4. Consultar as oito cidades e conferir `public_discovery_enabled=true`,
   `dispatch_enabled=false` e ausência de tarifas publicadas. Confirmar que
   `authenticated` NÃO executa `publish_verified_professional_position`
   nem a RPC antiga, enquanto `service_role` pode usar o endpoint novo.
5. Homologar motorista01 (perfil Maciço) com GPS físico em Maracanaú e
   motorista02 (perfil Fortaleza) com GPS físico em Redenção: os dois devem
   aparecer na zona do GPS, não na do cadastro, depois de aprovação manual.
6. Ensaiar troca de município dentro do corredor, região não listada, GPS
   negado/impreciso, offline, desautorização, débito >=3, 90s sem sinal,
   concorrência de duas abas, fronteira e negativa de localização em segundo
   plano. Fora de cobertura não deve haver pin nem pedido de corrida.
7. Testar presença no mapa `/home` do passageiro e status de Corrida Rápida
   **WAITLIST**, sem botão de cotação/pedido. Executar TypeScript, Vitest, build
   e regressão mobile iOS/Android antes de chamar piloto de homologado.

## Rollback de emergência

- No banco, reverter somente os oito flags
  `professional_service_regions.public_discovery_enabled=false` desativa
  a exibição do radar (sem apagar autorização/contas).
- Se houver falha do servidor, não reabilitar a RPC insegura do client como
  workaround. Reverter a versão do frontend em conjunto com migration segura
  de compatibilidade; manter o radar desativado até correção.
- Não alterar tarifas nem flags de despacho como forma de depurar GPS.

## Aceite

Radar da cidade GPS verificada, independente da região cadastrada;
sem localização fora das áreas aprovadas; sem autoaprovação; sem publicação
ou despacho de viagens pagas; e sem regressão da opção offline.
