# Homologação CARONAA — quatro usuários

## Identidades autorizadas (e-mail exato)
- nicolau@caronaa.com: cadastro novo, sem selo, quatro etapas e pesquisa.
- antonio@caronaa.com: cadastro novo, sem selo, quatro etapas e pesquisa.
- aceltino@caronaa.com: motorista pré-configurado, selo CARONAA_TEST.
- faustino@caronaa.com: passageiro pré-configurado, selo CARONAA_TEST.

## Provisionamento seguro (somente ambiente de homologação)
1. Aplicar a migration 0125 antes da publicação do código.
2. Criar ou confirmar as quatro contas pela Admin API de Supabase, com email_confirm=true **somente** para os quatro endereços exatos. Não usar service_role no navegador, não expor credenciais e não desabilitar confirmação de e-mail globalmente.
3. Para nicolau e antonio, não criar progresso de onboarding nem participações ou selos fictícios. Testar cadastro de usuário realmente novo e a exigência de pesquisa.
4. Para aceltino e faustino, provisionar `user_onboarding_progress` com status BASIC_COMPLETED e perfil de uso MOTORISTA ou PASSAGEIRO, região e vínculo reais de homologação. Registrar verificações CARONAA_TEST via operação administrativa, com source=ADMIN e source_reference_id identificando o piloto, SEM reivindicar verificação documental ou institucional.
5. Após autenticação, conferir se o UUID de `auth.users` corresponde a `profiles`, `user_onboarding_progress` e `user_verifications`. Repetir acesso em nova sessão.
6. Testar que nenhum outro e-mail recebe confirmação automática, badge ou dispensa do fluxo; conferir RLS e autorização de leitura.
7. Para nicolau e antonio: concluir as quatro etapas, abrir `/formulario`, escolher pesquisa publicada compatível, responder inclusive às dores sociais quando passageiro, confirmar persistência e vínculo da participação ao UUID da conta; ao voltar, não impor pesquisa já respondida.
8. Preservar todas as pesquisas já respondidas e as contagens regressivas de lançamentos. Se a pesquisa falhar ao carregar, não permitir desbloqueio por erro de rede.

**Atenção:** ter `email_confirmed_at` e receber o selo de teste são coisas diferentes. O selo CARONAA_TEST é interno, exclusivo do piloto, e não substitui as verificações de identidade que venham a ser exigidas na operação pública. Não conferir o selo apenas pelo domínio de e-mail.

## Aceite
- Novo usuário sem participação: formulário público existente, após etapa 4.
- Participação vinculada existente: sem formulário duplicado; respeitar bloqueio de pré-lançamento.
- Piloto pré-configurado: perfil correto, sem pesquisa forçada, badge visível no perfil.
- Falhas de leitura impedem bypass; usuários comuns não recebem privilégios.
- Somente após esses testes: matching inteligente, pagamento sandbox, CRM com IA.
