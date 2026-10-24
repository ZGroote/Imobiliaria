# Pausa da entrada pública do LIV — 24/10/2026

## Causa e correção

O gerente pausou corretamente `properties/liv-ipanema`: `status == inactive`.
A API dos links individuais respeitava esse estado, mas `/maquetes/liv/` e outros
HTMLs eram arquivos estáticos do Hosting e continuavam respondendo 200.

Agora a função existente `conectaTracking` verifica o imóvel e a imobiliária em cada
abertura dos HTMLs públicos. Imóvel pausado, arquivado, sem conteúdo preparado ou agência
inativa recebe HTTP 503 com mensagem de indisponibilidade temporária e `Retry-After: 300`.
Reativar no painel devolve o mesmo HTML no mesmo endereço. As respostas usam
`Cache-Control: private, no-store, max-age=0`. Falhas de leitura também não expõem a maquete.

Foram cobertos os 48 HTMLs existentes de `/maquetes/liv/`, `/liv-classico/`, `/liv-novo/`
e `/b/liv-ipanema/`, incluindo builds anteriores e os aliases de diretório. Os HTMLs
ficam comprimidos no pacote da função e são carregados sob demanda, sem embuti-los no JS.
O preparador e a configuração local ignoram esses HTMLs no Hosting e instalam as rewrites.

O [Hosting prioriza arquivos estáticos sobre rewrites](https://firebase.google.com/docs/hosting/full-config#hosting_priority_order).
Por isso, adicionar apenas uma rewrite mantendo os HTMLs estáticos não resolveria.

## Preservação

- A versão visual atual foi obtida do site publicado; os 48 hashes gzip correspondem
  exatamente aos do inventário anterior. Não foram republicadas fontes visuais pendentes.
- Os outros 561 arquivos foram reutilizados pelo hash no Hosting, sem uploads ou mudanças.
  Fachada, arquivos de verificação, recursos, modelos e módulos continuam iguais.
- Nenhum imóvel foi ligado/desligado por esta execução. O LIV continua `inactive`.
- Papéis e regras do Firestore permanecem iguais: a alteração de visibilidade é do gerente
  da imobiliária. Não foi criada leitura pública direta dos documentos privados.
- Tokens, histórico, builds registrados e segredo `TRACKING_SECRET` versão 2 preservados.
- O painel foi atualizado para explicar que a pausa inclui páginas públicas e links individuais.

## Evidências

- 33 testes Node de HTTP, negócio e empacotamento passaram (32 na execução conjunta e o
  teste adicional de gzip/falha junto com os outros três de publicação pública).
- 6 testes existentes do preparador e 1 teste novo de exclusão/rewrite/idempotência passaram.
- Build do painel e compilação da função passaram. Foi necessário elevar o tempo da descoberta
  local da função; o módulo também foi carregado diretamente, sem erro.
- Em produção, os 48 HTMLs e 4 aliases responderam 503 com a mensagem esperada e `no-store`.
  A fachada respondeu 200 e a API privada continuou exigindo autenticação (401).
- Os 561 hashes dos recursos estáticos foram relidos e continuam idênticos.
- Navegador no endereço informado pelo usuário mostrou “Publicação temporariamente indisponível”.
  Captura em `tmp/liv-publico-pausado.png`.
- A reativação foi testada localmente; o imóvel real foi mantido desligado.

## Implantação e recuperação

- Hosting anterior: `sites/imobilaria-deccb-miniaturas/versions/b9b9cbc3ef3b9c2f`.
- Hosting atual: `sites/imobilaria-deccb-miniaturas/versions/58cc1ce656702125`.
- Função ACTIVE: `conectatracking-00014-til`; anterior `conectatracking-00013-paj`.
- Backups, HTMLs originais, inventários e resultados: `publicacao/qa-pausa-publica-20261024/`.
- O Hosting foi atualizado via API a partir do inventário publicado, removendo apenas os HTMLs
  da entrega estática e adicionando as quatro rewrites. Isso preservou os recursos de outras
  conversas que estavam no ar e ausentes/desatualizados no payload local.
- Republicar a versão anterior do Hosting restaura a entrega estática e desfaz o bloqueio
  público; não usar esse rollback sem considerar essa consequência.

O controle é de abertura de páginas. Conteúdo já aberto ou previamente baixado não pode ser
recolhido do navegador; abas já abertas precisam recarregar. Recursos estáticos não foram
apagados nem transformados em arquivos privados.

## Versionamento

Alterações em `conecta/preparar.py`, `conecta/README.md`, `rastreabilidade/publicacao-publica.mjs`,
`rastreabilidade/functions/build.mjs`, `rastreabilidade/functions/index.mjs`,
`painel/src/components/publicacao.tsx`, `tasks/painel/proposta.md`,
`tests/test_publicacao_publica.mjs`, `tests/test_publicacao_publica_preparo.py` e este relatório.
Estas alterações e os ajustes anteriores desta conversa estão incluídos no commit autorizado
pelo usuário em 24/10/2026. O trabalho pendente de outras conversas foi preservado fora desse commit.
