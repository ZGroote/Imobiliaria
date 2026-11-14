# Controle de publicação dos imóveis

Atualização posterior: visibilidade exclusiva do gerente da imobiliária, com chave cinza/verde.
Consulte `publicacao-gerente-2026-10-24.md` para o estado atual.

Publicado em 24/10/2026 às 12:57 (America/Sao_Paulo).

## Comportamento

- Administrador encontra **Retirar do ar** / **Colocar no ar** na lista de imóveis e na ficha.
- A ação usa transação para alternar `properties.status` entre `inactive` e `active`, com AuditLog.
  Repetir uma ação já aplicada não duplica o log. Operador e imobiliária não alteram essa
  disponibilidade de conteúdo preparado; as regras exigem administrador e auditoria atômica.
- O serviço de links individuais já revalida o estado em toda abertura e encaminhamento.
  Pausar bloqueia essas aberturas; reativar recupera os mesmos endereços. Não se revogam tokens,
  não se muda o build e não se altera o prazo de 48h dos pedidos no Kanban.
- Continuam valendo as regras próprias de revogação e expiração de cada link. A ação não altera
  os arquivos estáticos e as entradas públicas independentes dos links individuais do painel.
- Quando o imóvel está fora do ar, sua ficha explica a pausa e preservação dos links, sem tentar
  carregar a API privada de links enquanto o imóvel está inativo.
- Conteúdo ainda não preparado mostra o motivo e acesso às solicitações aprovadas. Uma publicação
  convencional marca `publicationReady: true` junto com o registro do build aprovado.

## Estado dos registros existentes

Foram alterados somente `publicationReady` e `updatedAt`, com precondição de `updateTime`, backup
e AuditLogs internos. Todos os demais campos foram comparados antes/depois e permaneceram iguais.
Nenhum imóvel foi pausado ou reativado em produção durante esta validação.

- `liv-ipanema`: marcador verdadeiro. Tour e maquete do build `66a70f0c7a53` responderam HTTP 200
  no domínio oficial. O registro avulso do servidor continua sendo a fonte do build; não foram
  adicionados `pipelineUnitId` nem `publishedBuild` ao documento, preservando futuras atualizações.
- `5ySrUXgiIQVkNF6GffiL` (Monte dos Cedros): marcador falso. O Hosting
  `imobilaria-deccb-imoveis` foi desativado em 04/10/2026 (`SITE_DISABLE`); os endereços antigos
  estão indisponíveis. O selo antigo refletia somente metadados históricos. Voltar ao ar exige
  preparar e publicar conteúdo novamente. O site antigo não foi reativado nesta tarefa.

O contador do painel consulta `agencyId`, `status == active` e `publicationReady == true`.
Em produção, retornou **1**, correspondente ao LIV.

## Verificação

- Suíte do painel: 77 testes aprovados.
- Depois da validação do caso de Hosting antigo desativado: 51 testes aprovados, sendo 44 de
  regras e 7 focados em publicação/contador (esses 7 também pertencem à suíte do painel).
- Integração com o serviço real de rastreabilidade no emulador: link raiz e encaminhamento abrem;
  ambos retornam 410 durante a pausa; os mesmos tokens voltam a abrir o mesmo conteúdo ao reativar.
  Os documentos dos links foram comparados e permaneceram idênticos.
- Typecheck e build de produção aprovados. Diff sem erros de whitespace.
- Navegador: ações exercitadas na lista e na ficha, com atualização ao vivo e sem erros no console.
  Capturas locais em `tmp/publicacao-controles.png` e `tmp/publicacao-pausada.png`.
- HTML da lista e os dois bundles de controle servidos pelo domínio oficial foram comparados com
  os bytes do build local; todos idênticos. Regras relidas da API e idênticas ao arquivo local.

## Implantação e recuperação

- Hosting atual: `sites/imobilaria-deccb-painel/versions/2f52f171f192be72`.
- Hosting anterior: `sites/imobilaria-deccb-painel/versions/f014a69bc247a00f`.
- Regras atuais: `projects/imobilaria-deccb/rulesets/731f84b8-41b3-410e-a03f-04305ad982fb`.
  SHA-256: `213afc6d3fe1e5016b386d8624ceab3205488f32f07a454484238f1c1e31197b`.
- Regras anteriores: `projects/imobilaria-deccb/rulesets/09682c78-3f3f-4dcc-8019-bd159834d790`.
- Único índice criado: `properties/agencyId ASC, status ASC, publicationReady ASC`, aguardado até
  `READY`: `projects/imobilaria-deccb/databases/(default)/collectionGroups/properties/indexes/CICAgNi4o4sK`.
- Backups e verificação: `publicacao/qa-controle-publicacao-20261024/`, ignorado pelo Git.
  Para desfazer o preenchimento dos marcadores, usar os valores anteriores com nova conferência
  de `updateTime`, preservando qualquer mudança posterior. Não restaurar documentos inteiros.
- Deploy restrito a regras e Hosting do painel. Funções, segredos, papéis IAM e os demais sites
  não foram publicados nem alterados.

Alterações desta conversa incluídas no commit autorizado pelo usuário em 24/10/2026. Arquivos de outros trabalhos foram preservados.
