# Modelo 05 — CARONAA Corporativo Interno

## Escopo
Formulário **exclusivo de colaboradores da mesma empresa** (uma pesquisa por unidade/filial, identificada pelo ID imutável da pesquisa). Mede perfis de trabalho, transporte, turnos, horários e regiões, lugares declarados, vontade de compartilhar carona com colegas e fatores de confiança. O preenchimento não cria ofertas reais, reservas, matches ou pagamentos.

Código: `EMPRESA_CARONA_INTERNA`. Natureza: `EMPRESA`. Política imutável deste modelo: `COLABORADORES_DA_EMPRESA`.

## Pré-requisitos de implantação
1. Fazer backup recuperável e implantar em homologação.
2. Corrigir/conciliar previamente o histórico de migrations manuais. Migrar sequencialmente **0097** (Modelo 02) → **0098** (Modelo 04) → **0099_corporate_internal_research_access.sql**. Essa migration copia e preserva as agregações das anteriores. Ela **não** foi aplicada na produção pelo PR.
3. Confirmar as funções `grant_corporate_research_access(uuid,uuid,text)`, `revoke_corporate_research_access(uuid,uuid)`, `list_corporate_research_access(uuid)` e a RLS das três tabelas corporativas.
4. Criar formulário rascunho para empresa/unidade, turno, dias de funcionamento, partida/retorno, pontos seguros, região, data/estado real do lançamento e imagem autorizada.
5. Um administrador CARONAA valida externamente com RH/gestor autorizado o vínculo de **cada conta de usuário**, registra a referência documental interna no painel **Colaboradores autorizados** e concede acesso. UUID do usuário não é matrícula nem prova. O campo de referência deve ser um protocolo, não um documento de identidade.
6. Para desligamento, administrador revoga a conta; novas leituras de pesquisa, envios, atribuição de selo e interesses serão negados. Respostas históricas preservadas para auditoria, sob políticas de privacidade e retenção aplicáveis. Não concede acesso automático por domínio de e-mail, confirmação de e-mail ou selo de pesquisa.
7. Publicar somente depois de testar acesso e proteção, e depois de validar que a empresa autorizou divulgação e uso da marca.

## Segurança implementada
- `corporate_research_memberships`: escopo específico `form_id+user_id`, verificação por administrador e revogação auditada; proibidos DML e SELECT diretos de usuários e anônimos.
- `corporate_research_access_audit`: evento GRANTED/REVOKED com operador e data, sem expor documentação de RH.
- `corporate_research_answer_owners`: vínculo do envio com a conta logada, independente do recibo secreto.
- Policies **RESTRICTIVE** de SELECT em `research_forms` e `research_form_versions`: mesmo com policies públicas legadas, só usuários autorizados e admins podem ver registros privados; admins podem gerenciar mas só empregados autorizados podem responder.
- `get_public_research_configuration`: não devolve metadados restritos a pessoas não autorizadas.
- `submit_configured_research_answer`: checa autorização antes de idempotência e vincula cada resposta ao autor; motorista precisa de carro, vaga e disposição declarados.
- `register_research_interest`: checa o vínculo ativo, titularidade da resposta e consistência do motorista para impedir registrar disponibilidade com recibo alheio ou declaração incompatível.
- `claim_research_participation`: recibos privados corporativos só podem ser reivindicados pelo autor; o selo **indica participação**, não vínculo empregatício.
- Para outros modelos restritos `MEMBROS_DA_INSTITUICAO`, a verificação também falha fechada, exigindo inscrição explícita na mesma lista por formulário. Isso evita políticas de acesso nominalmente privadas mas publicamente expostas.

## Uso mobile-first
Perguntas objetivas em duas seções:
- Turno, meio atual, dor, custo por trecho e frequência do trabalho.
- Dirige carro? Se sim, quantas vagas reais (incluindo zero) e disposição de oferecer carona. Depois intenção de adesão, confiança, trajeto recorrente e notificações do lançamento.
- Etapa institucional: dias, horários do turno, ida/volta, origem/destino aproximados, flexibilidade e consentimentos independentes.
- O motorista só pode registrar disponibilidade quando declarou carro, pelo menos um assento e desejo de oferecer; os demais continuam como passageiros.
- A resposta não liga automaticamente o usuário a viagens reais. Não existe, nesta entrega, **isolamento corporativo dos fluxos operacionais de `/buscar` e `/oferecer`**. A liberação de caronas exclusivas da empresa deverá ser implementada separadamente no banco de corridas, com RLS bilateral para motoristas e passageiros. Até lá, não apresentar match corporativo real.

## Inteligência de mercado
Coorte administrada globalmente por CARONAA, com respostas agrupadas por unidade, campanha, versão, dia, perfil e horário. Códigos reutilizados: `WORK_SHIFT`, `TRAVEL_FREQUENCY`, `TRANSPORT_MODE`, `MOBILITY_PAINS`, `COST_PER_TRIP`, `SEATS_AVAILABLE`, `RIDE_OFFER_INTENT`, `ADOPTION_INTENT`, `TRUST_FACTORS`, `BOOKING_INTENT`, `LAUNCH_PARTICIPATION_INTENT`. Novo: `CORP_DRIVES_CAR`.

Não mostrar rotas exatas, identificadores ou respostas individuais ao empregador. Evitar tabelas com grupos muito pequenos que permitam reidentificação; a implantação de relatórios externos exige controles de agregação e limiares mínimos. Disponibilidade potencial não é oferta operacional, e interesse não é adoção real.

## Testes obrigatórios
1. Como **anon**, pesquisar pelo link de uma campanha interna → a pesquisa e seu schema não aparecem, configuração pública não retorna dados, tentativas de RPC de submissão/interesse falham.
2. Como usuário autenticado **não autorizado** → os mesmos bloqueios; e-mail corporativo ou badge não são suficientes.
3. Como membro autorizado com e-mail confirmado → formulário e configuração visíveis, questionário respondido, consentimento separado; tentativa de registrar interesse com recibo de outro membro deve falhar.
4. Com perfil **MOTORISTA** sem carro, vaga ou intenção → frontend e DB devem bloquear, inclusive tentativa direta pela RPC.
5. Como admin, conceder e revogar o usuário; após revogação, nenhuma nova resposta/ação deve ser aceita; não perder auditoria.
6. Repetição do mesmo envio idempotente pelo autor → aceitar; repetição por outra conta → rejeitar.
7. Testar que pesquisas públicas atuais continuam disponíveis a convidados após a migration.
8. Testar agregações da pesquisa com filtros e sem exposição de nomes/vínculos a funcionários; selo não verifica emprego.
9. Testar duplicação para outra filial: a lista de membros não pode ser copiada por engano (escopo `form_id` exclusivo).
10. Testes de navegação mobile 360/390px, teclado, mensagens, rede, versão publicada e restauração da lixeira.

O PR inclui código e scripts; não há implantação automática de SQL nem dados simulados de empresas ou empregados.
