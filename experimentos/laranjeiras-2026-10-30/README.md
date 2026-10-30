# Parque das Laranjeiras — segundo prédio no molde do LIV

Branch `feat/predio-novo`. Fonte única: o book da ADN (`plantas_fornecidas/parque-das-laranjeiras/`).

## Plantas (feito)

As quatro plantas do book foram traçadas pela API real do construtor de plantas do painel, pelo mesmo
caminho do Meio do LIV (`liv-experimental-2026-10-14/interiores/meio/construir-meio.ts`). A diferença é
que os pontos ficam em `interiores/<tipologia>/planta.json`, e um script só serve para todas:

```
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts meio
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-meio
```

Cada um grava `leitura.json`, `projeto-planta.json`, `moveis.json`, `contexto.json`, `referencia.json`,
`unidade.json` (o arquivo que o interior do LIV lê) e `conferencia.jpg` / `conferencia.json`: contornos,
vãos e móveis desenhados por cima da imagem do book. As quatro saem `PASS`, ou seja, todo móvel fica
dentro de um cômodo e nenhum se sobrepõe a outro, fora as cadeiras sob a mesa.

| Planta | Área do book | Escala da imagem | Cômodos / portas / janelas / móveis |
|---|---|---|---|
| canto | 39,12 m² | 184,2 px/m | 5 / 5 / 4 / 23 |
| meio | até 40,79 m² | 159,1 px/m | 5 / 5 / 4 / 22 |
| terreo-canto | 60,11 m² | herda o canto | igual ao canto + jardim em L de 22,4 m² |
| terreo-meio | até 54,17 m² | herda o meio | igual ao meio + jardim de 14,5 m² |

Como cada coisa foi aproximada:

- **Escala:** a planta é humanizada e não tem cota. A área das faces internas do contorno foi igualada
  à do book. Vaso e cooktop conferem a escala (184–188 px/m no canto, 157–172 no meio).
- **Térreo:** é o apartamento do tipo. As paredes pretas das duas imagens coincidem
  (`terreo-*/comparacao-tipo.png`). O jardim fica em `referencia.json` como polígono em metros, para a
  maquete externa, e não vira cômodo, porque cômodo ganha parede de 2,60 m.
- **Portas e janelas:** lidas no desenho (folha fechada com maçaneta, rasgo na parede preta). A largura
  sai da imagem; a altura segue o padrão do LIV.
- **Móveis:** do catálogo do construtor, no lugar e na medida do desenho. Os guarda-roupas seguem o book
  ("até 1,50 m"). A churrasqueira e a bancada comprida do meio ficaram de fora, porque o catálogo não tem.

## Implantação e posição no mapa (feito)

```
python experimentos/laranjeiras-2026-10-30/implantacao/montar.py
```

`implantacao/implantacao.json` guarda o que foi lido na implantação do book, em pixels: lote em L,
3 torres com os finais 01–08, 6 vias, 11 áreas de vaga e os 14 itens de lazer, mais apoio e reservatório.
O script grava `implantacao-m.json` em metros e em latitude/longitude, e `conferencia.jpg` com tudo
desenhado por cima do book.

O terreno fica do lado de cá da avenida, atrás do LIV Ipanema: é o campo cercado na Rua José Quatrochi,
entre a obra de terra vermelha (na esquina da rotatória) e as casas. Quina norte em
−21,988808, −47,923926. A foto aérea do book confirma a vizinhança (obra ao lado, avenida à esquerda),
e o CNEFE confirma a rua.

- **Rumo:** a rosa dos ventos do book põe o alto da imagem para o SSE. Ajustei 5° para a frente correr
  junto com a rua (rumo 152°).
- **Escala: 13,2 px/m.** É a que faz o L caber na quadra 608 do cadastro, com a frente até a rua do
  sudoeste e o fundo até os quintais das casas. Duas medidas independentes conferem: vaga de 4,5 m de
  comprimento, e 285 vagas contadas nas fileiras desenhadas contra 290 no book.
- **O que não fecha:** nessa escala o lote dá 10.672 m², contra 11.894 m² no book (12,5 px/m). A ponta do
  braço do estacionamento passa ~8 m sobre um galpão branco que aparece na foto de satélite.
- **Torres:** montadas pelo tamanho real das plantas, centradas onde o book as desenha. A ala tem
  canto 6,35 m + meio 8,2 m. O fundo são duas fileiras de 6,5 m mais um corredor de 1,3 m. Com o núcleo
  de 4 m, a torre fica com 33,1 × 14,3 m, cerca de 10% maior que o desenho do book. A Torre 02 é girada 90°.
  Os cantos são os finais 01, 02, 07 e 08; os meios, 03 a 06.

A sobreposição no satélite (Esri World Imagery) serviu só para medir e não está no git.

## Modelo 3D por fora (primeira passada)

```
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python experimentos/laranjeiras-2026-10-30/modelo/modelar_laranjeiras.py -- [--no-render]
```

O modelo segue o mesmo caminho do LIV (`v1.5/miniaturas/liv-ipanema/modelar_liv_ipanema.py`) e usa as
mesmas ferramentas: `blender_maquete_base` (caixa, material, exportação para `modelo.json` e GLB) e, da
implantação do LIV, árvore, palmeira e carro.

- **A fachada sai das plantas.** Cada andar coloca as 8 plantas do book no lugar dos finais. Os cantos
  (01, 02, 07, 08) ficam nas pontas, e os meios (03 a 06) junto do núcleo, com a fachada no lado
  comprido. As plantas são espelhadas e giradas conforme o final. As paredes e janelas de cada cômodo
  viram as paredes e janelas da torre. Uma grade de 10 cm diz o que é fachada (não há nada do outro
  lado) e o que é parede interna. É daí que saem o recuo do quarto do meio e o H com o núcleo recuado.
- **Varanda:** a janela-guarda-corpo vira vão aberto com guarda-corpo branco, e a varanda leva a faixa
  cinza-escuro dos renders. O núcleo leva o friso vermelho.
- **Terreno:** sai de `implantacao-m.json`: gramado no L, vias com guia, 285 vagas com carros, árvores a
  cada 3 vagas e nas divisas, lazer (quiosques, vestiários, piscina, playground, pet), reservatório,
  muro de 2,2 m nas divisas e mureta com gradil na frente.
- `preview-aerea.jpg`, `preview-piscina.jpg` (do mesmo ponto do render da piscina do book) e
  `preview-rua.jpg`. O `.blend`, o GLB e o `modelo.json` são gerados e ficam fora do git.

Falta neste passo: os jardins privativos do térreo, a cor final (ela é ajustada no visualizador, como
no LIV), a portaria com o letreiro e os detalhes do lazer.

## Luz do exterior e visualizador WebGPU (cópia do LIV)

Os scripts de luz do LIV são genéricos e rodam sobre o `modelo.json` do Laranjeiras:

```
python v1.5/miniaturas/liv-ipanema/preparar_luz.py --model experimentos/laranjeiras-2026-10-30/modelo/modelo.json --out experimentos/laranjeiras-2026-10-30/modelo/luz --size 4096
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out experimentos/laranjeiras-2026-10-30/modelo/luz --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out experimentos/laranjeiras-2026-10-30/modelo/luz --output-guard 4
python experimentos/laranjeiras-2026-10-30/modelo/exportar_cena.py
```

Medido em 30/10: o UV de luz teve 863 instâncias, 211 mil triângulos e 78% de aproveitamento do atlas
de 4096². O bake levou 106 s (OptiX, 64 amostras) e o tira-ruído 24 s (OIDN).

`modelo/exportar_cena.py` faz em Python o que no LIV passava pela página antiga e pelo Playwright
(`liv-lightmap.js` + `exportar_cena.py`). Ele grava `assets/scene.json.gz` (4,8 MB), `irradiance.rgbm.gz`
(18,2 MB) e `manifest.json` no formato `liv-exterior-proof-v1` que o `renderer.js` do LIV lê. São 55 malhas,
42 delas com luz gravada. `assets/` e `modelo/luz/` são regeráveis e ficam fora do git.

`site/` é a cópia do código da página do LIV (sem testes, QAs nem dados grandes). Até aqui mudou:

- `edicoes.js`: a edição base aponta para `../assets/` e ainda não tem cadastro de finais (`units: null`).
- `renderer.js`: sem cadastro de finais, a maquete abre sem seleção de apartamento.
- O letreiro do telhado do LIV (`marca-telhado.webp`) foi removido.
- Os importmaps usam o three da pasta do LIV (`../../liv-experimental-2026-10-14/node_modules/three/`).

Com o servidor na raiz do repositório (`python -m http.server 8765`), o exterior abre em
`http://localhost:8765/experimentos/laranjeiras-2026-10-30/site/prova-rgbm.html`. Testado em WebGPU, sem
erro no console.

## Os 312 apartamentos clicáveis

O modelador grava, nos metadados do `modelo.json`, a caixa de cada final no andar e a posição das torres.
O `exportar_cena.py` gera `assets/unidades.json` (schema `laranjeiras-units-v1`) com o mesmo
`sourceModelSHA256` da cena: 3 torres × 13 pavimentos × 8 finais. Cada apartamento tem torre, pavimento,
final, planta (canto ou meio), área do book (térreo com o jardim) e o lado da fachada (`torre-02:+x`).

O cadastro do LIV era fixo: uma torre, 17 pavimentos, 10 finais, espaçamento de 2,85 m. Na cópia mudou:

- `unidades.js` e `catalogo-unidades.js`: validador e carga do cadastro novo; os pavimentos vão de 0 a 12.
- `picking.js`: uma caixa de clique por torre. Só a primeira torre atingida escolhe, e corredor, núcleo e
  recuo não têm final.
- `cameras.js`: `towerFacadeView` enquadra a face de qualquer torre (±x ou ±z); a Torre 02 é girada.
- `renderer.js`, `viewer.js`, `unit-ui.js`: andares 0–12; a ficha mostra torre e lado da fachada.

Conferência: `node --test experimentos/laranjeiras-2026-10-30/site/test_cadastro.mjs`.

## Próximos passos

A página completa (`maquete-liv-ipanema.html`) com os textos, o estoque e o mapa do Laranjeiras;
interiores; luz por hora; celular; publicação em endereço de teste.
