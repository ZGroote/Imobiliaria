# Motor e dados (MG-1, 21/10/2026)

Primeiro passo da [maquete geral](../../tasks/painel/maquete-geral.md): a estrutura do LIV vira a
maquete de todo imóvel. Aqui o motor foi separado dos dados do LIV, sem mudar o que a maquete mostra.

## O que é o quê

- **Dados do imóvel** (`dados/`):
  - `maquete.js`: nome, página, mapa, edições do exterior, prédio, cadastro das unidades, lados da
    fachada, tipologias, vistas próprias e acabamentos. É um módulo, e não um JSON, para carregar igual
    no navegador (inclusive Safari antigo), nos testes do Node e no otimizador da publicação;
  - `topos-de-parede.js`: os contornos de topo de parede por tipologia (gerado por
    `gerar_topos_paredes.py`).
- **O motor**: os módulos que `viewer.js`, `renderer.js`, `interior-renderer.js`, `mapa-retorno.js` e as
  páginas internas (`interior.html`, `prova-rgbm.html`) carregam, e os dois ajudantes em paralelo
  (`decodificar-worker.js` e o service worker `transfer-worker.js`, que só prepara o que
  `dados.transferencias` e as edições permitem). Eles leem `dados/` e não têm nome,
  medida, caminho nem número de imóvel nenhum.
- `test_motor_sem_dados.mjs` segue esses módulos e falha se achar dado do LIV neles.

## O que ficou de fora, dito com clareza

- **O leitor do estoque** (`estoque-runtime.js`) é gerado a partir do modelo de estoque do painel
  (`painel/src/lib/estoque-modelo.ts`), que ainda descreve só o prédio do LIV:
  - o `salesInventory` `liv-sales-v1`, com 170 posições, também nas regras do banco;
  - generalizá-lo é do painel e das regras, num passo próprio;
  - a imobiliária usa a vitrine ao vivo no lugar dele.
- **A página de entrada** (`maquete-liv-ipanema.html`) e o **mapa de 5 km** continuam sendo do LIV. São a
  página e o mapa deste imóvel. A página genérica, gerada a partir dos dados, é dos passos MG-3 e MG-5.
- **O prefixo técnico `liv`** dos nomes internos (`__livProva`, `__livInterior`, eventos `liv-*`, esquemas
  `liv-*-v1`, a chave `liv-viewer-v1` das preferências salvas) ficou. É o nome do motor, não dado do
  imóvel: trocar mudaria os manifestos e apagaria as preferências de quem já visitou.

## A prova

- **Testes:** os de JavaScript ficaram com 120 de 125 (os 118 de antes, mais os 2 novos). As 5 falhas
  são as mesmas de antes e pedem arquivos de autoria que não estão neste computador (`.liv-reproducao-*`,
  `modelo/variante/modelo.json` do experimento original).
- **Imagens:** a maquete foi fotografada antes e depois em 14 cenas no Chrome com a placa de vídeo:
  - as 7 vistas;
  - um apartamento selecionado;
  - Planta 2D, Planta 3D e Tour do Canto e do Meio.

  No **WebGPU**, as 14 são idênticas pixel a pixel. No **WebGL**, 13 são idênticas. Na vista "Varandas"
  2 pixels variam até 1 tom, e variam também entre duas rodadas do mesmo código.

## Na próxima publicação do liv-clássico

O pacote publicado precisa levar a pasta `dados/`:

- o otimizador já embute `dados/maquete.js` no pacote do `viewer.js` e do `renderer.js`;
- o interior e as outras páginas usam os módulos soltos, e importam `dados/maquete.js` e
  `dados/topos-de-parede.js` direto.
