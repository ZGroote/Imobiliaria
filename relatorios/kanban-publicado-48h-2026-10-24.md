# Publicados no Kanban: 48 horas

Aplicado em 24/10/2026, às 12:26 (America/Sao_Paulo), no painel de produção.

- A publicação grava `requests.publishedAt` com horário do servidor. Alterar prioridade, notas
  ou responsável não reinicia o prazo; as regras impedem mudar ou apagar essa data depois de publicado.
- A coluna consulta somente publicados há menos de 48h, antes da paginação e do contador.
  O navegador renova a consulta no vencimento de um cartão visível, ao receber foco e a cada minuto
  para atualizar também o contador dos registros além da página. O limite carregado é preservado.
- Os pedidos antigos sem `publishedAt` saem da coluna. Os três registros de produção conferidos
  foram `3EaRqRJRfn6JJRlWsAy0`, `VcQKyZ2BEYO7Vuzs2laX` e `vFninsZXhvAOAorZtoNM`, todos do Cedros.
  Eles foram retirados da visualização do Kanban; os documentos, seus horários de atualização,
  o histórico, os imóveis e suas publicações foram preservados, sem exclusão física.

## Verificação

- 75 testes do painel e 44 testes de regras aprovados nos emuladores `demo-painel`.
- Typecheck aprovado; build de produção aprovado com o Node 24.19 fornecido pelo Codex.
  O Node 24.15 instalado no Windows falhou ao iniciar o processo de CSS do Turbopack.
- Navegador local: 56 cartões publicados, expansão além dos 50 iniciais e vencimento automático
  para 55, sem recarregar, sem perder a expansão e sem erros no console. Três legados permaneceram
  fora da coluna. Captura local: `tmp/kanban-publicado-48h.png`.
- Produção: consulta da coluna e agregação `count()` retornaram zero. Os três documentos antigos
  mantiveram os mesmos `updateTime` anteriores à tarefa.
- O bundle servido pelo domínio oficial é idêntico ao build local (SHA-256
  `7e323dc0e35789d28a0639926d8fef95468f45610c8c8d60e814fb74f5190171`).

## Publicação e reversão

- Hosting publicado: `sites/imobilaria-deccb-painel/versions/f014a69bc247a00f`.
- Hosting anterior: `sites/imobilaria-deccb-painel/versions/c5e4668d1c8f87c5`.
- Regras publicadas: `projects/imobilaria-deccb/rulesets/09682c78-3f3f-4dcc-8019-bd159834d790`.
  Conteúdo relido e idêntico ao arquivo local; SHA-256
  `78f59e09020c6fc8b45c89b9b31450515ddd36917b9a9fc4de13cdaa9c507605`.
- Regras anteriores: `projects/imobilaria-deccb/rulesets/8d4e8e08-5383-447e-ab8e-78a642f99d21`.
- Somente o índice `requests/status ASC, publishedAt DESC` foi criado, pela API, e aguardado até
  `READY`: `projects/imobilaria-deccb/databases/(default)/collectionGroups/requests/indexes/CICAgOi3kJAK`.
- Deploys do CLI restritos a `firestore:rules` e `hosting:painel`, usando `firebase.painel.json` para
  o Hosting. Os demais sites e índices não foram publicados nesta tarefa.

Alterações de código, testes, documentação e este relatório incluídos no commit autorizado pelo usuário em 24/10/2026.
