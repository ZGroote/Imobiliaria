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

## Página completa

`site/maquete-laranjeiras.html` (antes `maquete-liv-ipanema.html`) abre a maquete com o painel, a seleção
de apartamento, a ficha, a planta 2D e o relógio do sol. Abre em
`http://localhost:8765/experimentos/laranjeiras-2026-10-30/site/maquete-laranjeiras.html`.

- **Textos:** nome, endereço, incorporadora, plantas e áreas do Laranjeiras. A ficha mostra torre, pavimento,
  final, área do book (o térreo inclui o jardim), 2 quartos e 1 banheiro, e o lado da fachada.
- **Planta 2D:** `interiores/gerar_plantas2d.py` gera `site/plantas2d/` (imagem do book, recorte, régua,
  medidas e entrada) a partir dos mesmos `planta.json` do construtor; `tipologias.js` lê `plantas2d/dados.js`.
- **Dados do LIV desligados:** a tabela comercial está "ausente" (sem preço nem situação), não há `vinculos.json`
  (a planta de cada final vem do cadastro, pela implantação do book), o estoque ao vivo continua desligado,
  e o link do mapa segue oculto (o mapa ainda é o do LIV).
- **Edição única:** só a `base`; o acabamento `referencia` do LIV saiu, e a cor vem do modelo.
- **Cache de preparação desligado:** o service worker do LIV só entrega arquivos listados num
  `transfer-manifest.json` próprio e bloqueava `plantas2d/`. `transfers.js` agora não registra o worker e solta
  um registro antigo deste escopo. Para religar, é preciso gerar o manifesto do Laranjeiras.
## Interiores (Planta 3D e Tour)

```
python experimentos/laranjeiras-2026-10-30/interiores/gerar_pacote.py
```

O pacote segue o modo `native-factories` do LIV, o mesmo do Meio dele com luz dinâmica. O interior é
montado no navegador a partir do `unidade.json`, com os materiais, móveis e fábricas compartilhados do LIV
(`site/interiores/shared/`, copiados sem alteração e conferidos pelo hash). Depois do bake por hora (abaixo), a
planta abre pela fonte congelada com a luz do Cycles; a montagem pelas fábricas fica só para exportar a fonte.

Na cópia do interior:

- **Móveis aprovados do LIV** (`interiores/melhorias/`, 45 MB em GLB, fora do git também no LIV) são lidos
  da pasta do LIV no ambiente local. Na tipologia `canto`, o LIV punha cada móvel na posição em que foi
  desenhado no Canto dele; aqui todo móvel segue o cadastro do Laranjeiras e encosta na parede. As decorações
  (livros, fruteira) ficam desligadas, porque têm coordenadas do apartamento do LIV.
- **Sol por apartamento:** o giro do terreno é −152° (no LIV era 120°). O lado do apartamento é a direção real
  da fachada (`±x`/`±z`), e o giro do interior leva essa direção até a fachada da planta (canto em −Z, meio em −X).
  Os finais espelhados usam a planta sem espelho: a fachada fica certa, mas esquerda e direita trocam.

Testado no navegador: canto e meio em Planta 3D (15 móveis aprovados trocados, 3 acabamentos, sem aviso) e o
Tour aberto pela página (Torre 03, 7º pavimento, final 05).

### Luz gravada por hora (Cycles)

Mesmo caminho do Canto e do Meio do LIV (`liv-luz-natural-2026-10-26/bake-luz-horario.py`): o céu e o rebatimento
de cada hora vêm do Cycles; o sol direto continua em tempo real, com a irradiância medida no Cycles. Da raiz:

```
python experimentos/laranjeiras-2026-10-30/interiores/luz/exportar_fonte.py
node experimentos/laranjeiras-2026-10-30/interiores/luz/chaves.mjs
C:/Python314/python.exe v1.5/miniaturas/liv-ipanema/interior/preparar_luz.py --source experimentos/laranjeiras-2026-10-30/interiores/luz/canto/source.json --out experimentos/laranjeiras-2026-10-30/interiores/luz/canto/bake --size 1024
python experimentos/laranjeiras-2026-10-30/interiores/gerar_pacote.py
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend --python experimentos/laranjeiras-2026-10-30/interiores/luz/bake_horario.py -- --tipologia canto
C:/Python314/python.exe experimentos/laranjeiras-2026-10-30/interiores/luz/empacotar_horario.py canto
```

(o `preparar_luz.py` e o bake repetem para `meio`; o Python 3.14 do usuário tem o xatlas e o OIDN.)

- **Fonte congelada:** `exportar_fonte.py` monta a planta pelas fábricas no navegador (com o catálogo de móveis
  aprovados vazio na rota) e grava a cena de autoria em `interiores/luz/<planta>/source.json`. Sai igual byte a
  byte quando repetido. Os móveis do cadastro e o alumínio ficam fora do atlas e leem as sondas, como no LIV; no
  bake, os móveis trocados saem e entram os aprovados (`moveis-site.glb`, cor média de cada textura), e a porta de
  entrada é gravada fechada.
- **Quatro lados:** cada apartamento olha para `±x` ou `±z` da cena. São 7 horas (6h a 18h, de 2 em 2) por lado,
  mais a noite: 29 chaves por planta. O site escolhe as chaves pelo lado do apartamento aberto.
- **No site:** com a fonte e o UV1 prontos, `gerar_pacote.py` passa a planta para `frozen-source` com
  `lighting: 'time-rgbm'`. O `interior-renderer.js` dessa cópia aceita esse modo sem o atlas estático e sem o
  topo de parede unificado do LIV (os dois são perfis das fontes do LIV).
- **Fora do git, como no LIV:** a fonte, os brutos do Cycles, o `.glb` dos móveis e os `.gz` do site. Ficam no
  git o `manifest.json` da luz e o catálogo.
- **Manchas (01/11):** duas causas, as duas fora do Cycles.
  - *Contornos em degrau em toda parede, em toda hora:* o site filtrava (bilinear do hardware) o RGBM ainda
    codificado; onde o multiplicador muda entre texels vizinhos a média sai errada. Agora o atlas vem em
    `NearestFilter` e `createTimeIrradiance` (material-rgbm.js) lê os 4 texels, decodifica e só então mistura.
  - *Faixa empelotada ao lado das esquadrias (batente, verga):* o OIDN filtra o atlas inteiro e, na ilha estreita
    (13 cm = 2-4 texels), puxava a luz das ilhas vizinhas. `empacotar_horario.py` suaviza cada ilha só com ela mesma
    depois do OIDN (4 passadas nas largas, 24 nas estreitas) e refaz a borda.

### Plantas espelhadas

`node experimentos/laranjeiras-2026-10-30/interiores/espelhar.mjs` gera `canto-espelhado/` e `meio-espelhado/`
a partir da unidade construída. Pela `posicao()` do modelo, os finais **02 e 07** (canto) e **03 e 06** (meio) são o
espelho da planta do book; 01, 04 e 05 são ela girada. O espelho mantém a fachada (canto espelha em X, meio em Y da
planta), então o giro do sol é o da original e as chaves de luz são as mesmas. A dobradiça de cada porta de giro é a
da original, espelhada e gravada na planta: a regra do construtor desempata pela primeira ponta do vão e, no meio, a
folha de entrada passava a bater na parede (virava vão). No site são duas plantas a mais no catálogo, no seletor e no
cadastro (`relation.typology`); a Planta 2D continua a do book (o desenho tem texto). Cada espelhada tem a sua luz
gravada (29 chaves, ~36 min com o navegador fechado).

### Sombra das outras torres

O sol do interior é em tempo real; a maquete passa, junto com a hora, as outras torres já no referencial daquele
apartamento (`towerOccluders` em viewer.js: caixa da torre menos o centro do apartamento, girada pelo giro do final).
O interior põe caixas que só fazem sombra (`livSolarOccluder`) e o sol fica a 250 m para a sombra alcançá-las.
Conferido na Torre 01, 1º pavimento, final 01: às 15h nada muda; às 17h a mancha de sol some da porta do quarto
(12% da imagem). Limite: o rebatimento do sol já gravado no atlas continua; só o sol direto some.

## SketchUp

`sketchup/modelar_laranjeiras.rb` monta o condomínio no SketchUp 2026 pela extensão MCP, no mesmo caminho
da entrega do LIV (`liv-sketchup-2026-10-26/modelar_liv.rb`). A diferença é que lê o `modelo/modelo.json`, que
tem instâncias, e não a cena com a luz expandida. Cada geometria vira um componente, e cada pavimento de cada
torre é uma instância dele: editar um andar edita todos. Etiquetas: Torre 01, 02, 03 e Implantação. Cenas:
Perspectiva, Implantação (de cima) e Rua José Quatrochi.

```
load '.../sketchup/modelar_laranjeiras.rb'; Laranjeiras.init
Laranjeiras.build(0, 10); Laranjeiras.build(10, 25); Laranjeiras.build(35, 24)
Laranjeiras.scenes; Laranjeiras.save
```

**Apartamento decorado.** O interior do Laranjeiras é montado no navegador, então
`sketchup/exportar_apartamentos.py` abre `interior.html` com o Playwright e exporta a cena de autoria do canto e do
meio pelo `exporter-native.js` do LIV, já com os móveis aprovados no lugar. Ele grava `sketchup/dados/` (cerca de
31 MB por planta, com 86 texturas, fora do git). Precisa do servidor `python -m http.server 8765` na raiz.

```
Laranjeiras.apartamento_init('canto', <x em m>); Laranjeiras.apartamento_build('canto', 0, 120) ...
Laranjeiras.apartamento_init('meio', <x>); Laranjeiras.apartamento_build('meio', 0, 120) ...  # init e build na MESMA chamada
Laranjeiras.apartamento_cena('canto', 4); Laranjeiras.apartamento_cena('meio', 5); Laranjeiras.save
```

O SketchUp apaga grupo vazio no fim da operação. Por isso, o `apartamento_init` e o primeiro `build` de cada planta
vão na mesma chamada. Os apartamentos ficam ao lado do condomínio, com as etiquetas "Apartamento canto/meio" e
"Teto dos apartamentos" (o teto fica oculto). Cada apartamento tem um corte de planta a 1,15 m. Cenas novas:
04 Planta canto e 05 Planta meio.

Saída: `sketchup/entrega/Parque_das_Laranjeiras.skp` (fora do git).

## Publicado em endereço de teste

Em 31/10 foi ao ar em **https://conectaimoveis3d.com.br/laranjeiras/** (sem link no site, `noindex`, sem estatística),
pelo `publicacao/qa-laranjeiras-20261031/hosting.mjs` (preflight → prepare → deploy → verify): só acrescenta
`/laranjeiras/` e confere que os outros 1.207 arquivos do site ficaram iguais. Hosting `ae02e90c16116e89`
(anterior `413e94e1dca58ef4`, para voltar). Republicar = pacote novo + um `hosting.mjs` que troca só `/laranjeiras/`.

## Pacote para publicar

```
node experimentos/laranjeiras-2026-10-30/publicar/preparar_pacote.mjs
```

Gera `publicacao/laranjeiras-<data>/payload/laranjeiras/` (fora do git) com tudo dentro, no mesmo caminho do
`otimizar_publicacao.mjs` do LIV:

- o JS das três páginas juntado e minificado pelo esbuild, com o three dentro do pacote;
- o CSS embutido na página;
- a cena, o atlas de luz e o cadastro em `assets/`;
- os móveis aprovados que o catálogo usa, conferidos pelo SHA;
- `noindex` em todas as páginas e `index.html` igual à maquete.

Os caminhos que no desenvolvimento apontam para a pasta do LIV (o three e os móveis) passam a apontar para
dentro do pacote. Ao lado do pacote fica `inventario.json`, com o tamanho e o SHA de cada arquivo.

Com a luz gravada por hora dos interiores (101 MB das duas plantas), o pacote de 31/10 passou a ter 263 arquivos
e 177,9 MB; servido sozinho, a maquete e o Tour do meio abriram com a luz gravada e os 15 móveis aprovados, sem
pedido fora de `/laranjeiras/`. Antes da luz por hora, o pacote tinha 141 arquivos e 70,5 MB. Servido da própria pasta (`.claude/launch.json`,
`laranjeiras-pacote`, porta 8796), abriu a maquete com os 312 apartamentos e o Tour com os móveis aprovados, sem
nenhum pedido fora de `/laranjeiras/`.

## Próximos passos

Feitos: enquadramento do Tour, celular, luz por hora gravada, endereço de teste, plantas espelhadas, manchas e
sombra das outras torres. Faltam: mapa do entorno (está oculto), portaria e letreiro; na sombra de outra torre o
rebatimento do sol gravado continua (separar o sol do céu no bake dobraria as chaves); as portas a4 e a5 do meio
ficam paradas (a folha não se separa da esquadria, já era assim).
