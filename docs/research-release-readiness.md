# Homologação da Central de Pesquisas CARONAA

## Alterações de código
Implementação na `main`: catálogo, páginas individuais, versionamento, editor de seções e perguntas, modelos municipais, formulário público, consentimento, analytics históricos e dinâmicos, comparações e proteção contra reenvios.

## Ordem de aplicação no Supabase
**Não executar antes de confirmar backup restaurável.** As migrações 0065–0068 já foram aplicadas manualmente pelo operador em sessão anterior (verificar na instalação atual). Aplicar, em ordem, apenas as pendentes:
`0069_sts_legacy_analytics.sql`,
`0070_research_answers.sql`,
`0071_research_answer_summary.sql`,
`0072_research_response_validation.sql`,
`0073_research_mobility_dimensions.sql`,
`0074_municipal_research_overview.sql`,
`0075_research_unified_bi.sql`,
`0076_research_answer_idempotency.sql`.
Não executar arquivos duas vezes às cegas; conferir `to_regclass`, `to_regprocedure` e histórico de migrações antes. Recarregar cache PostgREST após aplicação.

## Critérios funcionais
1. **STS**: 35 submissões, nenhuma excluída nem alterada. DOR_01=17, DOR_02=11, DOR_03=11, DOR_04=5, DOR_06=4, após consulta histórica. Conferir 33 respondentes elegíveis para dificuldades.
2. **BI**: filtros por pesquisa, natureza, ocupação, papel e código de dor atualizam contagem, dores, perfis e dimensões disponíveis. Respostas em `raw_payload.raw_payload` são lidas, não regravadas. Valores não coletados aparecem como N/D.
3. **Catálogo**: pesquisar por título/código, filtrar por natureza e abrir URL individual da pesquisa. STS encerrado permanece somente leitura.
4. **Construtor**: cadastrar formulário educacional, criar seções, pergunta obrigatória, múltipla escolha e pergunta condicional; salvar rascunho, pré-visualizar, publicar e criar uma segunda versão. Revisões publicadas ficam imutáveis.
5. **Público**: acessar `/pesquisas/SEU-CODIGO`, preencher, aceitar consentimento e enviar. Campo obrigatório bloqueia envio, pergunta oculta não é enviada, dupla submissão com a mesma chave não duplica registros.
6. **Novos resultados**: verificar contagem por versão e gráficos por opção. Perguntas de texto livre são agrupadas sem exposição pública. Comparação entre pesquisas mostra amostras.
7. **Mobilidade Local**: criar três pesquisas com naturezas locais e públicos PROFISSIONAIS, PASSAGEIROS, PREFEITURA; aplicar os modelos de perguntas, definir município e verificar visão agregada por território.
8. **Segurança**: visitante não lista rascunhos nem respostas; só formulários publicados aceitam INSERT; usuários não-admin não acessam painéis de dados. Testar com contas de papéis distintos.
9. **Performance/mobile**: viewport de 360px e 768px; teclado, foco, contraste, scroll, tempo de consulta e resposta em falha de rede.
10. **CI**: confirmar teste Vitest, build Vite e relatório do workflow `research-quality.yml` no commit de fechamento.

## Limitações explícitas antes da homologação
- Essas migrações não são aplicadas automaticamente pelo merge GitHub/Lovable.
- Os dados de STS não incluem intensidade e dor principal estruturadas para parte das dificuldades históricas; exibir N/D.
- Anonimato, consentimento, antifraude/rate limiting, retenção e LGPD precisam de revisão jurídica-operacional antes de pesquisa pública de grande escala.
- Não confundir levantamentos amostrais com estimativas representativas da população inteira.
