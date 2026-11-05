# CARONAA — conexão segura à API Asaas de produção

## Objetivo: cadastrar a credencial, sem habilitar pagamentos

A aprovação da conta não autoriza ligar o checkout automaticamente. O fluxo atual do CARONAA
continua em Pix manual com confirmação bilateral; o webhook Asaas ainda é **sandbox-only**
e o checkout Asaas não provisiona cobranças. Não substitua o Pix manual por um checkout
Asaas de produção até o fluxo transacional, webhooks, estornos e split estarem homologados.

## Configuração (secrets do servidor / ambiente de execução TanStack Start)

No projeto CARONAA, abra o gerenciador de Secrets do backend Lovable Cloud
(Cloud > Secrets; menu pode variar) e grave:

- `ASAAS_ENV`: `production`
- `ASAAS_API_KEY`: chave **da conta de produção** gerada em Integrações no Asaas.
- `ASAAS_WEBHOOK_AUTH_TOKEN`: token **separado** de 32 a 255 caracteres que
  será cadastrado como authToken no webhook Asaas. Não use a chave da API como token.
- `ASAAS_ENABLE_CHARGES`: `false`

Não use prefixo `VITE_` em nenhum segredo. A chave nunca pode ir ao React,
localStorage, .env versionado, mensagens, logs ou SQL da aplicação.
A plataforma de execução deve expor esses segredos como variáveis de ambiente
aos handlers do servidor TanStack Start, não apenas a Edge Functions.
Confira o ambiente do deploy e faça um teste de leitura antes de ativar webhook.

## Confirmação sem movimentar dinheiro

1. Administrador com acesso Financeiro abre `/admin/financeiro`.
2. Em **Integração Asaas**, usa **Verificar minha conta Asaas**.
3. A aplicação consulta `GET https://api.asaas.com/v3/myAccount/status`,
   retornando apenas se a autenticação funcionou e `general = APPROVED`.
4. Nenhuma chave, dado de cliente ou cobrança é devolvido ao navegador.
5. Se aparecer `401/403`, confira se a chave é de produção e tem permissão,
   ou se há restrição de IP. Nenhum pagamento será criado nesse teste.

## Antes de receber webhooks de produção

- Atualizar e homologar o handler `/api/asaas/webhook`: o código atual
  responde HTTP 503 sempre que `ASAAS_ENV !== sandbox`.
- Configurar webhook Asaas com URL HTTPS pública e `authToken` próprio;
  validar `asaas-access-token` e idempotência.
- Homologar criação de cliente, cobrança, consulta de QR Pix, reversões,
  splits/carteiras, tarifas e reconciliação com a conta.
- Decidir a transição entre Pix manual direto ao motorista e intermediação Asaas,
  evitando cobrança duplicada e duplicidade da comissão de 15%.
- Manter `ASAAS_ENABLE_CHARGES=false` até aprovação do release e operação financeira.

Referências oficiais:
- https://docs.asaas.com/docs/authentication-2
- https://docs.asaas.com/reference/check-account-registration-status
- https://docs.asaas.com/docs/faq-de-webhooks
