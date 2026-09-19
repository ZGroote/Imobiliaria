# O pipeline, do arquivo baixado ao HTML

Este arquivo responde a uma pergunta só: **o que foi baixado, como foi tratado, e em
que ordem** — para que a segunda cidade não repita a arqueologia da primeira.

`PADRAO.md` é o contrato (as regras e os portões). Aqui estão os passos.

    python pipeline/rodar.py --listar     # a tabela e o que está velho
    python pipeline/rodar.py              # roda o que está velho, sem tocar na rede
    python pipeline/rodar.py --rede       # inclui as etapas que baixam
    python pipeline/rodar.py --de 2 --ate 9
    python pipeline/rodar.py --carimbar   # adota a árvore atual como boa, sem rodar

---

## 1. As fontes: o que foi baixado, e o que cada uma serve

Cinco fontes, com papéis que **não se sobrepõem**. Confundi-los foi a origem da maior
parte do retrabalho.

| fonte | o que é | o que ela é boa pra dar | o que ela NÃO dá |
|---|---|---|---|
| **Overture Maps** | 126k footprints (75 MB) | onde existe construção | divisa de lote; 1 casa = 3 polígonos |
| **OSM / Overpass** | ruas, nomes, `building:levels` | a malha viária e o nome próprio | cobertura de edificação (só ~4,5k casam) |
| **SigaSC `quadras_pol`** | 3.373 quarteirões | o polígono da quadra oficial | **não cobre a cidade toda** |
| **SigaSC `enderecamento`** | 54k pontos de endereço | prova de que o lote é construído | geometria de lote |
| **OpenPlots** (plantas) | 265 plantas urbanísticas | o **tamanho** do terreno por bairro | georreferência (a planta é um JPG) |

A regra que sai disso, e que vale pra qualquer cidade:

> **O Overture diz ONDE tem casa. A planta diz QUANTO mede o terreno. A quadra diz
> ONDE ele cabe. O endereço diz SE está construído.** Nenhuma delas sozinha faz o mapa.

### 1.1 Overture — `overture_buildings.geojson` (75 MB)

    pip install overturemaps
    python pipeline/fontes/overture.py          # usa `bbox` do JSON da cidade

Lendo o arquivo baixado, as fontes internas são `Google Open Buildings` e
`Microsoft ML Buildings` — **telhado detectado por satélite, não cadastro**. Isso
explica todo o comportamento dele no resto do pipeline: casa + garagem + edícula viram
3 polígonos (126k footprints para 54k endereços), vêm tortos e ignoram divisa de lote.
Por isso o v5 em diante parou de desenhar o footprint e passou a assentar casa no lote,
usando o Overture só como **prova de ocupação**.

*(A proveniência do arquivo original deste projeto não ficou registrada; o CLI acima é
o caminho documentado daqui em diante.)*

### 1.2 OSM / Overpass

    python rebuild_city.py            # ruas -> sao-carlos-overture.city.json
    python fetch_osm_buildings.py     # tags  -> osm_buildings_raw.json
    python fetch_osm_pois.py          # POIs  -> osm_pois_raw.json

Baixado em tiles e **retomável** (pula tile já salvo) — o Overpass estoura timeout no
bbox inteiro. A malha viária `r[]` nasce aqui e **não muda em nenhuma versão
posterior**: os 170.822 números do `r[]` são idênticos do v4 ao v8.

### 1.3 SigaSC — o MapServer da prefeitura

WFS e WMS estão trancados (WFS sem `DUMP TRUE`; WMS sem `wms_srs` → `InvalidSRS`).
**Não dá pra pedir vetor por OGC.** O que funciona é o modo nativo CGI, que devolve
PNG transparente — ou seja, toda fonte da prefeitura sai por *raster + visão
computacional*, não por API.

    python pipeline/fontes/sigasc_quadras.py         # quadras_pol   -> quadras
    python pipeline/fontes/sigasc_parcelamentos.py   # parcelamentos -> loteamentos
    python pipeline/fontes/sigasc_enderecos.py       # enderecamento -> pontos

As três usam o **mesmo** `pipeline/fontes/sigasc.py`, em quatro fases: `sonda`
(varre em células de 3 km a 300 px e diz onde tem tinta — o `quadras_pol` acendeu 22
de 132, então renderizar tudo em alta seria 6× o download), `tiles` (2048 px,
retomável), `mosaico` (máscara de cor + maxpool + costura) e então `faces` (layer
desenhado a linha: a feição é o **vão entre** as linhas) ou `pontos` (blob → centroide).

Eram sete scripts de scratchpad com a mesma conta escrita sete vezes. Agora é um
módulo e três configurações de ~40 linhas.

**Quatro armadilhas, todas já pagas:**

- **Projeção.** O mapfile rotula `zone=21`, mas o dado está em **UTM 23S** (easting
  ~200k, northing ~7554k). Reprojetar como **EPSG:29193** encaixa. Errar aqui não dá
  erro — dá cidade deformada.
- **Dilatação 4 px, não 2.** Com 2, polígono grande e alongado vaza por gaps de ~4 px
  nas emendas de tile e cai no fundo. Foi assim que o Santa Angelina sumiu. Dilatar
  fecha o gap; `distance_transform_edt` devolve a área que a dilatação comeu.
- **`enderecamento` tem MAXSCALE 5000.** Ele não desenha em célula de 3 km; some. Os
  tiles dele são de 1.500 m — 4× as requisições.
- **O layer pode simplesmente não ter dado, e o PNG volta igual a "fora de escala".**
  Sondado no extent do Jardim Araucária: `quadras_pol` 0,34% de pixel (respingo do
  vizinho), `enderecamento` **0,00%** — contra 1,73% e 1,26% no controle do Jardim
  Embaré. Antes de concluir que a raspagem ficou curta, **sonde e compare com um bairro
  que você sabe que existe.**

### 1.2b Em lote: extract do Geofabrik, não Overpass

Para UMA cidade o Overpass serve. Para vinte, não: o pipeline faz ~60 consultas de
tile por cidade, e **medido em 2026-08-29 ele devolve `HTTP 429` já na quarta consulta
seguida**. Além de não terminar, 1.200 consultas pesadas contra um serviço comunitário
gratuito é abuso de recurso alheio.

    # uma vez (856 MB, cobre SP/RJ/MG/ES)
    https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf
    # depois, offline, várias cidades numa tacada:
    python pipeline/fontes/osm_extract.py ribeirao-preto sorocaba sao-jose-do-rio-preto

O extractor emite exatamente o formato que o Overpass devolveria (`out geom;` /
`out center;`), então **nada a jusante muda** — o `rebuild_city.py` passou a preferir o
arquivo local quando ele existe.

**Três coisas que custaram tempo aqui:**

- **O Geofabrik não divide o Brasil por estado.** Só em 5 regiões; não existe
  `sao-paulo-latest.osm.pbf`. A URL de estado devolve uma página de erro de 9 KB, não
  um 404 — dá pra confundir com download vazio.
- **`locations=True` do pyosmium não serve aqui.** Ele constrói o índice de posição dos
  ~150 M nós do Sudeste inteiro; ficou 10 min sem sair do lugar. O extractor faz duas
  passadas próprias e só indexa os nós que caem nas caixas pedidas.
- **O gargalo é a fronteira Python, não o handler.** Medido: 0,27 M nós/s, e
  `SimpleHandler` e `FileProcessor` dão o mesmo número — não adianta trocar de API. Uma
  passada no Sudeste custa ~10-18 min, e é por isso que o script aceita VÁRIAS cidades:
  o custo é pago uma vez, não uma vez por cidade.

### 1.2c A ficha da cidade nova

    python pipeline/nova_cidade.py "Ribeirao Preto" SP -21.1775 -47.8103         --bbox -47.90 -21.29 -47.66 -21.08

Copia a ficha de uma cidade modelo (Araraquara — a que **não** tem dado de prefeitura,
que é o caso comum) e decide sozinho o **fuso UTM** pela longitude do centro:
`zona = floor((lon+180)/6)+1`, e SIRGAS 2000 / UTM zona S = `EPSG:319<60+zona>`.
Validado: Rio Preto (−49,38) caiu em EPSG:31982 (zona 22) e Sorocaba (−47,45) em
EPSG:31983 (zona 23), sem intervenção. Errar o fuso não dá erro — dá cidade deformada.

### 1.4 OpenPlots — as plantas urbanísticas

    python baixar_openplots.py                 # 265 plantas (retomável)
    python v7/pipeline/rodar_tudo.py           # vetoriza + georreferencia, 1 subprocesso por planta
    python v7/pipeline/consolidar.py           # arbitra por quadra -> lotes_oficiais
    python v7/pipeline/filtrar_confiaveis.py   # aplica o gabarito  -> lotes_planta
    → v7/dados/lotes_confiaveis_saocarlos.geojson (21.163 lotes em 67 bairros)

> **Buraco fechado nesta passagem.** Os dois últimos gravavam na **raiz** enquanto o
> resto do pipeline lia de `v7/dados/` — alguém movia o arquivo à mão entre uma etapa e
> a outra, e isso não aparecia em lugar nenhum. Agora o destino sai do JSON da cidade,
> igual ao resto.

A planta é um JPG **sem georreferência nenhuma**. Ela é vetorizada, encaixada na quadra
oficial e submetida a exame. **A planta é o gabarito**: lote fora do tamanho padrão da
própria planta não é lote, é erro de extração, e sai.

O contrário também vale, e custou uma rodada: a planta é georreferenciada por planta
inteira mas **erra por quadra** — uma planta com encaixe 0,99 pode estar 42° fora num
quarteirão específico. Daí o exame da etapa 4.

### 1.5 open-elevation — o relevo

    python pipeline/fontes/relevo.py      # 80x80, ±9,5 km

Reproduz exatamente o que o `fetchElevation()` faz no navegador, pra o embutido ser
indistinguível do que a página baixaria. Precisa ser **embutido** porque em `file://`
um fetch é cross-origin de origem opaca: sem isso o botão Relevo morre justamente na
versão de duplo clique.

**A grade era ±5,5 km e a periferia ficava fora dela** — o `terrainY` extrapolava e o
chão saltava. Cidade nova: meça o bbox das quadras antes de escolher `HALF`.

---

## 2. O tratamento: das fontes ao `city_base`

| etapa | script | entra | sai |
|---|---|---|---|
| 0a | `merge_osm_overture.py` | overture + tags OSM | `sao-carlos-overture-v2.city.json` |
| 0b | `build_blocks.py` | city v2 | `blocks.json` (4.457 faces) |
| 0c | `v4/build_city_v4.py` | city v2 + blocks | `v4/sao-carlos-v4.city.json` |

**0a** é onde o prédio ganha semântica: classe (`0/1` residencial, `2` comércio,
`3` cívico), nome e endereço. Só ~4.528 dos 125.994 casam com o OSM — o resto fica
anônimo, e é por isso que a etapa 7 descarta o footprint anônimo e mantém só o
nomeado.

**0b** extrai as **faces do grafo planar** formado pelas ruas que de fato delimitam
quadra. Essas faces viraram, muito depois, a fonte de quadra da etapa 1b — não era o
objetivo original delas.

**0c** reordena `b[]` agrupando por quadra e emite `bl[] = [cx, cz, raio, início, qtd]`.
É o que permite o streaming por quarteirão (1.281 → 238 draw calls). É seguro porque em
`push_path` os deltas zeram a cada prédio: cada edificação é um bloco independente do
array, então mover blocos inteiros não corrompe coordenada.

> **Otimização aplicada.** O `v3/sao-carlos-overture-v3.city.json` é **cópia byte a
> byte** do v2 (mesmo md5) — o que o v3 mudou foi o HTML. As etapas 0b e 0c liam a
> cópia; agora leem o v2. Verificado: o `blocks.json` sai byte a byte idêntico. Saiu
> uma cópia de 6,7 MB e uma "versão" inteira do grafo de dependência.

---

## 3. Do `city_base` ao HTML

A tabela completa, com contrato de cada saída, está em `PADRAO.md`. O resumo:

    1b  quadras_grafo.py     completa o cadastro com a face do grafo (606 faces novas)
    2   quadras_miolo.py     quadra menos a fita da rua DESENHADA
    3   lotes_sinteticos.py  grade 12x25 caminhando o perímetro do miolo
    4   juntar_lotes.py      planta onde presta, grade onde não presta (exame por quadra)
    5   ocupacao.py          só lote com endereço OU footprint  ← guarda ÍNDICES da 4
    6   gen_muros.py         divisa dos lotes ocupados
    7   build_v7_city.py     volumes; casa recortada pelo miolo
    7b  gen_chao / gen_ruas  chão e asfalto — MESMA lista de quadras da 2
    8   pipeline/montar.py   HTML por concatenação das peças (v13)
    9   padrao/rodar_qa.py   9 portões de geometria + 9 de comportamento; sai 1 se reprovar

### Quanto custa rodar

Medido em 2026-08-29 numa passada completa `--de 1b --ate 9 --forcar`, que reproduziu
os mesmos 74.989 volumes e passou os 7 portões:

| etapa | s | | etapa | s |
|---|---:|---|---|---:|
| 1b quadras_grafo | 41 | | 7 build_v7_city | 76 |
| 2 quadras_miolo | 18 | | 7b gen_chao | 3 |
| 3 lotes_sinteticos | 123 | | 7b gen_ruas | 68 |
| 4 juntar_lotes | 68 | | 8 make_v7 | 0,2 |
| 5 ocupacao | 23 | | 8 make_v8 | 3 |
| 6 gen_muros | 18 | | 9 rodar_qa | 41 |

**Total: 485 s (8 min)** do `city_base` ao HTML aprovado. As etapas de rede (0.x) são
outra ordem de grandeza — horas — e por isso são opt-in e retomáveis.

Duas leituras que valem: o gargalo é a **geometria de lote** (etapas 3+4 = 40% do
tempo), não o render; e o `make_v7`, que produz um HTML de 12,5 MB, leva **0,2 s** —
ele é puro patch de texto sobre uma base de 107 KB, e o peso todo vem dos arquivos que
ele embute.

### As três armadilhas de ordem

Todas já morderam, todas custaram uma rodada de investigação, e todas têm a mesma
forma: **um arquivo que não acompanhou o outro.**

1. **A etapa 5 guarda índices, não ids.** Mexeu na lista de lotes da etapa 4, tem que
   rodar a 5 de novo — senão a casa nasce no lote do vizinho.
2. **A etapa 7 tem que ler a mesma lista de quadras da etapa 2.** Enquanto o
   `build_v7_city` lia o cadastro puro e o miolo já vinha do completo, a quadra nova
   ficava sem ângulo e sem centro: a casa não era snapada ao eixo do quarteirão e
   **11.237 casas eram descartadas por sobreposição** — um bairro saiu com 5 casas em
   99 lotes ocupados.
3. **A etapa 7b idem.** Enquanto chão e asfalto vinham prontos do `v6/`, gerados com as
   quadras antigas, o bairro novo ficava **sem chão** (prédio flutua com o Relevo) e com
   o **asfalto por cima das casas** — porque a rua é `(vão + corredores) − quadras`.

O runner conhece as três: as entradas de cada etapa estão declaradas, e etapa que
quebra **para o pipeline**, em vez de deixar a seguinte ler lixo.

---

## 4. Cidade nova: o que trocar

1. **`padrao/cidades/<slug>.json`** — copie o de São Carlos e troque `crs.utm` (o fuso;
   errar não dá erro, dá cidade deformada), `centro.lat/lon` (**o mesmo valor que o
   renderizador usa** como origem), `bbox`, `vias.largura` se a caixa de rua for
   diferente, `lote.frente_m/fundo_m` e os caminhos em `fontes`.
2. **Quadras (etapa 1)** é a única entrada realmente obrigatória. Se a cidade não tiver
   cadastro aberto, **pule direto pra 1b**: a face do grafo de ruas sozinha já dá
   quadra boa (medido contra o cadastro onde os dois existem: área mediana 9.980 m² ×
   10.091 m², IoU 0,85, 94% da quadra contida na face).
3. **Sem planta oficial**, a etapa 4 cai inteira no sintético e o mapa sai com o terreno
   padrão da cidade — funciona, perde o tamanho por bairro.
4. **Sem prova de ocupação** (endereços e footprints), `ocupacao.py` não tem o que
   fazer: ou o mapa fica vazio, ou volta a pôr casa em todo lote — que é o erro que
   gerou 635 casas para 13 endereços conhecidos. **Não pule esta.**
5. Rode `python pipeline/rodar.py --rede` e depois `--listar`. O portão da etapa 9 diz
   se pode publicar — e desde 01/09 ele confere as **duas** famílias: a geometria e o
   comportamento do v13 (ficha, "o que tem por perto", quadro preguiçoso, governador,
   remendo de árvore, custo do minimapa, terreno de fundo, duplo clique, exposição do
   interior). Custa ~3,5 min por cidade e precisa de Chrome; `--rapido` no `rodar_qa`
   pula essa parte, mas aí o relatório sai com portão **não medido** e não autoriza
   publicar. Medido em Araraquara em 2026-09-01: 223 s no total, 9 de 9 passando (o do
   interior fica sem medir — a cidade não tem planta fornecida).

---

## 5. O renderizador é código (2026-08-29)

Até aqui o renderizador **não tinha arquivo**. O código dele morava dentro de
`v3/…v3.html` — 6,9 MB dos quais 6,8 MB eram dado colado no meio — e ninguém gerava
esse arquivo: foi editado à mão e virou o começo de tudo. A página final saía de quatro
scripts encadeados fazendo busca-e-substitui de texto exato:

    v3.html --make_v4(10)--> v4 --make_v5(5)--> v5 --make_v7(30)--> v7 --make_v8(14)--> v8
                                                                          = 59 âncoras

Agora:

    renderizador/cabeca.html  estilo.css  corpo.html  app.js  lib/{three,earcut}.min.js
                              ↓ pipeline/montar.py
                    v8/sao-carlos-v8-aberto.html  +  sao-carlos-v8.html (comprimida)

**A extração foi do FIM da cadeia, não do começo** (`pipeline/extrair_renderizador.py`):
a fonte da verdade é o HTML que já passou nos portões, não o de 6,9 MB de onde tudo
partiu.

### O aceite

`montar.py --conferir <html>` compara **peça a peça**, não a string inteira — a
concatenação não bate byte a byte por um motivo inerte (o HTML antigo tinha linha em
branco entre alguns blocos de topo e não entre outros, acidente do histórico de
patches). Resultado da migração:

```
__citydata, __elevdata, __grounddata, __murosdata,
__poidata, __streetdata, css, lib:three, lib:earcut     idênticos
app                                                      DIFERE  (5 linhas, de propósito)
markup                                                   DIFERE  (7 palavras no <title>)
__cidade                                                 bloco novo
```

O diff do renderizador é de **5 linhas** — nenhuma acidental. Os 7 portões continuam
passando e o screenshot do centro saiu com **md5 idêntico**, pixel a pixel.

*(O enquadramento de Araucária acusou 2,1% de pixels diferentes. Controle: duas
capturas do MESMO arquivo dão exatamente os mesmos 34.393 pixels. É o streaming
alternando entre dois estados no instante da captura, não mudança de render — vale
lembrar disso antes de acusar uma regressão por screenshot.)*

### E a cidade saiu de dentro do código

Era isto que travava "qualquer cidade":

```js
const CENTER = { lat:-22.01725, lon:-47.89080 };   // Catedral de São Carlos
const Q = 10;
const ELEV_HALF = 9500, ELEV_N = 80;
const CITY_FILE = "sao-carlos-v5.city.json";
```

Quatro constantes de São Carlos escritas no renderizador, enquanto o `city.json` já
trazia os mesmos valores nos campos `c` e `q` — que ele ignorava. Agora todas saem de
um bloco `__cidade` que o `montar.py` escreve a partir de `padrao/cidades/<slug>.json`.
O bloco fica **fora da compressão** de propósito: o app o lê na inicialização do módulo,
antes de qualquer descompactação assíncrona.

E tem portão pra não voltar: **`cidade fora do código do renderizador`** varre
`renderizador/` atrás das coordenadas da própria cidade e reprova o build se achar.
Comentário não conta (explicar o histórico é permitido). Testado com a regressão
injetada de volta: reprovou apontando `app.js:25`, e voltou a passar ao desfazer.

Os cinco `make_*` continuam no repositório como histórico, mas **recusam rodar** — a
saída deles divergiria da do montador em silêncio. Para rodar assim mesmo:
`--aposentado-eu-sei`.

## 6. A segunda cidade: Araraquara (2026-08-29)

Araraquara foi construída para **testar** o padrão, e o teste é o que valida tudo
acima. Ela é o caso oposto ao de São Carlos: **nenhum dado de prefeitura** — sem
cadastro de quadra, sem ponto de endereço, sem planta oficial. Só Overture, OSM e
open-elevation.

    padrao/cidades/araraquara.json     ← a cidade inteira em dados
    CIDADE=araraquara python pipeline/rodar.py --rede

Resultado, com os 8 portões passando:

| | São Carlos | Araraquara |
|---|---:|---:|
| fonte da quadra | cadastro + grafo | **só grafo** (0 do cadastro) |
| quadras | 3.979 | 3.883 |
| miolo / área da quadra | 76% | **76%** |
| lotes | 119.650 | 110.173 |
| lotes com prova de ocupação | 65.054 (54%) | 69.366 (63%) |
| volumes | 74.989 | **83.486** |
| POIs | 931 | 1.016 |
| página comprimida | 5,42 MB | 4,50 MB |
| casa sobre a rua | 0,52% | **0,31%** |
| pipeline (1b→9) | 533 s | **401 s** |

A razão **miolo/quadra de 76% bate exatamente** entre as duas — uma vinda do cadastro
oficial, a outra do grafo de ruas. É a melhor evidência de que a face do grafo é
substituto legítimo da quadra.

**Uma escolha que a cidade nova obriga a fazer:** Araraquara usa **SIRGAS 2000 / UTM
22S (EPSG:31982)**, não o SAD69/23S de São Carlos. Ela fica no fuso 22, e como aqui não
há dado de prefeitura (tudo é WGS84), o SIRGAS evita o desvio de datum de ~50 m que o
SAD69 carrega em São Carlos. Errar isso não dá erro — dá cidade deformada.

### O que o teste quebrou

Nada disso teria aparecido sem rodar de verdade:

1. **`merge_osm_overture` lia o Overture de São Carlos.** Os prédios de Araraquara
   saíam 25 km deslocados dos quarteirões — 126.008 órfãos, contra 15.221 depois do
   conserto. O sintoma foi "0 quarteirões + 341 sintéticos" na etapa 0c.
2. **A etapa 0d começou a processar as 171 plantas de São Carlos para Araraquara.**
   O runner agora **pula etapa cuja entrada obrigatória não existe** em vez de rodá-la
   com dado de outro município.
3. **Essa regra, ingênua, pulou a 1b** — justamente a etapa feita para rodar sem
   cadastro. Daí a distinção entrada **obrigatória × opcional** (`O(...)` no runner):
   a 1b vive sem cadastro, a 4 sem planta, a 5 sem endereço, a 8 sem POI; a 0d e a 0e
   sem planta são puladas mesmo.
4. **Cache de tiles do Overpass compartilhado.** Araraquara reaproveitaria os tiles de
   São Carlos, que o script pula por já existirem — e o download sairia **vazio, sem
   erro nenhum**. Hoje o cache é por cidade, e o `_estado.json` também.
5. **Nove scripts do pipeline tinham CRS e centro de São Carlos escritos dentro**
   (`EPSG:29193`, `-22.01725, -47.89080`), não só caminhos. Promovidos.
6. **A geração de POIs só existia como arquivo pronto** — o gerador estava num
   scratchpad. Virou `pipeline/fontes/pois.py` (etapa 0f).
7. **A vitrine de imóveis do `app.js` apareceu no mapa de Araraquara**, com bairro e
   preço de São Carlos. Virou o bloco `__imoveis`, por cidade. Conferido: o painel de
   São Carlos ficou com **0 pixels de diferença**.

São Carlos foi reconstruído do zero depois de tudo isso e saiu **idêntico** — 74.989
volumes, 8 portões passando.

## 7. Interiores: a casa por dentro (2026-08-29)

Clicar num volume e entrar nele — mesma cena, mesma câmera, mesmo renderer. Não há
segunda página nem segundo `THREE.Scene`: o que muda é quem manda na câmera e onde
está o plano de corte.

    clique no volume  ->  ficha  ->  "Entrar"  ->  planta gerada  ->  voo de 1,1 s
                                                                          |
                             primeira pessoa  <---- Planta ---->  órbita sobre a casa

**Da face clicada ao registro do prédio.** A malha da quadra é mesclada: não existe um
objeto por edificação pro raycast devolver. Mas cada vértice já carrega o centroide do
prédio dele em `presetCenter` (o shader usa isso pro relevo), e o centroide quantizado
em decímetros é a mesma chave que a fachada usa de semente. Face → centroide →
registro, com um índice montado na primeira vez que se clica naquela quadra. Custo:
uma referência (`bm.userData.recs = B`) por malha.

**Só existe interior por cadastro.** Não há mais interior genérico: prédio sem unidade
cadastrada não abre porta nenhuma, e a ficha dele nem oferece o botão. O BSP que gerava
planta a partir do contorno saiu inteiro (com ele foram a receita de mobília automática
e o recorte de divisória por polígono). O motivo é de produto, não de código: cada
imóvel vai ter interior próprio, vindo de planta e material fornecidos pela imobiliária,
e povoar a cidade de plantas inventadas só ensinaria o usuário a não confiar no que vê.

**Móvel também é cadastro.** `moveis` no `unidade.json` traz tipo, ponto em metros da
planta, giro em quartos de volta e tamanho — lido do próprio desenho. A mobília
automática por receita ("toda sala ganha sofá, TV, tapete e estante") enchia o cômodo de
coisa que não está no desenho, e num apartamento de 9 m² isso é a diferença entre sala e
depósito.

**Dentro do apartamento a cidade não é fatiada, é furada.** O plano de corte global
resolvia ver o interior de cima, mas de pé na sala ele transformava o bairro numa maquete
cortada na altura do ombro. Agora, ao entrar, um `uFuro = (cx, cz, raio, yMin)` manda a
fachada **descartar** o cilindro do prédio anfitrião acima do piso da unidade: a casca
que tapava a janela some, e o resto da cidade continua inteiro do lado de fora. Quatro
uniforms e um `discard` — identificar o prédio por atributo custaria 8 bytes por vértice
em milhões de vértices, que é exatamente o que o v8 tinha acabado de economizar. O corte
por plano continua, mas só na vista de planta, que é onde ele serve pra alguma coisa.

**A saída agora é `v9/`, e ela é testada em `file://`.** Todas as cinco cidades passaram
a escrever em `v9/<slug>-v9.html` (comprimida, duplo clique) e `-v9-aberto.html` (crua,
pra depurar). `pipeline/testa_duplo_clique.py` roda cada página comprimida no Chrome
headless por `file://`, clica no imóvel da vitrine e confere que o interior monta —
`file://` tem origem opaca e `fetch` bloqueado, e o carregador depende de
`DecompressionStream` mais injeção de `<script>` em runtime; nada disso é exercitado
abrindo por `localhost`, que foi como o v5 saiu "pronto" sem abrir por duplo clique.
As cinco passam; só Ribeirão Preto tem imóvel cadastrado, e nela a sonda entra no
apartamento (11 cômodos, 57 faixas de parede, 29 móveis, furo ativo).

**Celular.** Três coisas quebravam num telefone, e nenhuma era desempenho. A vitrine
era `display:none` no `@media (max-width:640px)` — e ela é a **única** porta de entrada
do imóvel, então o telefone virava só um mapa bonito. Andar exigia teclado: entrou um
manche de 114 px no canto esquerdo que devolve vetor contínuo (não um pad de setas —
andar em quatro direções dentro de um cômodo de 3 m é sofrível), e o módulo do vetor
vira velocidade, o que permite ajustar posição sem passar direto. E o campo de visão:
`camera.fov` do three é o VERTICAL, então 62° numa tela em pé (proporção 0,46) viram 30°
horizontais — uma luneta apontada pra parede. Agora o alvo é horizontal e o vertical sai
da proporção da tela, com teto de 80° pra a distorção de barril não ficar pior que o
problema que resolve. O painel de mobília abre recolhido no toque, e os controles da
cidade (Altura, Relevo, Muros) somem enquanto se está dentro — não operam nada lá.

**Online.** `pipeline/publicar.py` prepara a página comprimida pra virar Artifact, e a
diferença é só de embalagem: o `<title>` deixa de descrever o arquivo ("mapa 3D · duplo
clique") e passa a nomear a coisa, e o BOM do `cabeca.html` sai — inofensivo num arquivo
local, caractere invisível quando a página é embrulhada por outro documento. Dado,
programa e three.js vão byte a byte iguais. Não existe "versão web" diferente da que
abre por duplo clique.

**Luz de dentro, e ela e medida.** Sol e hemisferica foram calibrados pra telhado a
ceu aberto; dentro do apartamento entram uma ambiente fraca e ate seis luzes de teto
(uma por comodo, com queda), e o sol e a hemisferica CEDEM espaco -- somados no valor
cheio, o interior estourava em branco chapado. Nenhuma luz pontual projeta sombra:
seria um cubemap por luz, seis renderizacoes da cena por quadro cada uma. Quem projeta
e o sol, que ja estava ligado, com a camera de sombra reapontada pro apartamento
(±10 m em vez de ±640 m, e near/far encolhidos de 3 km pra 80 m -- sem isso a precisao
de profundidade come a sombra inteira e ela existe no mapa sem aparecer na tela).

`pipeline/mede_interior.py` fecha esse ciclo: renderiza o interior no Chrome headless e
devolve media, percentis, fracao queimada e faixa dinamica do miolo da tela. A primeira
mistura passou no olho e reprovou na medida (media 204, faixa 60 -- lavado e chapado);
a atual da media 128 e faixa 188. Iluminacao era o unico lugar do projeto onde "ficou
bom" era decidido olhando.

**Acabamento sem arquivo.** Três texturas desenhadas em `<canvas>` no boot — junta de
porcelanato, régua de madeira, grão de massa corrida — mais rodapé de 8 cm e forro. Saem
quase brancas de propósito: a cor vem do `unidade.json`, por vértice, e a textura só
multiplica. São três malhas (parede, piso frio, piso de madeira), porque mapa diferente é
material diferente — três chamadas de desenho pro apartamento inteiro.

**A planta vem de fora; sem ela não há interior.** `plantas_fornecidas/<id>/`
guarda o material do anúncio (imagem da planta, fotos, texto) e produz `unidade.json`,
que é o único arquivo que o renderizador lê — `pipeline/montar.py` varre a pasta, filtra
por cidade e embute tudo no bloco `__unidades`. Uma unidade traz ficha, andar e a
geometria; `predio_id` a prende num prédio pelo mesmo centroide-em-decímetros que já é
identificador estável aqui. `?planta=<id>` força uma planta em qualquer prédio que se
clique, que é como se confere uma extração recém-feita sem antes decidir em que torre
ela mora. Prédio sem unidade cadastrada continua caindo no BSP.

**A vitrine leva pra dentro.** A lista "Imóveis para inspeção 3D" já voava a câmera
até o anúncio e acendia um farol no chão; unidade com planta vai além — clicar voa até
o prédio e **entra**. O elo fraco é saber em que prédio a unidade mora, e um anúncio que
só diz "em frente ao shopping" não responde isso. Três fontes, nessa ordem: o prédio
fixado à mão (`localStorage`), o `predio_id` do cadastro, e a `ancora` lat/lon, que
resolve pro prédio mais próximo num raio de 120 m. Enquanto nenhuma for confirmada, a
vitrine e o painel dizem **"prédio não confirmado"**, e o botão **Trocar prédio** entra
em modo de apontar: o próximo prédio clicado vira a âncora e fica gravado.

**Parede não é dado de entrada, é derivada.** O que a imagem de uma planta entrega é
cômodo com área rotulada, não espessura de alvenaria — então `unidade.json` descreve
**cômodos como polígono**, e porta e janela como **ponto com largura**. O renderizador
rasteriza os cômodos numa grade de 5 cm, pergunta de quem é cada célula e emite parede
em toda fronteira entre donos diferentes (cômodo × cômodo, ou cômodo × lado de fora).
Três motivos, nessa ordem: é o que a extração consegue produzir; sobrevive a polígono
torto, porque a grade não se importa com canto que não fecha em 90°; e dispensa
declarar contorno externo, que é justamente a parte que planta de anúncio não desenha
por inteiro. O preço é que **os cômodos têm que encostar uns nos outros** — 15 cm de
folga entre dois vira duas paredes paralelas com faixa morta no meio.

Parede virou faixa `{a, b, y0, y1}` por causa da janela: peitoril embaixo, bandeira em
cima, vão no meio. A verga da porta, que era lista à parte, entrou no mesmo saco. Só
faixa com `y0 < 1,2 m` conta como obstáculo — o que passa por cima da cabeça não
bloqueia passo.

**A área rotulada não entra na geometria: ela é o portão.** Área medida do polígono
contra área rotulada, cômodo a cômodo, é o que diz se a escala da extração está certa.
`escala_conferida: false` até isso bater.

**O BSP, para quem não tem planta, é sobre o retângulo mínimo.** Divide o maior lado num ponto sorteado
— sorteio determinístico, mesma semente da fachada — e para quando o pedaço fica menor
que um cômodo de verdade (2,30 m de lado, 13 m²). Cada divisória ganha **um** vão, o
que garante a casa conectada sem teste de conectividade nenhum. Contorno em L não
quebra: cada divisória é recortada contra o contorno e só os pedaços de dentro viram
parede. Uma casa de 93 m² sai com Sala, 2 Quartos, Cozinha e Banheiro, 8 trechos de
parede e 4 vergas; o nome do cômodo vem da ordem de área (maior = Sala, menor =
Banheiro), e a área é medida por amostragem de 40 cm, não pelo retângulo — num
contorno em L metade da folha do BSP cai fora da casa.

**Três decisões que economizaram o resto:**

- **A casa não ganha parede externa.** A casca de `gBuild` é `DoubleSide`: vista de
  dentro ela já é a parede, com a janela e a porta que o shader de fachada desenha.
  Duplicar isso custaria geometria, z-fighting e uma segunda fonte de verdade pro
  mesmo contorno.
- **O corte é global e nasce ligado**, com a constante no infinito. Um plano em
  `renderer.clippingPlanes` custa algumas instruções por fragmento; ligá-lo só na hora
  de entrar mudaria a *contagem* de planos e recompilaria todo shader da cena no meio
  da transição — engasgo garantido, e justo no frame que o usuário está olhando.
  Entrar é só descer a constante. De quebra o bairro inteiro fica em corte, que é o
  que mantém a promessa de "a cidade não some".
- **Móvel é caixa, não GLTF.** A página abre com duplo clique em `file://` — um loader
  externo seria um arquivo que não existe. As caixas de um móvel viram UMA malha com
  cor por vértice, então **cada móvel custa uma chamada de desenho**, que é a moeda
  cara aqui (~23 µs), não o triângulo. Casa mobiliada de 4 cômodos: 12 móveis = 13
  chamadas com o piso e as divisórias.

**Duas vistas, um corte.** Primeira pessoa responde "como é estar aqui" (WASD, colisão
por tentativa-e-deslize contra parede *e* móvel); a Planta responde "onde ponho o
sofá". Mobiliar de dentro, com a câmera na altura dos olhos e o móvel atrás de você, é
sofrível — daí a órbita. Na planta o corte desce pra 1,55 m, que é onde a planta de
arquitetura corta, e a casa inteira aparece de uma vez em vez de ficar metade escondida
atrás da parede da frente. O raycast filtra por `CORTE.constant`: o raio precisa
enxergar o que a tela enxerga, senão a parede some aos 1,55 m e continua bloqueando
clique até 2,70 m.

**O que a câmera da cidade não aguentava.** `near = 2 m` é meia sala: dentro de casa
apagava o chão (1,62 m abaixo do olho) e a parede em que se encosta. E 40° de campo é
teleobjetiva pra um cômodo de 4 m. Os dois viraram constante por modo
(`NEAR_CASA = 0,08`, `FOV_CASA = 62`, `FOV_PLANTA = 46`) e voltam ao valor da cidade na
saída.

**Onde o layout mora.** `localStorage`, chave `int_<slug>_<centroide em dm>` — o mesmo
identificador estável da semente da fachada, então o layout sobrevive a recarregar a
página e a atualizar a base. "Refazer" joga fora e remonta a mobília padrão.

Custo: 896 linhas em `renderizador/app.js` (2.493 → 3.436) e ~30 KB na página aberta
(13,13 → 13,18 MB; comprimida 5,415 → 5,438 MB). Zero dado novo — nenhum arquivo de
fonte, nenhuma etapa a mais no `rodar.py`. Os 8 portões continuam passando.

### O vão ganhou esquadria (2026-08-30)

Até aqui porta e janela eram **ausência**: `paredesDaGrade` abria o buraco na parede e
nada entrava nele. Um cômodo cheio de retângulos vazios não lê como casa — e a porta,
que é a peça que mais diz "isto é habitação", era justamente a que não existia.

Agora cada vão vira **batente com guarnição e folha aberta** (porta de giro),
**caixilho de alumínio com duas folhas de correr e vidro** (janela e porta de varanda),
**batente sem folha** (passagem com verga) ou **nada**.

A linha entre "batente sem folha" e "nada" é a **verga**: se há parede acima do vão, é
vão de porta e leva marco — passagem de porta é acabada com marco em obra, e sem ele a
cozinha parece recortada a estilete. Se o vão vai até o forro não é vão de porta, é
ausência de parede (sala e jantar como um cômodo só), e emoldurar inventaria um portal
que a planta não tem.

**O tipo e o lado são DEDUZIDOS, porque a planta de anúncio não os declara.** Ela
desenha um arco, e quem transcreve raramente transcreve o arco. O tipo sai da largura e
da vizinhança: 3,20 m de pé-direito inteiro entre sala e jantar não é porta, é ausência
de parede; 2,40 m dando pra Varanda é porta de correr de vidro; 70 cm entre circulação
e banho é folha de giro. O lado sai da regra que o desenhista usa: a folha gira pra
dentro do ambiente **mais privado** dos dois (circulação < varanda < sala/jantar <
cozinha/serviço < dormitório < banho), empate desempata pelo **menor**, e a dobradiça
fica na extremidade mais perto do canto do cômodo — pra folha abrir contra a parede
lateral em vez de varrer o meio da passagem. `tipo`, `abre_para` e `dobradica` no
cadastro passam por cima das três. O formato está em `plantas_fornecidas/LEIA-ME.md`.

Medido no `mirra-114`, as onze portas e sete janelas caem assim: circulação→banho ×2,
circulação→dormitório, circulação→suíte, cozinha→área de serviço e área de serviço→área
técnica giram pra dentro do ambiente certo; as duas de varanda viram correr; a passagem
cozinha↔jantar (1,20 m, com verga) ganha marco sem folha; e o vão sala↔jantar de 3,20 m
à altura do forro não recebe nada. A entrada da circulação vinda do social está marcada
`"tipo": "vao"` **no cadastro**: a folha aberta ali ficava plantada no meio da sala de
jantar, e corredor de apartamento não tem porta na boca.

**A folha nasce ABERTA a 78°, e não por preguiça de animar.** Fechada, ela veda o cômodo
vizinho e a visita de primeira pessoa vira um quarto sem saída. Aberta, encosta na
parede lateral, deixa o vão livre e ainda informa pra que lado abre — a mesma coisa que
o arco da planta de arquitetura informa. A de correr nasce **corrida por cima da fixa**,
com 20% de desencontro só pra as duas se lerem como duas.

**Três chamadas de desenho pro apartamento inteiro, não uma por peça.** Toda a esquadria
sai em três malhas — pintado, alumínio anodizado e vidro — com cor por vértice, então
porta branca e porta de madeira convivem na mesma. Onze portas e sete janelas como
objetos separados custariam 18 chamadas, mais que a casa inteira custa hoje: o
apartamento foi de **3 pra 6** malhas (992 tris de parede, 16 e 6 de piso, 924 de
esquadria pintada, 1.620 de alumínio, 192 de vidro). A esquadria entra **depois** das
três antigas de propósito — `pipeline/mede_interior.py` lê `INT.casa.children[1]` pra
provar que o piso recebe sombra, e entrar no meio da fila trocaria o piso por um batente.

**A colisão tinha fechado a porta que o desenho abriu.** Meia parede mais o raio do
corpo pedem 36,5 cm de folga de cada lado do eixo da parede, e um vão de 70 cm inteiro
só tem 35 — ou seja, **nenhuma porta de 70 cm era transponível**, e ninguém tinha
percebido porque não havia folha nem batente pra denunciar. A ponta de parede que
encosta num vão agora recua 14 cm na colisão (`pa`/`pb` na faixa). Medido nas sete
portas de giro do `mirra-114`: 13, 13, 13, 10, 13, 13 e 12 pontos livres de 13 numa
linha de 1,80 m atravessando o vão — contra 0 antes nas de 70 cm. A folha aberta também
barra passo, com raio menor (0,215 m contra 0,365 m da parede): ela é chapa de 3,5 cm e
fica no canto do cômodo, não no meio do vão — a mesma medida com as folhas ligadas dá
os mesmos 13, 13, 13, 10, 13, 13, 12.

Custo: ~200 linhas em `renderizador/app.js`, nada de dado novo, nenhuma etapa a mais.
Os 9 portões de Ribeirão Preto continuam passando e `mede_interior.py` continua na
faixa (média 148,6; faixa 117,5).

**Uma pegadinha que só a medida mostra:** a porta cozinha→área de serviço do `mirra-114`
continua intransponível, e não é da esquadria — a geladeira está a 57 cm do vão e o
tanque a 45 cm do outro lado, e `livre()` infla móvel em 24 cm por lado. É a
transcrição da planta, não o renderizador; medido desligando a mobília, o vão dá 13 de 13.

### Céu de dentro, e a parede que era sonsa (2026-08-31)

Duas coisas que ele apontou olhando a tela, e as duas se mediram antes de decidir.

**A cidade não tem céu, tem cor de limpeza.** Um cinza-ardósia igual ao da névoa — e é
justamente essa igualdade que faz o horizonte fechar sem costura visto de fora. De
dentro do apartamento não funciona: a moldura da janela recorta um retângulo daquele
cinza e o imóvel passa a ser anunciado num dia de chumbo permanente. Agora existe uma
cúpula de céu **só enquanto se está dentro**, e ela custa uma chamada de desenho:
textura equirretangular desenhada num `<canvas>` na primeira entrada (a página abre em
`file://`, onde arquivo externo não existe), `depthTest:false` e `renderOrder` bem
negativo pra pintar antes de tudo — uma cúpula "longe o bastante" seria recortada, já
que nos níveis sem buffer logarítmico o `far` de dentro de casa é 6 km. E
`toneMapped:false`, pra o azul na tela ser exatamente o azul escrito no código em vez
de um cinza que o ACES a 0,55 de exposição devolveria.

**Nuvem é pincel, não ruído.** Um FBM por pixel são milhões de interpolações em JS no
meio da transição de entrada; noventa e seis aglomerados de elipse com gradiente radial
saem em poucos milissegundos, com semente fixa (`hash`, a mesma regra da fachada). Duas
lições que só apareceram na foto: as nuvens começaram **grandes demais** (a textura dá a
volta em 1.024 px, ou 0,35° por texel, então um aglomerado de 100 px ocupava 35° do céu
e lia como mancha desfocada — cúmulo de verdade abre 8 a 20°); e a faixa parava a 11° de
altura, o que de dentro de casa significa **nunca aparecer**, porque pela janela se vê a
faixa logo acima do horizonte e quase nada do zênite. A **névoa vai junto**: sem isso o
bairro ao fundo morre no cinza da cidade com azul atrás dele, e a emenda cai exatamente
na linha do horizonte, que é o que a janela mais mostra.

**A parede sonsa tinha três causas, e nenhuma era a cor do cadastro.**

1. **A hemisférica da cidade anulava o bege.** Ela vem calibrada pra telhado a céu
   aberto: azul pálido em cima, `0x1A222C` (quase preto, e frio) embaixo. Numa superfície
   vertical a hemisférica entra meio a meio, então a parede que não pega sol recebia duas
   fontes frias e virava cinza sem croma. Dentro de casa ela agora é quase neutra em cima
   (é céu filtrado por vidro, não céu) e francamente quente embaixo — que é a luz que já
   bateu no piso.
2. **O ACES come croma, e dá pra medir.** A parede declarada `#D9D2C7` (R−B = 18) chegava
   na tela com R−B = 11: 40% do que separa "bege claro" de "cinza" desaparecia no caminho.
   `rgbAcabamento()` satura a cor do cadastro **antes** de virar vértice, na medida do que
   o tone mapper vai tirar. Não mexe no dado; devolve na tela a cor que a pessoa amostrou
   da foto do anúncio. Vale só pro acabamento (parede, forro, rodapé, piso) — móvel já
   chega com croma de sobra.
3. **Cada face saía num tom chapado do rodapé ao forro.** Três faces chapadas lado a lado
   leem como maquete de papel. `prismaQuad` ganhou uma gradação vertical opcional (0,76 no
   rodapé, 1,04 na altura do peitoril, 0,90 no forro) — e a primeira tentativa **não
   apareceu na tela**, porque com vértice só embaixo e em cima o rasterizador interpola em
   linha reta e a curva simplesmente não existe. A face é fatiada em quatro.

Medido nas mesmas três regiões do print de referência, saturação HLS da parede:
sol 0,070 → 0,089; sombra 0,045 → 0,074; cozinha (a pior) **0,018 → 0,058**, com R−B de
+4 pra +13. A mistura final é sol 1,40 / hemisférica 0,20 / luminária 0,58 / exposição
0,55, e `mede_interior.py` continua na faixa: média 155,5, p99 208,6, queimado 0,0%,
faixa 99,5. Sair do imóvel devolve névoa, hemisférica, sol e exposição aos valores da
cidade — conferido por sonda, comparando o estado antes de entrar com o de depois de sair.

Uma armadilha de QA que vale anotar: **no headless o voo de saída nunca termina**. O rAF
entrega UM quadro em 12 s de tempo virtual (o artefato já conhecido de aba oculta),
então `INT.voo.fim` não dispara e a sonda acusa "não restaurou" sem que haja defeito. A
sonda chama `fim()` na mão, que é exatamente o que o laço faria.

### Dívida deste pedaço

- **O extrator de `planta.png` ainda não existe.** O formato, o carregador e a derivação
  de parede estão de pé e testados com `plantas_fornecidas/_exemplo/` (apartamento
  inventado, 8 cômodos ladrilhando 9,20 × 7,20 m). Falta a etapa imagem → polígono.
- **`mirra-114` foi TRANSCRITA À MÃO**, não extraída: a imagem chegou colada no chat,
  não em arquivo. A escala saiu de calibrar pixels contra as áreas rotuladas em cinco
  cômodos (107 a 116 px/m, adotado 110), e cada cômodo foi ajustado pra fechar a área
  do rótulo — as onze áreas batem com erro máximo de 0,3%, mas a PROPORÇÃO pode errar
  alguns centímetros. `escala_conferida: false` até a imagem em arquivo chegar.
  Dois desvios conscientes estão anotados no próprio `unidade.json`: a circulação foi
  alargada de 0,72 m (o que sairia do rótulo de 2,60 m²) pra 0,97 m, senão o corredor
  fica intransitável; e a varanda virou polígono em L, porque a frente da sala e a do
  dormitório não estão alinhadas no desenho.
- **A planta e a ficha desse anúncio são de unidades diferentes** — a planta soma
  64,40 m² com 1 suíte + 1 dormitório, a ficha diz 114,32 m² com 3 suítes. A geometria
  gravada é a da planta; o painel mostra a área da ficha. Conferir na origem.
- **Um pavimento só.** A unidade nasce em `base + andar × 3,15 m` e é uma laje só;
  sobrado e prédio sem planta recebem o BSP do térreo, sem escada nem laje
  intermediária.
- **A receita de mobília é residencial.** Entrar na Catedral gera 20 "cômodos" com sofá
  — consequência honesta de uma planta genérica, mas a receita devia olhar a classe de
  uso antes de escolher o móvel.
- **Com o Relevo ligado o raycast erra de prédio vizinho.** A malha é deslocada no
  shader (`aDY*uRelief`) e o raycast lê a posição do buffer, que não sabe disso. Erra
  de alvo, não de lugar: o centroide que sai continua exato.
- **A planta não sabe de porta de rua.** O vão externo não existe; sai-se pelo botão,
  não pela porta.

## 8. Arborização: 20 espécies (2026-08-30)

Até o v9 a árvore era `IcosahedronGeometry(1, 0)` — 20 triângulos, cor verde com jitter
de luminosidade — e só existia dentro de polígono verde. A árvore de calçada tinha sido
desligada no v6 com um comentário honesto no código: *"as árvores de beira de rua caíam
em cima das casas (que agora encostam na rua) e do asfalto"*.

### A biblioteca

`arvores/arvores.py` é um gerador paramétrico que roda dentro do Blender: 10 estilos de
copa (domo, guarda-chuva, estratificada, irregular, em camadas, colunar, chorona,
palmeira, cone, candelabro) e uma tabela de 20 espécies. Acrescentar espécie é uma linha
na tabela, não modelagem.

    especie              tris   lod0   alt_m
    mangueira             644    284    10,3
    figueira              774    354    12,7
    palmeira_imperial     410    410    17,5
    araucaria             258    258    16,5
    ...                                       média 534 / 324

Sem textura e sem material por espécie: **toda a cor é cor de vértice**, com gradiente
vertical (topo mais claro) e jitter por face. É o que permite mesclar milhares de
árvores no mesmo buffer, e é o que dá volume sem depender de luz.

`export_arvores.py` escreve `arvores_lib.json` com os dois LODs. O `montar.py` embute
**só o LOD baixo** (324 tris de média) no bloco `__arvores` — 0,60 MB crus, 0,16 MB
comprimidos. O LOD alto fica no arquivo pra uso de perto.

Duas armadilhas do caminho, as duas caras:

- **A cor sai do Blender em sRGB e o renderizador espera linear.** `outputEncoding =
  sRGBEncoding` faz o three tratar a cor recebida como linear e reencodar pra tela —
  é a mesma razão por que os hexes de telhado no `app.js` estão ~20% abaixo da cor de
  catálogo. A conversão mora no `montar.py`, num lugar só, e não espalhada entre o
  Blender e o JS.
- **O Python do Blender sobrevive entre execuções.** Sem `importlib.reload`, a segunda
  exportação usa o módulo da primeira e grava o JSON no diretório antigo, calada.

### Onde a árvore de rua nasce

Na faixa entre a borda da pista (`ROAD_W/2 × mul_pista`) e o fim da fita (`× mul_fita`)
— a calçada que o renderizador já desenhava, e onde quadra, lote e muro não entram. O
tronco vai no meio dela (`mul_calcada = 1,28`), então **não há como nascer no asfalto nem
dentro do lote**; a copa passa por cima dos dois, que é o que as fotos de rua mostram.

O portão `arvore fora da calcada` mede isso na página pronta: a posição sai de
`gArv.userData.pesRua` (o que o usuário vê) e a fita sai de `padrao/vias.py` em Python.
As duas metades vêm de fontes independentes de propósito — recalcular a regra de plantio
no QA provaria só que a fórmula é igual a ela mesma.

**E o portão pegou o que a regra não previa.** A primeira medida deu 2,19%: 37 de 1.693
árvores em cima do asfalto. A calçada da *própria* via não diz nada sobre a via que
cruza — uma residencial (pista de 3,75 m) encontrando uma primária (6,5 m) joga a árvore
da esquina na pista da avenida. Testar o candidato contra as ruas do quarteirão derrubou
para 18, e as 18 restantes eram todas de borda: `groupsFrom` põe a rua na célula do
**primeiro ponto** dela, então a rua que atravessa a fronteira não está na lista do
vizinho. O índice de asfalto virou uma grade de 120 m da cidade inteira, e a medida foi
a 0,00%.

Vale o registro de método: a regra "planta entre a pista e a fita" era correta e
insuficiente, e nenhuma das duas coisas apareceria olhando a tela. O olho não conta 37
em 1.693.

### O erro que custou a tarde: orçamento por quarteirão

A primeira versão mesclou as árvores do quarteirão num buffer só. Parecia certo: uma
chamada de desenho por quarteirão, igual ao v9, trocando triângulo (que sobra) por
chamada (que falta).

Na medição, um quarteirão tinha **59.935 árvores**. Não era bug novo — era o v6 plantando
uma a cada 11 m em toda área verde, sem teto nenhum, o que com um icosaedro instanciado
custava uma matriz por árvore e passava batido. A 261 triângulos, viram 15,6 milhões de
triângulos e ~700 MB num buffer só. O sintoma não foi queda de quadro: **a página parou de
entregar prédio**. O streaming gasta 6 ms por quadro montando, e `assembleInto` não é
interrompível — cada quarteirão passou a travar por dezenas de milissegundos, e a foto
saiu com rua, chão e árvore mas sem nenhuma edificação.

Só se viu isso porque a mesma foto foi tirada do v9, na mesma moldura, como controle.

O conserto tem duas partes:

1. **A geometria virou `InstancedMesh` por espécie, global.** Não uma malha por
   quarteirão. A árvore volta a custar uma matriz de 64 B e a cidade inteira cabe em até
   20 chamadas de desenho, **independentemente de quantos quarteirões estejam vivos** —
   contra uma por quarteirão no v9 (medido: 18 chamadas para 4.091 árvores numa amostra
   de 80 quarteirões). Na amostra os dois empatam; o ganho é o teto. O conjunto é refeito
   inteiro quando o conjunto vivo muda (~mil composições de matriz, milissegundos), em vez
   de remendado por quarteirão, o que evita a classe inteira de bug de índice defasado que
   uma lista livre traria.

   Um aviso pra quem for medir de novo: contar `isInstancedMesh` na cena pega junto o
   `buildFacingArrows`, que é uma malha instanciada de ~60 mil setas, invisível até
   apertar o botão **Setas**. Foi o que fez a primeira contagem dizer "~60 chamadas no
   v9".
2. **O orçamento passou a ser da cena**, e mora no JSON da cidade: teto por praça (220),
   teto por quarteirão (500), `raio_m` (850 m — árvore não é prédio: aos 1.800 m do
   streaming ela é um pixel) e `max_na_cena` (14.000), que corta pelas mais distantes.
   Teto por quarteirão sozinho não segura o total: 90 quarteirões vivos × 700 são 63 mil.

Medido em São Carlos depois: 2.443 árvores vivas, 0,69 M de triângulos de árvore, 20
chamadas de desenho pra vegetação, 1,41 M de triângulos na cena.

### A mistura é da cidade

`arborizacao` em `cidades/<slug>.json` traz a mistura de rua, a de praça, o passo, a
densidade, os tetos e a lista de vias arborizadas (nem toda via dirigível tem calçada:
`motorway`/`trunk` são via expressa, `service`/`track` são acesso interno). A biblioteca
é a mesma pras cinco cidades; a mistura é que é dado.

A primeira mistura pôs 30% de árvore florida na rua e a avenida saiu pintada de amarelo e
roxo ao mesmo tempo — ipê, quaresmeira e flamboyant não florescem juntos nem no mesmo mês.
Baixou pra 18%, e depois **a floração foi desligada por inteiro**: a cidade sai só em tons
de verde.

Isso obrigou uma separação que já estava atrasada. A tabela das espécies morava dentro do
`arvores.py`, que importa `bpy` — ou seja, **mexer em cor exigia o Blender aberto**. Ela
saiu pra `arvores/especies.py`, dado puro, e com ela veio `FLORACAO`, um número: 0 põe o
`flor_verde` de cada espécie no lugar da flor, 1 devolve a floração. As espécies floridas
continuam na mistura porque o que importa nelas é a silhueta — o guarda-chuva largo do
flamboyant, a copa estratificada do jacarandá.

A biblioteca já gravada foi repintada por `arvores/recolorir.py`, **sem Blender**. O
gerador pinta cada vértice como `base × k`, onde `k` junta o jitter por face e o gradiente
vertical da copa; o script descobre de qual base o vértice veio pela **cromaticidade** (que
`k` não altera), mede o `k` e reescreve com a base nova, preservando o brilho. Duas
armadilhas, as duas medidas:

- **A casca tem que entrar na disputa.** Marrom (`#4A3A2C`) fica cromaticamente mais perto
  do amarelo do ipê do que do verde da folha: sem a casca como terceira candidata, o
  tronco de toda árvore florida virava verde. Foram 472 vértices.
- **Canal saturado mente na divisão.** A flor amarela do ipê (`#F2CE22`) satura o vermelho
  no topo da copa, onde `k` passa de 1. O `k` sai da mediana dos canais utilizáveis, não
  da média dos três.

Auditado depois: as cinco espécies floridas ficaram **100% em matiz verde**, e o que
sobra fora do verde é tronco de palmeira e de eucalipto, que é o certo.

## 9. A rua ganhou textura (2026-08-30)

A fita da rua era cor chapada — `flat(K.road)` e `flat(K.walk)`. Agora ela é desenhada
no fragmento, pelo mesmo caminho que a fachada usa pra janela: **nenhuma imagem entra na
página.** Textura de imagem custaria bytes embutidos (a página abre por duplo clique, não
busca nada), `uv` por vértice e um `map` por material; desenhada no shader custa um
atributo que a `buildRibbons` já tinha em mãos.

**`aVia` = (u ao longo do eixo, v transversal, ROAD_W/2 da via)**, o análogo do `aFace`
da fachada. Sem ela, o shader só teria posição de mundo, e junta de calçada em rua
diagonal sairia alinhada com o norte — o defeito clássico de textura em espaço de mundo.
Com ela o shader sabe onde está o meio da pista, onde o asfalto acaba e pra que lado a
rua corre. O `u` é acumulado ao longo da via inteira, não por trecho, senão a fiada de
placas reinicia a cada vértice da polilinha.

O que é desenhado:

| | pista | calçada |
|---|---|---|
| mancha larga (0,075 c/m) | recapeamento, remendo | idade do concreto |
| trama média (0,62 c/m) | textura do asfalto | — |
| grão fino (9 c/m, célula) | agregado | agregado |
| direcional | rodado das duas faixas de pneu, borda gasta na sarjeta, faixa de bordo só onde `base ≥ 5 m` | junta transversal a 1,15 m, longitudinal a 0,95 m **medidas do meio-fio**, e o meio-fio claro |

A malha grande de asfalto (`street_tris`, o preenchimento de cruzamento) leva só grão em
espaço de mundo: ela é triângulo solto, sem direção de rua nenhuma.

**Custo medido:** 38 malhas de fita, 151.836 vértices, **1,74 MB** de vídeo no `aVia`.
Zero byte na página e zero chamada de desenho a mais — a fita já eram duas malhas por
quarteirão.

### As quatro armadilhas, todas de sintaxe

Nenhuma delas apareceu como "está feio"; todas apareceram como tela em branco.

1. **Crase dentro de template literal.** Um comentário GLSL escrito com \`fade\` fechou a
   string JS no meio do shader. `Uncaught SyntaxError: missing ) after argument list`.
2. **O prefixo tem que terminar em quebra de linha.** O shader do three começa com
   `#define PHONG`; concatenar um prefixo sem quebra de linha final produz
   `}#define PHONG` e o GLSL recusa com `'#' : invalid character`. A `facadeMaterial`
   já fazia certo, e é por isso que o erro nunca tinha aparecido antes.
3. **`customProgramCacheKey` não é opcional aqui.** O three usa
   `onBeforeCompile.toString()` como chave: calçada e pista têm a mesma função e
   compartilhariam o programa com o uniform errado.
4. **Escape de quebra de linha em heredoc de shell não sobrevive.** Editar o `app.js`
   por `python - <<'EOF'` transformou o `\n` de dentro de uma string JS em quebra de
   linha de verdade, partindo a string ao meio. Bloco de shader se edita por ARQUIVO,
   não por heredoc — e esta linha aqui foi escrita duas vezes pelo mesmo motivo.

### O asfalto era mais claro que a calçada

Medido no pixel, num corte transversal da rua: a pista renderizava a **luminância 197** e
a calçada a ~170 — o asfalto mais claro que o concreto, o inverso do real. Não era erro de
paleta: `K.road` é `0x5A6774`, um cinza-azulado escuro, que a luz mais o ACES mais a saída
sRGB levantam até quase o branco.

O conserto começou por **separar dois conceitos que dividiam uma constante**: `K.road`
também pinta as linhas da malha viária sempre residente, que precisam continuar legíveis
sobre o vazio. Escurecer a pista escureceria essas linhas junto. Hoje `K.asfalto`
(`0x1E2226`) é a fita da pista e `K.road` continua sendo a linha de contexto.

A malha de preenchimento do cruzamento desceu junto (`0x28303B` → `0x1C2229`), e por um
motivo que não é óbvio: ela é `MeshBasicMaterial`, **sem luz**, então o mesmo hex
renderiza mais claro nela do que na fita, que é `MeshPhong`. Deixá-la no valor antigo
faria o cruzamento ficar mais claro que a rua que chega nele.

Resultado: pista em ~105–140 de luminância, calçada em ~155–185. E a textura ficou bem
mais visível — o ACES comprime muito menos na parte média da curva do que no topo, onde a
rua vivia antes.

### Calibrar contra o ACES, não contra o hex

A amplitude foi calibrada três vezes: 0,085 (invisível), 1,20 (mosaico de diagnóstico) e
0,42 (o valor final). A razão de o primeiro palpite errar por 5× é o mesmo tone mapping
que já obriga o telhado a ser ~20% mais escuro que a cor de catálogo: com
`ACESFilmicToneMapping` mais saída sRGB, ±7% no material vira ±3% na tela, na parte alta
da curva onde a rua vive.

O alcance também errou na primeira: o detalhe sumia entre 90 e 260 m, e a câmera do mapa
fica a ~240 m — a textura estava correta e invisível exatamente onde o mapa é usado. Hoje
são duas distâncias separadas, `perto` (70→230 m) pro grão, que vira cintilação quando
fica sub-pixel, e `medio` (260→780 m) pra junta e rodado.

## 10. O quadro ficou preguiçoso (2026-08-31)

Os níveis de gráfico atacaram preenchimento e trabalho de fragmento. O que sobrou, e
que nenhum nível resolve, é trabalho de **CPU que o `frame()` refazia sem precisar** —
e o quadro mais comum de todos é o do usuário parado, olhando a cidade.

**O laço de rótulo de rua rodava sempre.** São até 2.000 rótulos; cada um custa três
amostras de `terrainY()`, três `project()` e uma escrita de `style.transform`. Em
Ribeirão Preto são 1.193 rótulos vivos: ~3.600 projeções e até 1.193 escritas de DOM
por quadro, pra pintar exatamente os mesmos pixels enquanto ninguém mexe na câmera.
Agora o laço só roda quando `camera.position`, `innerWidth/Height` ou `reliefAmount`
mudam. `camera.position` sozinho já resume alvo, θ, φ e raio, porque a rotação sai do
`lookAt` sobre o alvo; a primeira pessoa, que gira sem andar, só existe com `INT.on` e
cai no ramo que esconde tudo.

**A chave errada quase passou.** A primeira versão usava `labels.length` pra detectar
rótulo novo entrando pelo streaming. Só que `rebuildOverlay()` **refaz a lista inteira**
quando o conjunto vivo muda, e ela volta com elementos NOVOS — que nascem
`display:none` — às vezes no MESMO tamanho. Resultado medido: andar pela cidade apagava
o rótulo de rua, e ele só voltava quando outra coisa invalidasse a guarda. Quem mexe na
lista agora avisa por `sujaRotulos()`, nos dois lugares que a esvaziam
(`rebuildOverlay`, `resetScene`), e o comprimento saiu da conta.

**O relevo do rótulo virou constante.** A rua não anda: `terrainY()` nos três pontos de
cada rótulo é congelado na criação (`dyDoRotulo`) e só o botão Relevo o invalida. Era a
única das três amostras por rótulo por quadro que dava pra matar sem mudar a imagem.

**A passada de sombra sumiu de onde ninguém projeta.** Em "baixo" e "médio"
`SOMBRA_CIDADE` é `false` e, medindo a cena montada, nada da cidade projeta nem recebe
— mas o mapa de sombra continuava sendo redesenhado a cada metro que o alvo andava:
percorrer o grafo inteiro pra desenhar nada, mais bind e clear do alvo de profundidade.
Agora `needsUpdate` só liga com `SOMBRA_CIDADE || INT.on`. **Desligar
`renderer.shadowMap.enabled` daria o mesmo e foi descartado**: o three exige
`material.needsUpdate` em TODO material depois de trocar essa flag, o que seria
recompilar a cidade inteira na entrada da casa — exatamente o congelamento que a nota
do `SOMBRA_CIDADE` já evita. `INT.on` cobre a casa inteira, voo de entrada e de saída
inclusive.

`STREAM_MS` caiu de 6 pra 4 ms em "baixo": quem está com 20 FPS não tem 6 ms por quadro
pra emprestar pro streaming.

**O que NÃO foi feito, e por quê.** A guarda de `resize()` já existia desde o v8 e
compara as dimensões em PIXEL do canvas, não `innerWidth/innerHeight`. Trocar por uma
guarda de largura/altura mataria o governador de resolução em silêncio: ele chama
`setPixelRatio()` e em seguida `resize()` **com a janela do mesmo tamanho**, e é
justamente aí que a alavanca mais forte que existe é aplicada. Cache de
`terrainY(target)` também ficou de fora: o alvo é amostrado uma vez por quadro, não
duas — `interiorFrame()` não o amostra.

### Como isso é testado

`pipeline/testa_quadro_preguicoso.py`, nas 5 cidades × 2 níveis. As duas economias são
a mesma aposta e quebram do mesmo jeito: não é "some", é "NÃO VOLTA".

- Suja o `transform` de TODO rótulo visível, dá dois quadros parados: nenhum pode
  voltar. (Sujar UM só dava falso negativo em 3 das 5 cidades — o elemento escolhido
  sai do DOM no `rebuildOverlay` e o teste passa a medir órfão.)
- Anda com o alvo, drena o streaming: nenhum rótulo pode sobrar com a marca, e a
  contagem de visíveis tem que ser > 0.
- Desliga e liga o botão Rua **com a câmera parada** — a armadilha da guarda.
- `sun.shadow.map` tem que ser `null` em "baixo" e não-`null` em "alto". Esse é o
  controle: sem ele a medida não prova nada.

Duas armadilhas do próprio teste, que custaram tempo:

- **O rAF morre no headless depois de ~6 quadros.** Medir pelo laço normal aprova
  qualquer coisa: com `--virtual-time-budget` os temporizadores adiantam mas o quadro
  não vem. Os quadros passaram a ser dados na mão por `__perf.passo()`, irmão do
  `mede()` — um quadro COMPLETO fora do rAF, com `_semRaf` pra não agendar um segundo
  laço por cima do que já roda.
- **O navegador resserializa o `transform`**: escrevi `translate(-999px,-999px)` e ele
  devolve `translate(-999px, -999px)`, com espaço. Comparar com a string escrita reprova
  sozinho.

Com a correção desfeita à mão, o teste reprova nas duas execuções ("nenhum rótulo de rua
visível no enquadramento inicial"); desfazendo o desfazimento, volta a passar. Os 45
portões das 5 cidades e `testa_duplo_clique.py` (5 de 5) continuam passando.

**Não dá pra medir o ganho aqui.** `performance.now()` não anda dentro de JS síncrono
sob `--virtual-time-budget`: as três medidas saem 0,000 ms. O que dá pra afirmar é o
trabalho que deixou de existir — por quadro parado, 1.193 iterações com 3 `project()`
cada e até 1.193 escritas de DOM, mais a passada inteira de sombra. O número em
milissegundos tem que sair da máquina fraca, com o HUD ligado (tecla **P**), como já
valia pros níveis de gráfico.

## 11. Fase 2: a cidade ganhou tom (2026-08-31, só Ribeirão Preto)

Sete mudanças de aparência, todas sobre o que já existia — cor por vértice, semente
estável, `aFace`/`aStyle`. **Zero triângulo e zero chamada de desenho a mais**: medido
no mesmo enquadramento, 309 draw calls antes e 309 depois.

**Aplicado só a Ribeirão Preto por enquanto**, e a distinção importa: o renderizador é
UM só, então o que separa as cidades é o que foi remontado. `v11/ribeirao-preto-*` saiu
com a Fase 2; as outras quatro páginas continuam sendo o build anterior e **vão pegar a
Fase 2 na próxima montagem**, inclusive uma disparada por outro motivo. Se a intenção
for travar isso de verdade, o lugar é uma chave em `padrao/cidades/<slug>.json`, não o
código.

### Fachada (2.1, 2.2) — no fragmento, não no vértice

A parede já tinha rampa vertical por vértice (`lo` na base → 1,0 no topo). O que ela
**não sabe fazer é faixa**: entre dois vértices o rasterizador interpola em linha reta,
e foi exatamente essa a armadilha que a gradação da parede do interior levou (§7). Pôr
embasamento e platibanda por vértice exigiria fatiar a parede — multiplicando o
triângulo da cidade inteira, na malha que já é a maior da cena.

As duas faixas foram pro **fragment shader da fachada**, que já recebe `vFace.y` (altura
na parede) e `hU` (topo da laje):

- **Embasamento em METROS**, não em fração da altura: soleira e rodapé de fachada têm
  tamanho físico, ~60–90 cm, iguais em casa e em torre. `smoothstep(0, 0.90, y)`, 10%.
  A rampa do vértice subiu de 0,76 pra 0,82 pra compensar — no chão as duas se somam e
  dão ~0,70, que é o alvo do plano.
- **Platibanda** é `step(hU + 0.05, y)`: acima da laje não existe pavimento, só
  parapeito. Sai 25% dessaturada e 10% puxada pro branco, e é ela que recorta o prédio
  contra o céu. **Não precisou chutar "os 10% de cima"** — `hU` diz onde ela começa de
  verdade, e telhado inclinado (`ph = 0`) não entra sozinho, porque ali a parede termina
  exatamente em `hU`.

A cor por vértice **não pode passar de 1,0**: o atributo é `Uint8Array` normalizado. Por
isso o topo do corpo fica em 1,0 e quem clareia acima disso é a platibanda, no shader.

### Cor de parede e de telha (2.3, 2.4)

Casa e sobrado ganharam o dobro de variação de saturação e luminância (0,10 contra 0,05
e 0,075) — pintura de casa é escolha de morador, fachada de prédio é projeto. A telha
dobrou a variação de luminância (0,06 → 0,12) e ganhou um desvio pequeno de matiz.

**As sementes novas (`s6`, `s7`) não são preciosismo.** `s2` e `s3` já escolhem cor de
parede, forma da água e o índice do leque de telha. Reusá-las pro desvio de matiz
amarraria o desvio ao índice do leque: cada cor do leque sairia sempre com o MESMO
desvio, que é o oposto de variedade.

### Arborização (2.5, 2.6, 2.7)

- **NDVI com curva côncava** (`pow(ndvi, 0.7)`): a reta antiga saturava em 0,55 de NDVI
  — dali pra cima era tudo mata fechada igual — e ainda punha 18% de árvore no canteiro
  pelado.
- **Espécie em MANCHA.** Sortear espécie por árvore dá confete; cidade real planta rua
  inteira de sibipiruna e depois um quarteirão de ipê. A mancha é uma célula de 30 m
  sorteada pela POSIÇÃO, não pela ordem do laço, então **ela continua a mesma depois
  que o streaming descarta e remonta o quarteirão**. Detalhe que o plano errava: a
  mancha passa pela mesma roleta da cidade (`ARV.sorteia`), com o número da célula no
  lugar do sorteio. Indexar `ARV.cat` direto — como estava escrito — poria numa rua uma
  espécie que a cidade só usa em praça, ou que ela não usa; a mistura é da cidade (§8).
- **Porte varia com o tamanho da espécie**: ±30% acima de 12 m, ±20% abaixo. Duas copas
  de 14 m idênticas lado a lado denunciam o instanciamento; duas de 6 m, não.

Mexer em `put()` muda o **número e a ordem** das chamadas de `sorte()`, e o sorteio é um
contador compartilhado — a árvore inteira da cidade se reembaralha, posição inclusive.
Não é efeito colateral escondido, é o preço, e por isso o portão da árvore foi refeito.

### O que foi medido

Nove portões passando. O da árvore, que é o único que a Fase 2 mexe: **1.596 árvores de
rua, 0 além da fita e 0 sobre o asfalto**, 20 espécies vivas, 2.410 árvores na cena
(era 1.514 / 2.326). `testa_duplo_clique` e `testa_quadro_preguicoso` continuam
passando.

**Shader que não compila NÃO levanta exceção em JS** — o three loga e segue desenhando
com o que tinha. A sonda de print (`console.error`/`warn` interceptados) fecha esse
buraco: 0 erro de programa nas quatro capturas. E uma crase dentro do comentário GLSL
**encerra o template literal** do `onBeforeCompile` e derruba o arquivo inteiro; foi o
primeiro erro de sintaxe da tarde.

Pares antes/depois no mesmo enquadramento (centro, bairro e torre) confirmam: a
platibanda vira faixa clara no topo dos prédios de laje, o embasamento escurece a base,
telhado e parede separam melhor dois vizinhos, e a arborização deixou de ser confete.

## 12. Fase 3: sombra, varanda e caixa d'água (2026-08-31, só Ribeirão Preto)

Quatro detalhes de geometria, no mesmo escopo da Fase 2 (§11): só Ribeirão remontado, as
outras quatro páginas pegam na próxima montagem. Custo medido no mesmo enquadramento:
**340 → 341 chamadas de desenho** (+1, a sombra) e 248 mil → 269 mil triângulos de
fachada (+8%).

### 3.1 A sombra de contato, e por que os números do plano não funcionavam

Nada na cidade projeta sombra de verdade — `castShadow` é `false` em prédio, muro e
árvore desde o v8 — então todo volume aparece colado no chão, sem contato. O plano pedia
um plano preto a 12% na base de cada prédio, "~10% maior que a pegada".

**Uma malha por quarteirão estava fora de cogitação.** Medido: 901 quarteirões vivos e
340 chamadas de desenho no total. Uma malha de sombra por quarteirão praticamente
dobraria a conta, no que é o gargalo medido (23 µs por chamada). A sombra virou **uma
InstancedMesh só, refeita quando o conjunto vivo muda** — o mesmo desenho da árvore do
v10: 6 triângulos de geometria, uma matriz por prédio, **uma chamada** não importa
quantos quarteirões vivam.

Duas coisas que o plano especificava e que **não sobreviveram à medição**:

1. **O quad deitado sumia visto de cima.** Ordem de vértice errada, `side` padrão
   `FrontSide` — a mesma armadilha que apagou a laje do telhado no v7 (§ do anel
   invertido). Não dava erro nenhum: desenhava, contava chamada, e não pintava pixel.
   Só apareceu pintando as instâncias de **vermelho opaco** numa sonda. `DoubleSide`
   resolve e mata a classe inteira.
2. **Anel simétrico de 10-18% é invisível.** Com a margem em porcentagem do retângulo
   mínimo, uma casa ganha 45 cm de anel — quase todo escondido embaixo da própria casa
   e atrás do muro do lote. No teste vermelho sobravam duas lascas de 3 px por
   quarteirão. Mesma lição do embasamento da fachada (§11): **margem é medida em
   metros, não em fração**.

O que ficou: sombra **projetada**, deslocada na direção da luz. O sol acompanha a
câmera, então a direção é constante na cidade inteira — virou `SOL_OFF`, lida também
pelo `sun.position.set` do laço (era o mesmo trio de números em dois lugares). O
comprimento sai da altura pela razão da geometria do sol, e o quadrilátero é a caixa do
volume varrido: centro no meio do caminho, cada eixo crescido do quanto a sombra andou
nele. **Teto de 11 m de altura efetiva**: a sombra literal de uma torre de 60 m seria um
tapete de 50 m atravessando três lotes e, sem mais ninguém na cidade projetando, leria
como erro.

Em "baixo" o raio cai de 620 m pra 380 m: é a única coisa transparente que cobre área de
chão, e preenchimento é justamente o que falta na iGPU.

### 3.2 Varanda

Só em PRÉDIO/TORRE com mais de 8 m, e **só na face mais longa** — a que olha a rua na
esmagadora maioria dos lotes. Fatiar as quatro faces multiplicaria por quatro a malha de
parede, que já é a maior da cena. A face vira faixas: trecho reto, piso da varanda
(retorno horizontal virado pra cima), fundo recuado 20 cm, teto da varanda (retorno
virado pra baixo). São os dois retornos horizontais que dão o relevo — um pega luz, o
outro é sombra.

Os retornos vão marcados com `aFace.y = -1`, igual ao telhado: são laje, não fachada.
Sem isso o shader desenharia uma fileira de janela atravessada na soleira. O fundo, ao
contrário, continua com `aFace.y` real — é onde a janela deve mesmo aparecer.

Medido no histograma de tipologia: os vértices de PRÉDIO foram de 7,9 mil pra 25,7 mil e
os de TORRE de 2,7 mil pra 11,1 mil. Como os dois somam 1,5% da parede da cidade, o
total subiu 8%.

**Dívida assumida:** o ritmo da fachada (`peD` e `pv` por tipologia) agora é **cópia** do
GLSL em JS. Sem bater com ele, a varanda cortaria a fileira de janela no meio. É do mesmo
naipe da tabela de vias — o certo seria uma fonte só, e o shader não lê JS.

### 3.3 e 3.4

Caixa d'água em ~35% das casas (era 22%) e com quatro cores em vez de uma: azul de
polietileno (o comum na rua), concreto, azul escuro e fibra branca.

**A porta do 3.4 já existia** — e numa forma melhor que a proposta. O shader da fachada
desenha portão/entrada numa coluna sorteada pela semente do prédio (`porta` em
`facadeMaterial`) desde a tipologia. O que faltava era ela valer só pra CASA, SOBRADO e
ANEXO: PRÉDIO e CIVICO não tinham entrada nenhuma. Foi isso que entrou. A forma proposta
— escurecer dois vértices da base — **não funciona**: a parede tem quatro cantos e nada
entre eles, então tingir vértice faz gradiente no pano inteiro, não faixa de 90 cm. É a
mesma limitação do §11.

### Verificação

Nove portões passando (a árvore não mudou: 1.596 de rua, 0 fora da calçada),
`testa_duplo_clique` e `testa_quadro_preguicoso` idem, 0 erro de shader nas capturas.

## 13. Fase 4: o marcador ficou preguiçoso também (2026-08-31, só Ribeirão Preto)

Dos quatro itens da fase, **um foi implementado, um já estava pronto e dois foram
recusados com número na mão**. O que decidiu foi medir antes de escrever.

### 4.1 POI — o maior item de CPU que sobrou

Medido em Ribeirão: **1.197 POIs para ~100 visíveis**. O laço fazia, por quadro e para
todos os 1.197: uma amostra de `terrainY`, um `Vector3.project` (multiplicação de
matriz), um `distanceTo` e uma escrita de `style.display`. Era mais trabalho que o laço
de rótulo de rua da Fase 1 (§10).

Três mudanças, todas já provadas ali:

1. **O relevo do POI virou constante.** O estabelecimento não anda; só o botão Relevo
   invalida (`recalcDyPois`), igual ao `dyDoRotulo`.
2. **A distância vem ANTES da projeção**, e sem `Vector3`. O código projetava os 1.197
   para só então comparar com `POI_MAX` (4.200 m) e descartar a maioria. Agora o
   quadrado da distância decide primeiro e `project()` só roda em quem sobrou.
3. **Guarda de câmera parada**, chave = posição da câmera, janela, relevo e `poiSel` (o
   selecionado ignora a colisão de rótulos e muda o empacotamento). Categoria, botão
   Pins e Relevo avisam por `sujaPois()`.

**A proposta original não caberia aqui:** ela projetava os quatro cantos da tela em
lat/lon e testava cada POI contra esse retângulo. O renderizador trabalha em METROS
(`x`, `z`), não em lat/lon — e um retângulo no chão é uma aproximação pior de um frustum
inclinado do que a projeção exata que o código já fazia. O ganho verdadeiro não estava
em trocar o teste de visibilidade: estava em **não rodar o laço**.

`testa_quadro_preguicoso.py` ganhou quatro critérios de POI, com o mesmo desenho dos de
rótulo (sujar o `transform` de todos os visíveis, dois quadros parados, e o botão Pins
desligado/religado com a câmera parada). Controle: tirando as duas invalidações à mão,
"botão Pins religa com câmera parada" reprova (0 POIs visíveis) nas duas execuções.

Detalhe do controle que vale anotar: tirar SÓ o `sujaPois()` do botão continua passando,
porque o ramo `poiHidden || dentro` do `updatePois` também invalida. O teste só reprova
quando as duas saem — o que está certo, mas mostra que um controle mal escolhido
"prova" a coisa errada.

### 4.3 Já estava feito, e a premissa não valia

`pintaPerf()` já sai na primeira linha quando o medidor está desligado; `renderer.info`
só é lido depois disso. E `renderer.info` **não faz flush de contador de driver** — são
contadores JS que o próprio three incrementa durante o render. Ler não custa nada.

### 4.2 Recusado: a conta é 2.410, não 20 mil

A proposta partia de "~20 mil composições de matriz por mudança de conjunto vivo".
Medido: são **2.410 árvores na cena** (e 1.410 sombras). Os 18.534 plantios que os 901
quarteirões vivos guardam **não são varridos** — o filtro de raio (850 m) roda antes de
qualquer coisa entrar na lista de candidatos. O custo real de um `refazArvores` é 901
testes de distância mais ~2,4 mil composições de matriz: décimos de milissegundo.

Contra isso, o rebuild incremental pede um `Map` de delta por quarteirão e traz de volta
a classe inteira de bug de índice defasado que o comentário do v10 diz, com todas as
letras, ter sido evitada de propósito. **Trocar um problema medido em décimos de
milissegundo por essa classe de bug é mau negócio.** Se o número mudar — outra cidade,
outro raio — a conta muda junto e vale reabrir.

### 4.4 Recusado: r128, e o ganho de "20-40%" não é propriedade de versão

O three aqui é **r128**. Três motivos para não subir agora, e nenhum deles é preguiça:

- **O renderizador vive de remendar chunk de shader por nome.** `#include
  <color_fragment>`, `#include <begin_vertex>`, `lights_fragment_begin`, `RECEIVE_SHADOW`
  — em quatro materiais diferentes (fachada, via, muro, interior). Nome de chunk mudou
  entre r128 e r15x; cada um vira um shader que não compila, e **shader que não compila
  não levanta exceção** (§12).
- **O espaço de cor foi calibrado contra este renderer.** O r152 trocou o padrão de
  gerenciamento de cor. Exposição do ACES em 1,18, `rgbAcabamento()` saturando o
  acabamento na medida do que o tone mapper come, a nota do `LinearEncoding` — tudo isso
  foi ajustado olhando pixel. Um salto de versão reabre a calibração inteira.
- **"20-40% de ganho no renderer" não é uma propriedade de subir de versão.** O gargalo
  medido aqui é submissão de chamada de desenho (23 µs cada) e preenchimento; nenhum dos
  dois muda porque o three é mais novo. O que mudaria de verdade seria WebGPU, que é
  outro backend e outro projeto.

O caminho honesto, se for pra fazer: subir numa branch, revalidar os quatro
`onBeforeCompile` um a um contra os portões, e recalibrar cor com print de controle. É
uma tarefa própria, não um item de lista.

### Verificação

Nove portões passando, `testa_duplo_clique` e `testa_quadro_preguicoso` (agora com 10
critérios) idem, 0 erro de shader.

## 14. O que tinha sido recusado, feito assim mesmo (2026-08-31)

Cinco itens que eu tinha recusado ou entregue de outra forma nas fases 1 a 4 foram
pedidos de novo, explicitamente. Todos foram feitos. **Dois deles provaram que a recusa
estava errada, e um provou o contrário do que eu tinha dito.**

### 1.1 — a recusa estava ERRADA

Eu tinha recusado a guarda de `innerWidth/innerHeight` no `resize()` dizendo que ela
mataria o governador de resolução, porque `governa()` chama `setPixelRatio()` e em
seguida `resize()` com a janela do mesmo tamanho. **Está errado**:
`WebGLRenderer.setPixelRatio` chama `this.setSize(...)` por conta própria — dá pra ler
no r128 minificado, `setPixelRatio=function(t){void 0!==t&&(P=t,this.setSize(R,C,!1))}`.
O `resize()` seguinte é redundante pra esse caso.

A guarda entrou como pedida, e junto veio `pipeline/testa_governador.py`, que faz o que
o governador faz (`setPixelRatio` → um quadro) e pergunta ao canvas se o tamanho em
pixel acompanhou, nos dois sentidos. Medido: 1084×605 → 542×302 e de volta. O
governador continua chegando na tela.

### 1.2 e 3.4 — feitos como pedidos, e o que eles de fato rendem

`terrainYCached` entrou com uma casa de cache no alvo da órbita. 3.4 entrou nas duas
formas: o mecanismo literal (escurecer o vértice da base perto da porta) **e** a porta
do shader estendida pras tipologias que faltavam (COMÉRCIO, TORRE e GALPÃO, além de
PRÉDIO e CIVICO da Fase 3). O comentário no código registra o que cada uma consegue: a
parede é um quad de quatro cantos, então o mecanismo por vértice só age quando a porta
cai a menos de 45 cm de uma ponta do pano; quem desenha faixa de 90 cm em qualquer
fachada é o shader.

### 4.2 — o remendo da arborização, e o bug que ele trouxe (como previsto)

Entrou com livro-caixa explícito (`arvSlot` diz quem ocupa cada instância, `arvPorRec`
o que cada quarteirão colocou), remoção por troca-com-o-último em O(1), e queda pro
caminho completo no que o remendo não sabe fazer (relevo, teto de instâncias,
`resetScene`).

Junto entrou `pipeline/testa_arvore_incremental.py`, que estressa o caminho do remendo
e chama `__perf.confereArvores()` — que roda o caminho **completo** num rascunho e
compara planta a planta. **Sem ele isto não deveria ter entrado**, e ele provou por quê:
reprovou na primeira execução. Andar 150 m não monta nem descarta quarteirão nenhum,
mas muda **quem está dentro do raio de 850 m**; o remendo ficou com 2.410 árvores onde o
completo dava 732.

O delta certo não é "quarteirão que entrou e saiu do streaming", é **pertinência ao
raio**. E aí apareceu uma coisa melhor: a varredura de pertinência custa os mesmos ~900
testes de distância do caminho completo, mas **zero matriz** quando ninguém cruza a
fronteira. Como ficou barato, passou a rodar a cada metro andado — e a defasagem de até
200 m na borda do raio, que existia desde o v10 e ninguém tinha medido, **deixou de
existir**. O remendo saiu mais correto que o código que substituiu.

### 4.4 — three r128 → r168

Feito, e **visualmente sem perda**: com o mesmo `app.js`, trocando só a biblioteca,
**100% dos pixels ficam dentro de 1/255** e o brilho médio não muda (138,3 → 138,3).
`pipeline/compara_print.py` é quem mede isso.

O caminho:

- **O three não publica mais build UMD** depois do r150 — só ESM e CJS. Módulo ES não
  carrega em `file://`, e a página abre por duplo clique de propósito. Foi empacotado
  como IIFE com global (`esbuild --format=iife --global-name=THREE`): 589 KB → 663 KB.
- **Os quatro `onBeforeCompile` sobreviveram intactos.** `begin_vertex`,
  `color_fragment` e `clipping_planes_fragment` continuam existindo no r168, e
  `vViewPosition` também. Era o risco que eu tinha levantado; conferido antes de trocar.
- **`ColorManagement` fica DESLIGADO de propósito.** Ligado, todo `setHex`/`setRGB`
  passa a ser sRGB convertido pro espaço linear, e a cidade inteira foi calibrada contra
  a semântica do r128. Desligado, o r168 se comporta igual nesse ponto.
- **O que de fato mudou foi a luz.** O r155 tirou o fator π que o renderer aplicava
  sobre a intensidade de toda luz (`useLegacyLights`, removido de vez no r165). Medido
  no A/B controlado: a mesma parede sob o mesmo sol dava (219,218,217) no r128 e
  (153,152,149) no r168; multiplicando sol **e** hemisférica por π o pixel volta a
  (219,218,217) — idêntico, não parecido. O fator mora num lugar só (`LUZ_PI`), pra os
  números do resto do código continuarem sendo os calibrados.

**O interior precisou de recalibração de verdade**, e o controle externo não conseguia
enxergar isso: `mede_interior.py` caiu de 155,5 pra 147,0. Não era sombra (desligando a
sombra nas duas versões o desvio continua: 156,3 contra 148,2) e não era a lâmpada em
si. É a **queda de luz pontual**: deixou de ser a rampa normalizada do modo legado e
virou inverso do quadrado com janela — a 3 m da lâmpada o mesmo número rende ~4× menos.
A luminária foi de 0,58 pra 1,20 e o interior voltou pra 154,8, com queimado 0,0%.

**"20-40% de ganho" continua não sendo uma propriedade de subir de versão**: as chamadas
de desenho e os triângulos são os mesmos (353 e 1,31 M no mesmo enquadramento). O que se
ganha é ficar em cima de uma versão mantida.

**O rollback é um `cp`.** O r128 está em `_arquivo/three/`, e o `app.js` foi escrito pra
rodar nas duas versões — `LUZ_PI` olha `THREE.REVISION`, e `outputColorSpace`/`colorSpace`
caem pra `outputEncoding`/`encoding` quando não existem. Foi assim que o A/B controlado
foi feito, e é o que torna a volta trivial.

### Verificação

Nove portões, `testa_duplo_clique` (o `file://` era o risco de trocar a biblioteca),
`testa_quadro_preguicoso` (10 critérios), `testa_governador`,
`testa_arvore_incremental` e `mede_interior`: todos passando. 0 erro de shader.

## 15. O chão que não existia, e o asfalto preto (2026-08-31)

Veio de uma foto: da janela de um apartamento cadastrado em Ribeirão dava pra ver a
**parte de baixo** de outro pedaço da cidade, e o chão simplesmente sumia num naco enorme
do quadro. As duas coisas são o mesmo defeito.

### O diagnóstico, que o olho não daria

Chutar aqui não serve — "sumiu" pode ser corte de frustum, plano de corte, névoa,
ordem de desenho ou buraco de dado, e todas parecem iguais na tela. O que resolveu foi
pintar: chão de quarteirão em **vermelho**, malha de rua em **verde**, muro em **azul**,
céu escondido e `clearColor` em **ciano**. Metade do quadro saiu ciano puro — não é
coisa desenhada errado, é coisa que **não existe**.

Por quê: chão e rua só existem onde há QUADRA, e a quadra é a face do grafo de ruas.
Várzea, chácara, aeroporto e área militar não têm rua dentro, não viram face, não ganham
chão. E como as duas malhas são superfícies de espessura zero em `DoubleSide`, pelo
buraco se via a **barriga** do bairro que o relevo (4,5×) tinha levantado do outro lado
do vale. Uma causa, dois sintomas.

### O terreno de fundo

Uma superfície contínua por baixo de tudo, tirada da MESMA grade de elevação que já está
na página (80×80, célula de 240 m). **Zero byte de página**: é a grade subdividida por 4,
199.712 triângulos numa única chamada de desenho, ~1,5 MB de vídeo e 160 ms de boot (de
~1,1 s do app inteiro).

Três armadilhas, todas medidas e nenhuma visível num teste de "abriu?":

1. **Dois triângulos por célula não reproduzem a bilinear** que o `terrainY` devolve. O
   erro é o termo de torção `(a+d-b-c)/4`, e ele muda de cidade pra cidade: 23,6 m em
   Rio Preto, 93,4 m em Sorocaba. Subdividir divide por SUB², e a folga sai daí — medida
   no boot, não constante. Um 3 fixo calibrado em Ribeirão deixaria remendo verde no
   meio de Sorocaba.
2. **O chão detalhado também afunda.** Ele amostra o `terrainY` nos VÉRTICES do polígono
   da quadra, e um polígono grande vira um triângulo de centenas de metros que corta a
   encosta em linha reta — em Ribeirão o pior afunda 18,7 m abaixo do terreno real. Uma
   folga uniforme que cobrisse isso seria um degrau de 20 m em toda borda de buraco.
   Então cada NÓ do fundo desce, além da folga, o tanto que o triângulo de detalhe que
   passa por ele afundou. O fundo fica colado no detalhe e mergulha só debaixo da quadra
   que afundou, onde ninguém vê.
3. **Extrapolar o plano do triângulo pra fora dele é veneno.** A margem de um passo
   precisa existir (senão a célula que atravessa a divisa sobe de volta por cima do
   detalhe), mas continuar o plano por ela produziu **mergulho de 4.389 m** num triângulo
   esquio — um poço de 4 km numa célula só, que o conferidor não pegava (ele só pergunta
   se o fundo está ABAIXO) e que apareceria na tela ao lado de um buraco. Hoje a margem
   grampeia a coordenada baricêntrica, o que amostra o plano no ponto do triângulo mais
   próximo em vez de continuá-lo. Junto com ela vão quatro amostras DENTRO de cada
   triângulo (centroide e meios de aresta): sem elas, triângulo menor que a célula de
   60 m não contém nó nenhum e passa batido — foi o último ponto a espetar, 1,4 m em
   Araraquara.

`pipeline/testa_terreno_base.py` é o conferidor: 2.304 pontos por cidade, um raio de 2 km
de altura em cada, contra o fundo e contra o detalhe. Cobertura tem que ser 100%, o fundo
tem que estar abaixo do detalhe, e o mergulho tem que ser plausível (< 300 m — foi esse
critério que pegou o poço de 4 km). Cinco cidades, tudo em ok.

### O asfalto

`K.asfalto` foi de `0x1E2226` (30,34,38 — cinza praticamente neutro) pra `0x141B29`
(20,27,41), com o azul quase o dobro do vermelho; medido no pixel de perto, a pista saiu
de luminância 105–140 pra ~50, em rgb (41,51,66). O preenchimento de cruzamento andou
junto e virou `K.asfaltoPlano` — era um literal solto dentro do `buildStreets`, e ele
precisa ser um pouco mais escuro que a fita porque é `MeshBasic`, sem luz.

E a **faixa central tracejada saiu da geometria e entrou no shader**. Era o
`buildDashes`: uma malha por quarteirão, só em via grande, e só no nível de gráfico alto
(vivia dentro de um `if (!LIGHT())`). A fita já carrega `aVia` = (u ao longo do eixo, v
transversal), então a faixa custa **zero chamada de desenho** e agora existe em toda via
e em todo nível. Mesmas medidas de antes: 0,32 m de largura, 3,5 m pintados a cada 7 m. A
tinta continua morando na paleta (`K.mark`), agora como uniform — `THREE.Color` converte
o hex de sRGB pro espaço linear, que é onde o `diffuseColor` vive naquele ponto do
shader.

### Verificação

`testa_terreno_base` (novo, 5 cidades), `testa_duplo_clique` (5 de 5),
`testa_quadro_preguicoso` (5 cidades × 2 níveis), `testa_governador`,
`testa_arvore_incremental` e `mede_interior` (média 154,4): todos passando.

## 16. O telhado virou telha, e a página ganhou busca (2026-08-31)

O pedido foi curto: *"tá parecendo um jogo do Roblox"*. Isso não é uma medida, então a
primeira coisa foi tirar uma **foto de rua** do v11 e olhar o que a frase estava
apontando. O que aparecia na foto, em ordem de área de tela:

1. **O telhado era cor chapada.** O leque de cores separava um telhado do vizinho, mas
   dentro de cada telhado não havia *nada* — nenhuma fiada, nenhuma escala. Num mapa
   olhado de cima, telhado é a superfície que mais ocupa pixel.
2. **A parede também.** Reboco pintado sem mancha, sem escorrido e sem a faixa escura do
   beiral. Uma caixa branca lisa lê como caixa branca lisa.
3. **O muro era uma fita.** 5.500 km de quad vertical com uma cor por segmento, sem
   pilarete, sem capa, sem fiada.

As três têm a mesma causa (falta de detalhe de superfície) e a mesma cura possível
dentro do orçamento deste renderizador: **desenhar no fragmento**, não modelar. O
gargalo medido continua sendo chamada de desenho (23 µs), e qualquer solução que
criasse malha por janela, por telha ou por pilarete estaria resolvendo o problema errado.

### 16.1 A normal do triângulo já sabia para onde a água desce

O telhado sai marcado com `aFace.y = -1` desde o v7 — era a marca de "não é fachada,
não desenhe nada aqui". Agora esse ramo desenha telha, e a única informação nova que ele
precisava **já estava na malha**: a normal.

    vec3  nw   = normalize(vNw);              // normal em espaço de objeto = mundo
    float incl = clamp(length(nw.xz) / 0.45, 0.0, 1.0);   // 0 = laje, 1 = água cheia
    vec2  dirD = normalize(nw.xz);            // a direção em que a água DESCE
    vec2  dirT = vec2(-dirD.y, dirD.x);       // a direção em que a FIADA corre

Com essas duas direções, a fiada (32 cm — telha colonial deitada mede ~46 cm com ~14 de
sobreposição) e o canal (19 cm) saem em qualquer telhado, de qualquer orientação, **sem
UV e sem atributo novo**. `incl` faz o resto sozinho: laje tem `nw.xz ≈ 0`, então não
ganha telha nenhuma — ganha junta de concretagem a cada 2,8 m.

O `vNw` custou uma varying. O renderizador já levava `vMundo` (existe pro furo do
interior), então a posição no mundo veio de graça.

### 16.2 Parede: beiral, peitoril, verga e escorrido

Quatro linhas de shader, todas no ramo de fachada que já existia:

| o que | por que |
|---|---|
| **sombra do beiral**, 45 cm abaixo do topo útil | sem ela o telhado parece *colado* na parede — e colagem é o que faz o volume ler como bloco de montar |
| **peitoril** claro, 9% da célula abaixo da janela | o peitoril pega sol de cima; é o que dá profundidade ao vão |
| **verga** escura no alto do vão | a sombra de dentro do vão, o par do peitoril |
| **escorrido** de chuva a partir da laje | reboco pintado envelhece com risco vertical; sem isso a fachada é chapa de plástico |

O escorrido sorteia por coluna (`h21` da coluna com a semente do prédio), então não é um
efeito uniforme: uns 40% das colunas de cada prédio têm risco, e dois prédios vizinhos
têm riscos diferentes.

### 16.3 O muro: pilarete pela derivada, altura por um byte

O muro precisava de duas coordenadas que ele não tinha: **onde estou ao longo do muro**
(pro pilarete) e **onde estou na altura dele** (pra capa e para o encardido da base).

A primeira sai **de graça**, da derivada da posição de mundo: o quad é vertical e plano,
então `cross(dFdx(vMw), dFdy(vMw))` é a normal da face e o horizontal perpendicular a ela
corre ao longo do muro. Isso dá uma coordenada contínua em metros que **atravessa a
emenda** entre dois pedaços do mesmo segmento — e isso importa: o muro é quebrado a cada
40 m para acompanhar o relevo, e um contador por quad faria o pilarete pular na emenda.

A segunda **não** sai da posição: o relevo já foi somado no Y na CPU
(`applyTerrainToGeo`), então cada pedaço tem a base numa cota diferente e não existe "y
do muro" para ler. Virou atributo `aMv` de **1 byte por vértice** (1,28 MB na cidade
inteira, 1.279.620 vértices).

Com as duas: pilarete a cada 3,2 m (o vão de bloco de concreto comum — e o que se vê não
é o pilar, é a junta de sombra dos dois lados dele), 11 fiadas nos 2,2 m de altura, capa
de concreto no topo e encardido nos 30 cm da base.

### 16.4 Quatro coisas que a página não tinha

Todas pedidas junto, todas sem custo de quadro:

**Busca.** O índice é montado **uma vez**, no `loadCity`, a partir do que o `decode()`
já entregou: via com nome, edificação com nome e POI. Não relê o JSON nem varre o DOM.
São 3.466 itens em São Carlos e 11.249 em Sorocaba. A ordenação é *começa com o termo* >
*tipo* > *distância do alvo atual* — sem a distância, "rua são paulo" numa cidade com
cinco delas manda o usuário para a outra ponta do mapa. Prédio com nome igual ao de um
POI é descartado (os dois vêm do mesmo OSM, e o POI tem ficha).

**Link de posição.** `?em=lat,lon&r=&p=&t=` — o alvo da órbita e os três números que
dizem de onde se olha. Escrito com `replaceState` uma vez por segundo, lido no
`loadCity`. Em `file://` o `replaceState` pode ser recusado pela origem opaca; quando é,
o recurso se desliga sozinho em vez de estourar erro por segundo no console. (No Chrome
testado ele **não** é recusado: o portão `link: reescreve` passa nas cinco cidades.)

**Minimapa.** A primeira versão rasterizava a cidade inteira num canvas de 1.400 px e
cada quadro recortava um pedaço. É barato e é **ilegível**: a largura da linha fica presa
à escala em que o bitmap foi desenhado, então a via ou some quando se afasta ou vira
mancha cinza quando se aproxima — foi o que aconteceu, 170 px de cinza chapado. A versão
que ficou desenha ao vivo, com largura em **pixels**, e segura o custo com um índice por
célula de 600 m: em vez das ~11 mil vias, cada quadro toca algumas centenas. Só redesenha
quando a câmera anda, gira ou aproxima.

**Modo noite.** A alavanca é a **exposição**, não a cor de cada material: chão, rua e
terreno de fundo são `MeshBasic` (não são iluminados), então baixar o sol deixaria a
cidade acesa e só os prédios escuros. Exposição (1,18 → 0,40) pega todo mundo na mesma
conta. Em cima disso a **janela acende**, e isso sim é por material: o mesmo shader de
fachada que já desenha o vão soma em `totalEmissiveRadiance` — cor difusa não serviria,
porque difusa é multiplicada pela luz da cena, e à noite a luz da cena é quase zero. O
sorteio de qual janela acende é por janela (coluna, fila e semente do prédio), então a
mesma janela fica acesa a noite inteira e o vizinho acende outras.

A transição anda pelo **relógio**, não por quadro. Medido no rasterizador de software (o
pior caso, e o do QA headless): ~1,3 quadros por segundo. Com passo por quadro, escurecer
levava 30 s e parecia que o botão não tinha funcionado.

### 16.5 O relógio virtual mentia para as sondas

Isso vale para além do v12, e está na dívida da seção 17 desde a árvore incremental:
`--virtual-time-budget` **adianta os temporizadores** sem dar CPU. Um `setTimeout(8000)`
dentro da página dispara em milissegundos de relógio de parede, e o print sai antes de o
streaming montar um quarteirão — medido: 0 quarteirões, 1 chamada de desenho, câmera
ainda na origem. Pedir "mais tempo" não adianta: o que se pede a mais é tempo *virtual*.

A saída é a política padrão do próprio tempo virtual, `pauseIfNetworkFetchesPending`:
**enquanto houver requisição de rede em voo, o relógio virtual para.** Então o
`pipeline/foto.py` sobe um HTTP local que segura a resposta pelo tempo *real* pedido, e a
sonda pede uma imagem a ele. O relógio virtual congela, o rAF continua rodando em tempo
real, a cidade monta, a imagem chega, o orçamento vence e o Chrome fotografa o que se
queria ver.

Uma armadilha a mais, que fez um portão reprovar sozinho: **duas esperas do mesmo tamanho
vêm do cache** e a segunda volta na hora. A URL leva um contador.

`pipeline/foto.py` é o ritual de print (Chrome headless, swiftshader, sonda, `target`/
`sph`) num lugar só, sem asserção nenhuma: pede uma foto, recebe uma foto. Quem compara
é o `compara_print.py`.

### 16.6 A tela foi esvaziada depois

Pedido logo em seguida, e vale registrar porque muda o que o próximo a mexer vai
encontrar. Saíram da tela, em duas rodadas:

- o cartão de cima perdeu **título, extensão, carimbo e legenda de cores** (sobrou a busca);
- o painel de baixo perdeu **Altura, Pins, Setas, Muros, Noite e Minimapa** (sobraram
  Ruas, Centro, Relevo e Gráficos);
- a **barra de categorias de estabelecimento** (Restaurantes, Cafés & Bares, Padarias…);
- o **painel do interior** inteiro — ficha, catálogo de móveis, Planta/Teto,
  Refazer/Sair, Trocar prédio e a dica de teclas. `Esc` continua saindo da casa.

As funções não saíram — só o controle. Cada uma ficou no estado padrão: muro e pin
visíveis, seta escondida, minimapa ligado, dia. Noite continua acessível por `?noite=1`.

Duas decisões que valem a pena não redescobrir:

- **Controle removido vira elemento órfão, não `if` espalhado.** Cada id que saiu do HTML
  (`hs`, `hv`, `tPins`, `tArrows`, `tMuros`, `tNoite`, `tMapa`, `extent`) devolve um
  elemento criado de verdade e **nunca anexado ao documento**. Todo o código que lê
  `.value`, escuta `click` ou troca `aria-pressed` continua valendo palavra por palavra —
  e a lista é explícita (`SUMIDOS`) porque id **errado** tem que continuar estourando:
  fosse um `$` genérico que cria o que falta, um typo viraria botão fantasma silencioso.
  O `window.__int.el` expõe esse mesmo `$` para as sondas: o `testa_quadro_preguicoso`
  ainda liga e desliga os Pins, só que pelo órfão.
- **O carimbo ficou, escondido.** É ele que responde "de qual build veio este print", e o
  regex do `montar.py` procura exatamente aquela `<div id="build">`. Sumiu da tela, não da
  página: `hidden` no markup, `montar.py` continua escrevendo nele.

A preferência guardada do minimapa (`mapa3d.minimapa`) deixou de ser lida: sem botão, uma
sessão antiga que o tivesse desligado o deixaria desligado para sempre. E o minimapa
passou a se esconder **dentro da casa**, pelo mesmo motivo que o marcador de
estabelecimento já se escondia: é um mapa de rua desenhado por cima da sala.

### 16.7 O campo de visão de dentro da casa abriu

`FOV_H_CASA` foi de **78 para 95 graus horizontais** (e a vista de planta, de 62 para 72).
É a faixa em que interior de arquitetura é fotografado de verdade — 16 a 20 mm em full
frame dão 90 a 100 graus —, e abaixo dela uma sala de 3,5 m não cabe no quadro de quem
está dentro dela. O teto de **80 graus verticais** continua valendo e é ele que segura a
distorção numa tela em pé: a conta continua sendo horizontal, com o vertical saindo da
proporção da tela.

Medido com `mede_interior`: a exposição média foi de 157,2 para **151,2** (faixa
desejada 120–175) — o quadro mais largo entra mais parede e menos janela. Nenhum portão
mexeu.

### Custo medido

| | v11 | v12 |
|---|---|---|
| página comprimida (São Carlos) | 6,62 MB | 6,64 MB (**+16 KB**) |
| chamadas de desenho (mesmo enquadramento) | 345 | 344 |
| triângulos | 1.709.114 | 1.709.181 |
| atributo novo | — | `aMv`, 1 B/vértice (1,28 MB de VRAM) |

O +16 KB é a página inteira, nas cinco cidades — é código, não dado. Nenhuma chamada de
desenho nova: telha, beiral, peitoril, escorrido e pilarete moram todos em shaders que já
estavam sendo compilados.

### Verificação

`testa_v12_ux.py` (novo): 12 portões × 5 cidades, todos passando — índice de busca com
via/lugar/edificação e consulta que acerta o primeiro item, link que posiciona o alvo a
menos de 5 m do pedido e reescreve a URL, noite que chega a 0,40 de exposição em até 3 s
de relógio e volta a 1,18, minimapa com 4,8% a 12,4% de pixel claro (0% seria canvas em
branco; acima de 45% seria a mancha cinza da versão por bitmap).

`padrao/rodar_qa.py` (São Carlos): 0 portões reprovados — como esperado, já que nada
neste ciclo tocou em dado, só em como ele é desenhado.

## 17. A vitrine para na ficha, e o pino só acende quando se pergunta (2026-08-31)

O pedido foi preciso: *"quando se clica em 'imóveis para inspeção 3D' o site te joga
diretamente para o local e entra na visualização 3D. O que eu quero é que vá para a
localização e abra uma janela de informações do imóvel"*, mais um **"o que tem por
perto?"** que expande o mapa com o imóvel no centro e mostra os estabelecimentos com uma
coluna de categorias à esquerda — e os pinos **desativados por padrão**.

### 17.1 O que estava errado no clique

`abreUnidade` voava até o prédio, acendia o farol e, 980 ms depois, chamava
`enterInterior`. O comentário no código dizia por que a espera existia (*"entrar no meio
do voo cortaria a única pista visual de onde o imóvel fica"*), e estava certo sobre a
espera e errado sobre o destino: **entrar era o destino errado**. Quem clica num anúncio
quer saber o que é aquilo — metragem, preço, quantos cômodos —, e a página respondia
pondo a pessoa em primeira pessoa dentro de uma sala, com a cidade sumindo atrás do plano
de corte, sem ter mostrado um número sequer.

Agora o voo é o mesmo, o farol é o mesmo, e no fim vem `abreFichaDoImovel` em vez de
`enterInterior`. A visita 3D virou o botão **Entrar na visita 3D** da ficha.

**`abreFicha` já existia.** É a ficha da *edificação* clicada no mapa (seção 11 do
`app.js`), e as duas declarações de função no mesmo escopo não colidem pela metade: a de
baixo vence, e a chamada da vitrine caía na outra — com `u` no lugar de `rec`, o que
estourava lá dentro do `shoelace`. Sintoma: clicar no anúncio não fazia *nada*, sem erro
visível, porque a exceção morria dentro do ouvinte de clique. O nome novo diz de quem é a
ficha.

### 17.2 A ficha: o anúncio e a planta lado a lado

Os dois vêm do mesmo `plantas_fornecidas/<id>/unidade.json`, e a ficha é o único lugar da
página onde aparecem juntos:

| de onde | o que |
|---|---|
| `ficha` (o anúncio) | preço, área útil, área total, quartos, suítes, banheiros, vagas |
| `planta` | pé-direito, e **cada cômodo com a sua área** |

A área do cômodo sai do cadastro quando ele a traz e do **polígono** quando não —
`areaDoComodo` faz a fórmula do laço sobre o mesmo contorno que vira parede na visita 3D.
Assim a metragem da ficha não pode contradizer o que se anda lá dentro.

Cômodo repetido é **numerado** (*Banho 1*, *Banho 2*): duas linhas idênticas na lista
parecem erro de transcrição, e a planta está dizendo que são dois.

**A soma não bate com a área útil, e o rótulo diz isso.** No Mirra, os 11 cômodos somam
65,2 m² contra os 114,32 m² anunciados. Não é divergência: é parede, garagem e o que mais
o anunciante somou. O cabeçalho da lista diz *"65,2 m² de piso"* — os dois números ficam
lado a lado em vez de um esconder o outro.

### 17.3 "O que tem por perto?": o modo tem dono

`abrePerto({x, z, nome, volta})` centraliza a câmera no imóvel, abre o raio para 900 m,
acende os pinos, mostra a coluna e **guarda como voltar**. `fechaPerto` desfaz tudo,
inclusive apagar os pinos de novo.

Três decisões que valem comentário:

- **A contagem é por RAIO (1 km), não pela cidade.** "12 farmácias" só responde "o que
  tem por perto" se as 12 estiverem perto. `contaPerto` conta o que cai no raio, e é esse
  número que a coluna mostra.
- **A ordem é por quantidade, não fixa.** A coluna de um apartamento no centro não é a de
  um no anel externo, e ordem fixa esconderia exatamente isso. Reordenar é
  `nList.appendChild(b)` num botão que **já está** no pai — mudança de lugar, não cópia:
  a lista se reordena sem recriar botão nem perder o ligado/desligado. Categoria sem nada
  no raio continua listada, apagada, com zero — os pinos dela existem fora do raio e
  precisam continuar desligáveis.
- **O farol fica aceso o tempo todo.** Num mapa cheio de pino, ele é a única coisa que
  ainda diz qual dos pontos é o imóvel — por isso `openPoiSheet` deixou de apagá-lo
  incondicionalmente e só o apaga fora do modo.
- **A ficha encolhe, não fecha** (`minimizaFicha`). A primeira versão do modo fechava o
  cartão, e isso apagava a resposta de "perto de *quê*?" no instante em que a pergunta
  passa a importar. Agora o mesmo cartão ganha `.min` e vira uma tira de 56 px no rodapé,
  com tag e nome; a `.dobra` (o mesmo idioma do painel do interior) alterna, o clique no
  espaço vazio da tira abre, e o × fecha. `body.perto #psheet{bottom:84px}` empilha a
  ficha do estabelecimento por cima em vez de sobrepor.

  Três detalhes que a implementação exigiu:

  - **A transição só anda com `max-height` em número dos DOIS lados.** O `#hsheet` não
    tinha nenhum; ganhou `min(72vh,600px)` — alto o bastante pra não apertar nada, e
    existindo só pra dar de onde a interpolação partir. De `none` não há o que animar e a
    ficha sumiria de um quadro pro outro.
  - **O `.addr` sai da tira.** Com ele, o corte de 56 px caía no meio da linha do
    endereço e a tira lia como cartão mal cortado, não como cartão encolhido.
  - **O clique que minimiza borbulhava e reabria no mesmo gesto.** `#uPerto` mora dentro
    do `#usheet`: o ouvinte do botão põe `.min`, o clique sobe até o cartão, que vê `.min`
    recém-posta, conclui "clicaram na tira" e desfaz. O atalho da tira passou a ignorar
    `button, a, .x, .dobra` — ela só reage a clique no espaço vazio.

O anúncio **sem** planta (os 7 de São Carlos, que vêm de `__imoveis`) não tem visita 3D
mas tem endereço, e ganhou o mesmo botão no `#hsheet`.

### 17.4 O pino nasce apagado

`poiHidden` passou a nascer `true`, `gPoi.visible` a nascer `false`, e o botão órfão
`tPins` a nascer `aria-pressed=false` (a lista `SUMIDOS` ganhou a exceção junto de
`tArrows` e `tNoite`). Abrir a cidade acendendo 1.197 marcadores punha na frente de quem
chega justamente o que ele ainda não veio ver.

Três coisas acendem, e **nenhuma delas é o boot**: o "por perto", a **busca** (procurar
uma farmácia pelo nome tem que mostrar a farmácia — sem isto a ficha do POI abriria sobre
um marcador invisível, então `openPoiSheet` chama `setPins(true)`) e o próprio botão
Pins.

A barra de categorias do topo, que saiu da tela no v12, **não voltou**: o filtro é a
coluna, e ela só existe com um imóvel escolhido. O `poibar` segue órfão. `catOn` continua
sendo a fonte da verdade, e `aplicaCat` é o único lugar que escreve nele — a camada 3D
(duas malhas por categoria), os marcadores HTML, a ficha aberta e o `aria-pressed` do
botão saem todos de lá.

### 17.5 Duas armadilhas de CSS que custaram um print cada

- **`el.hidden = true` num `<button>` não esconde nada** nesta folha. `button{…;
  display:block}` é regra de autor e vence o `[hidden]{display:none}` do navegador
  (origem antes de especificidade). Os botões que aparecem e somem precisaram de
  `[hidden]{display:none}` explícito.
- **`width:auto` num `<button>` é encolher, não preencher**, mesmo com `display:block`:
  controle de formulário usa largura intrínseca. O *‹ Ficha do imóvel* saía com metade da
  largura da coluna ao lado dos `.ncat`, que já tinham `width:100%`.

E uma de layout: a grade de colunas iguais partia *R$ 960.374,02* por cima da *Área útil*
ao lado. A célula do preço é a mais larga da ficha e não cabe numa fração igual — virou
linha que quebra, com cada célula do tamanho do seu próprio número.

### 17.6 O apartamento de exibição ficou vazio

Pedido separado, no mesmo ciclo: tirar a mobília do `mirra-114`. As 29 peças foram
**arquivadas, não apagadas** — viraram `_moveis_arquivados` no próprio `unidade.json`,
com `"moveis": []` no lugar. O `montar.py:bloco_unidades` já remove todo campo com `_`
na frente antes de embutir a unidade, então o arquivo guarda a transcrição e a página
não a carrega. Devolver é renomear a chave.

A edição foi **textual**, não `json.dumps`: aquele arquivo é escrito à mão, uma peça
por linha com colunas alinhadas e linha em branco separando cômodo. Reserializar
reformataria 180 linhas e o diff esconderia a única mudança que interessa.

Nada no renderizador precisou mudar: `moveisDaUnidade` lê `P.moveis || []` e não
sintetiza mobília — lista vazia é cômodo vazio.

**Dois efeitos colaterais nos portões**, os dois reais:

- `mede_interior.py` estava medindo a **cidade** achando que media o interior. A sonda
  dele clicava no item da vitrine e esperava estar dentro da casa — o comportamento do
  v12. Depois da 17.1 o clique para na ficha, e o print saiu da rua com a média dentro
  da faixa: **aprovado, medindo a coisa errada**. Agora ela clica em `#uEnter` depois do
  item. Foi a remoção da mobília que revelou isso — o print de controle mostrou um
  quarteirão onde deveria haver uma sala.
- com o interior de volta na medida e **sem móvel**, `faixa` (p95−p05) deu 88,5 contra o
  piso de 90. O móvel era a maior parte do que havia de escuro no quadro; a cena de
  referência virou parede, piso, rodapé e sombra de vão. O piso desceu pra **80**, com a
  razão escrita no cabeçalho do arquivo. O critério continua o mesmo (pegar cena lavada
  ou chapada de verdade); o que mudou foi a cena.

### 17.7 A coluna abre apagada

Segunda passada, a pedido: **todas as categorias começam desligadas**. Acender as 21 de
uma vez devolvia a sopa de ícone que o pino apagado no boot (17.4) existe pra evitar, só
que agora em cima do imóvel. A coluna vira a **pergunta** ("me mostre farmácia"), não a
faxina; *Todos* continua lá pra quem quiser tudo.

Uma consequência que não é óbvia e quase passou: **`setPins(true)` sozinho deixou de
bastar.** São dois interruptores — o grupo (`gPoi`) e a categoria (`catOn`) — e
`updatePois` esconde marcador de categoria desligada. Depois de uma passada pelo "por
perto" todas estão desligadas, então buscar uma farmácia pelo nome levava a câmera até
um pino invisível. `openPoiSheet` passou a acender também a categoria do POI que abre.

### 17.8 Dentro da casa, o minimapa vira a planta

O v12 **escondia** o minimapa no interior, e com razão: um mapa de rua desenhado por
cima de uma sala não diz nada. Ele não volta a esconder — **troca de assunto**. No mesmo
quadrado de 170 px entra a planta do próprio imóvel, com o cômodo em que se está aceso,
o ponto de onde se olha e o cone de visão. Duas vistas ao mesmo tempo: a primeira pessoa
na tela, o de-cima no canto.

- **O desenho é no referencial da PLANTA, não no do mundo.** `pl.ob` guarda o eixo maior
  do prédio; desfazer essa rotação (`locDaPlanta`, que é a inversa de `pl.W` — matriz de
  rotação pura, logo a transposta) põe o apartamento **reto** no quadrado. Planta torta
  dentro de 170 px desperdiça metade da área e deixa de se ler como planta. Quem gira é
  só o cone.
- **Só parede inteira entra.** `pl.paredes` traz peitoril e verga como pedaços da mesma
  parede, na mesma posição em planta: desenhar todos taparia justamente o vão — e o vão
  é o que a planta precisa mostrar. Filtra-se por `y0 ≤ 0,06 && y1 ≥ pd−0,06`, e a
  **porta fica como buraco**, que é como planta de arquitetura se lê. A **janela** é o
  vão que continua sendo parede: entra como linha fina azul, de `pl.esquadrias`.
- **"Você está aqui" é o cômodo inteiro**, não o ponto. Um disco de 3 px num quadrado de
  170 não se lê de relance; o cômodo pintado de verde, sim. O nome e a área dele vão na
  legenda de baixo (e a faixa dessa legenda sai da área útil do desenho — sem isso um
  apartamento mais alto que largo encosta na linha do texto).
- **A guarda de "não redesenhar à toa" continua**, com a fonte trocada: lá fora é a
  órbita (`target`/`sph`), aqui dentro é o passo de quem anda (`FP.pos`/`FP.yaw`).
  Entrar e sair invalida os dois lados — quem entra pode não ter andado um metro, e quem
  sai encontraria o quadrado com a planta ainda pintada.
- **O clique no quadrado não teleporta mais** enquanto se está dentro: a câmera ali anda
  com colisão, e pular pra dentro de uma parede seria o fim.

### 17.9 O custo do minimapa, medido antes de otimizar

Quatro suspeitas foram levantadas na leitura do código: os dois desenhos rodam a cada
quadro durante movimento; a planta redesenha paredes estáticas; o POI é um `arc()`+`fill()`
por ponto; e a via é remontada a cada quadro. **As quatro são verdade no código.** Duas
delas não custavam nada.

Antes de mexer, `pipeline/mede_minimapa.py`. Ele existe porque o cronômetro óbvio não
serve: **com `--virtual-time-budget` o Chrome virtualiza `performance.now()`, e o relógio
virtual fica PARADO enquanto o JS roda.** A primeira versão do medidor deu 0,00 ms para
tudo, inclusive para 120 desenhos de uma cidade de 22 mil vias. Quem carimba o tempo aqui
é um servidor HTTP local: a sonda pede uma imagem antes e outra depois do laço, e o
relógio de parede do SERVIDOR é a medida (a ida e volta em 127.0.0.1 é medida à parte e
descontada).

E ainda assim a primeira medida mentiu de outro jeito: a mesma função deu **5,02 ms numa
execução e 12,27 ms na seguinte**. Uma medida só pega o JIT frio ou uma coleta de lixo no
meio. Com **três rodadas e o mínimo** — que é o estimador honesto de "quanto isto custa
quando nada atrapalha" — o número virou 0,02 ms. As 5 e as 12 eram ruído, não custo.

A linha de base, em Ribeirão (22 mil vias, 1.197 POIs), no rasterizador de software do
headless — que é mais lento que a máquina de quem usa a página:

| | antes | depois |
|---|---|---|
| minimapa de rua | 0,57 ms | **0,02 ms** |
| idem, com os POIs acesos | 0,78 ms | **0,03 ms** |
| planta do interior | 0,02 ms | 0,02 ms |

**O que foi feito, e por quê:**

- **A via virou `Path2D` em coordenada de MUNDO.** A geometria não muda; o que muda a
  cada quadro é a *transformação*. A chave do cache é a janela de células de 600 m (que
  é o que decide quais vias entram) mais a escala. Arrastar o mapa dentro da mesma janela
  passou a custar dois `stroke`, em vez de remontar algumas centenas de vias ponto a
  ponto. **Esta era a suspeita certa** — era o item dominante.
- **O ponto de POI virou um `Path2D` por categoria**, montado no mesmo cache. Eram até
  2.393 `arc()`+`fill()` por desenho (Sorocaba), cada um trocando `fillStyle` pela mesma
  cor do anterior. Agora é um `fill()` por categoria acesa sobre caminho pronto, e ligar
  ou desligar categoria é escolher *quais* preencher, não remontar. O recorte do cache é
  a janela de células, e não `target ± meio`: dentro de uma mesma chave o alvo continua
  andando, e um recorte que anda junto deixaria de fora o ponto que acabou de entrar no
  quadro.
- **O `moveTo` antes de cada `arc` não é enfeite.** Sem ele o arco novo se liga ao
  anterior por uma reta e o minimapa vira uma teia.

**O que não foi feito, e por quê:**

- **Cachear as paredes da planta.** A leitura do código está certa — elas são estáticas e
  são redesenhadas a cada quadro — mas o desenho inteiro da planta custa **0,02 ms**: 11
  cômodos, 57 paredes e 18 esquadrias são ~200 pontos. Um segundo canvas com regra de
  invalidação pagaria complexidade para otimizar o item mais barato da lista.
- **Limitar a taxa de redesenho.** A guarda de "nada mudou" já zera o custo parado, e
  0,03 ms num orçamento de 16,7 ms é 0,2%. Um limitador por tempo ainda teria que
  conviver com o relógio virtual do headless, que é exatamente a armadilha de cima.

O aceite foi **pixel a pixel**: `compara_print.py` sobre o recorte do minimapa, antes e
depois, com e sem POI — 100% dos 29.750 pixels idênticos nas duas comparações.
Otimização que muda a figura é regressão, não otimização.

Os tetos do medidor (0,30 ms / 0,45 ms / 0,30 ms) não são meta de desempenho: são
**alarme de cache desligado**. Quem reprovar ali provavelmente desfez o `Path2D`, e não
deixou a página 3% mais lenta. Foi assim que São José do Rio Preto reprovou no meio do
caminho (0,54 ms), com o cache da via já pronto e o do POI ainda não.

### 17.10 O portão

`pipeline/testa_ficha_e_perto.py`. Nada disto aparece numa foto, e todo modo de falhar é
silencioso: a ficha abre vazia, o botão abre a coluna mas não acende pino nenhum, apagar
uma categoria não apaga nada, fechar deixa os pinos acesos para sempre.

    BOOT     nenhum marcador visivel, `__int.pins()` falso, nem ficha nem coluna na tela
    FICHA    o clique abre a ficha e NAO entra no interior; com planta, lista comodo com area
    PERTO    a coluna abre, os pinos acendem, ha marcador na tela, e a contagem e < a cidade
    TIRA     a ficha encolhe em vez de fechar; clicar nela devolve inteira sem sair do modo
    FILTRO   a coluna abre com TUDO apagado; acender poe marcador, apagar limpa
    PLANTA   dentro da casa o minimapa desenha a planta -- a sonda conta tinta, porque o
             modo de um canvas falhar e ficar em branco
    FECHA    sair apaga os pinos DE NOVO (zero marcador visivel)
    ENTRA    o botao da ficha e que leva pra dentro, e leva

Resultado nas cinco cidades: **tudo passou** (Ribeirão 12 categorias / 304 POIs no raio de
1 km; São Carlos 21 / 31; as outras três não têm vitrine e respondem só pelos portões do
boot).

Dois testes existentes mediam o comportamento antigo e foram atualizados, não afrouxados:

- `testa_quadro_preguicoso.py` esperava POI visível no enquadramento inicial. Agora
  **confere que está apagado** (portão novo, "pino apagado no boot") e só então acende
  pela mesma porta que o botão usa. Os portões de guarda preguiçosa seguem iguais.
- `testa_duplo_clique.py` clicava no item e esperava estar dentro da casa. Agora clica no
  item, **confere que a ficha abriu** e clica em *Entrar na visita 3D* — que é o caminho
  que o usuário faz.

`testa_v12_ux.py` (busca, link, noite, minimapa) segue passando sem alteração, e
`mede_interior.py` volta a medir o interior (ver 17.6).

O padrão dos três: **toda sonda que entrava na casa clicando na vitrine precisou do
segundo clique.** Quem escrever a próxima começa por aí — e repare que duas das três
não quebraram, só passaram a medir outra coisa em silêncio.

## 18. A casa ganhou janela, e o vidro virou vidro (2026-09-01, só Ribeirão Preto)

Dois pedidos: **fileira de janela na fachada** ("dá escala humana imediatamente") e
**melhor tratamento de material e iluminação**. E, pela terceira vez, "só em Ribeirão
por enquanto".

### 18.0 "Só em Ribeirão" virou chave, e não mais uma promessa

Nas Fases 2, 3 e 4 esse escopo era **remontagem**: o renderizador é um só, e o que
separava as cidades era qual página tinha sido montada por último. As outras quatro
pegavam a mudança na montagem seguinte, ainda que disparada por outro motivo. Ou seja:
não era escopo, era atraso.

Agora `padrao/cidades/<slug>.json` traz um bloco `aparencia`, o `montar.py` o copia pro
`__cidade` e o `app.js` lê `APAR` na inicialização. Duas chaves nesta rodada:
`janela_metrica` e `material_luz`. Quem não declara recebe **GLSL idêntico ao anterior**
— as duas tabelas da malha de janela ficam escritas lado a lado (`JAN_TABELA`,
`JAN_MALHA`) e a chave escolhe, e os termos novos de material são multiplicados por um
`AP` que vale `0.0` e o compilador dobra fora.

Medido: São Carlos remontada com o `app.js` novo, mesmo enquadramento, contra a página
anterior — **99,30% dos pixels idênticos, |delta| máximo 1**, contra um controle
(mesmo arquivo, duas capturas) de 100% idêntico. O 1 de resto é arredondamento do
programa recompilado, não mudança de desenho.

### 18.1 A casa não tinha janela — e a culpa era da UNIDADE, não da regra

O shader já desenhava malha de janela desde o v7, com peitoril, verga e sorteio de
coluna cega. Numa foto de rua, no entanto, a rua de casa térrea saía **cega**: caixa
branca com telhado. O motivo estava numa linha:

    vec4 w = vec4(0.30, 0.63, 0.42, 0.80);   // z,w = peitoril e verga em FRAÇÃO do pé-direito

Fração. Com `pv = 3,05 m`, `0,42` põe o peitoril a **2,18 m do chão** — e o `body` corta
a fachada 35 cm abaixo do beiral, que numa casa de 3 m é 2,65 m. Sobrava uma lasca de
47 cm colada no telhado, que o olho lê como sombra de beiral, não como vão. É a mesma
lição do embasamento da Fase 2, na direção contrária: **o que tem tamanho físico se mede
em metro**. Peitoril é 1,05 m acima do piso na casa e na torre.

O conserto é `fy = y - peD - row*pv` (a altura DENTRO do pavimento, em metros) e a
tabela reescrita em metros. Duas consequências que só apareceram depois:

- **`peD` deixou de ser "pé-direito do térreo" e virou "piso do primeiro
  pavimento-tipo"**. Na casa e no sobrado ele foi pra `0.0`: o pavimento-tipo de uma
  casa é o térreo. Em prédio/comércio/torre ele continua sendo a altura do térreo alto,
  que é o que mantém vitrine e marquise abaixo da grade.
- **Pavimento que não cabe não ganha janela** (`cabe = step(peD + row*pv + w.w + 0.30,
  hU)`). Sem isso, qualquer altura quebrada reproduz a lasca no último pavimento — meia
  janela cortada no meio da verga, que é pior que janela nenhuma.

Uma janela sozinha não é escala; **a fileira é**. Com o vão de 3,9 m e 34% de colunas
cegas, uma casa de 12 m de frente sorteava UMA janela — mancha, não ritmo. Foi pra 3,6 m
de vão e 16% de cegas (~2,5 vãos abertos em 12 m). O ANEXO (garagem/edícula) era 100%
cego e é **21% das edificações medidas**: ganhou um vão pequeno de vez em quando.

A janela também ganhou **alcance próprio** (`fadeJ`, 430→1050 m contra os 190→560 m do
resto do detalhe). Peitoril, escorrido e nervura viram ruído de amostragem a essa
distância; a fileira de janela, com 3-4 m de passo, ainda tem ~10 px a 700 m — e é a
única coisa da fachada que diz de quantos andares é o prédio.

### 18.2 A paleta existia e não chegava na tela

Medido na cena de Ribeirão, varrendo `aStyle` e `color` das malhas montadas:
**70% das 5.021 casas e sobrados têm croma >= 0,24 no atributo de cor** — o salmão, a
terracota, o ocre e o cinza-azulado que a Fase 2 abriu. Na tela, uma família de brancos.

Não é a paleta: é o **caminho da cor**. A saída sRGB levanta o valor (0,81 linear vira
0,92) e o ACES desatura justamente o meio-tom alto. Os dois juntos comem quase todo o
croma das cores claras — que são a maioria de uma rua brasileira. O conserto é devolver
croma **antes** do tone mapping, que é onde ele se perde: um `mix` de peso NEGATIVO
afasta a cor do próprio cinza (+34%), e só na fachada — asfalto, grama e telha têm
calibração própria e não passam por ali.

### 18.3 O vidro dividia o acabamento do reboco

`MeshPhongMaterial({ shininess: 0, specular: 0x000000 })`: numa fachada inteira havia
**uma** superfície. Janela e parede diferiam só em quanto escureciam a cor difusa — ou
seja, a janela era *pintura*. Mancha escura chapada num plano claro é literalmente o
desenho de um adesivo colado numa caixa.

As duas coisas pelas quais o olho reconhece vidro:

- **brilho especular** — o sol na vidraça. Sai por `specularStrength`, que já existia no
  material (em 1,0, multiplicando preto). `#include <specularmap_fragment>` vem DEPOIS
  do `color_fragment` no `meshphong_frag`, então dá pra escrever uma global `gEspec` lá
  em cima e lê-la aqui. Vidro 0,90; laje de concreto 0,15; telha e reboco 0.
- **reflexo do céu crescendo com o ângulo rasante** (Fresnel) — é por isso que a mesma
  janela é escura de frente e clara de esguelha, e por isso que uma torre vista de lado
  acende inteira. Uma potência do produto escalar com a normal já interpolada.

Zero chamada de desenho a mais nas duas: 278 antes, 278 depois, no mesmo enquadramento.

### 18.4 A hemisférica era mais forte que o sol

0,72 de céu contra 0,95 de sol — e a hemisférica bate em TODA face, enquanto o sol só
bate em algumas. A parede virada pro sol e a virada pro lado oposto saíam quase com o
mesmo valor. **Sem degrau entre faces não há volume**, e nenhuma quantidade de detalhe
de fachada conserta isso, porque o problema está uma camada antes do desenho. Foi pra
sol 1,16 / hemisférica 0,50.

E a **cor** do chão da hemisférica: `0x1A222C` é quase preto e frio. A parede na sombra
recebia azul pálido em cima e azul escuro embaixo — duas fontes cinza-azuladas dão
cinza sem croma, e o olho lê "sem cor", não "na sombra". É exatamente o diagnóstico que
o interior já tinha feito (ver `acendeInterior` e a seção 14), só que lá o conserto
ficou trancado dentro de casa. Aqui embaixo o que rebate na parede é asfalto, terra e
calçada: luz quente. Foi pra `0x3B372E`.

Com o sol mais forte a exposição passava a estourar — e branco no limite do estouro não
aceita croma nenhum, o que anularia o 18.2. Caiu de 1,18 pra 1,075. O ganho é na COR,
não no brilho.

### A armadilha que custou duas iterações (de novo)

**Crase dentro de comentário GLSL encerra o template literal** do `onBeforeCompile` —
a mesma da Fase 2, três vezes nesta rodada, porque a tentação de escrever
`` `specularStrength` `` num comentário é grande. Dentro das crases, nome de código vai
entre aspas simples. O `node --check renderizador/app.js` pega isso em um segundo e
passou a ser o primeiro comando depois de qualquer patch no shader.

E, ainda: **`A && B` numa linha e `C` na linha seguinte não é uma cadeia**. O `node
--check` reprovou, a linha que ligava as chaves da cidade não rodou, e o `montar.py` da
linha de baixo rodou assim mesmo — a foto "depois" saiu idêntica à "antes" e o
diagnóstico foi procurado no shader por uma iteração inteira. Confira a chave no HTML
montado (`grep janela_metrica`), não na intenção.

### Verificação

    python pipeline/foto.py --cidade ribeirao-preto --lat -21.1930 --lon -47.8180 \
           --raio 95 --phi 1.44 --theta 0.9 --sem-hud --saida depois.png
    python pipeline/compara_print.py sc_antes.png sc_depois.png   # São Carlos: max 1
    python padrao/rodar_qa.py ribeirao-preto                      # 18 portões, 0 reprova

Os 18 portões de Ribeirão passam (369 s), incluindo *exposição do interior* — o
interior tem luz própria (`acendeInterior` salva e substitui sol, hemisférica e
exposição), então a luz da cidade não o alcança.

### O que NÃO foi feito, e por quê

- **A mancha pontilhada em algumas fachadas é anterior a esta rodada** e continua: são
  duas paredes coincidentes disputando profundidade (o Overture entrega casa + garagem +
  edícula como polígonos sobrepostos, ver seção 1.1), e o que se vê é a janela de uma
  aparecendo dentro da outra. Provado pelo A/B: a mancha está igual na foto de controle,
  com as chaves desligadas. É defeito de **dado**, não de material — o conserto é na
  assentada do lote, não no shader.
- **`SOL_OFF` não mudou.** Baixar o sol daria sombra mais longa e mais leitura de
  volume, mas ele também dimensiona a câmera de sombra (`near 200 / far 3200`) e a
  direção da sombra de contato da Fase 3. É uma mudança de outra natureza.

---

## 19. A ficha que não existia, e o sítio que virava laje (2026-09-01)

Dois defeitos apontados na mesma mensagem, e os dois valem para **todas as cidades** —
não são aparência, são o mapa afirmando coisas que não sabe.

### 19.1 A ficha genérica de edificação foi removida

Clicar em qualquer volume abria um cartão com *Pegada*, *Pavimentos* e *Altura*, e um
botão **"Entrar na casa"**. Nenhum dos três números é cadastro: a pegada é o contorno
que o pipeline assentou no lote, o pavimento é `(h-1,1)/3,15` arredondado, e a altura
vem do `building:levels` do OSM quando existe e de um chute por tipo quando não (ver
`estHeight`). Apresentar estimativa em forma de ficha é dizer que se sabe.

A regra agora é uma só: **o mapa só abre ficha de imóvel cadastrado.** Clicar num volume
sem cadastro não faz nada — que é a resposta honesta. Saíram `openSheet`, o `#sheet`, o
CSS dele, e os pinos de edificação (`addPins`/`mPin`), que nasciam `display:none` e nada
na página acendia: eram DOM morto cuja única razão de existir era abrir essa ficha. Com
eles foram `parcels`, `ICON` e `LABEL`, órfãos pela mesma razão — a busca indexa
edificação com nome direto de `B` (`indexaBusca`), nunca dependeu de `parcels`.

**Por que o botão aparecia em cima de um galpão sem cadastro.** O JS o escondia
(`ent.hidden = !uni`) e o CSS o trazia de volta: a regra global
`button,select,label.file{…display:block}` é declaração de autor e **ganha do
`display:none` que a folha do navegador dá ao atributo `hidden`**. Ou seja, todo
`<button hidden>` da página estava visível. Havia remendo pontual para esse caso
(`.card .acoes button[hidden]{display:none}`), o que é a prova de que a classe já tinha
mordido antes. O remendo saiu e entrou a regra que fecha a classe:

    [hidden]{display:none!important}

**E `unidadeDoPredio` não era a inversa de `predioDaUnidade`.** A primeira (prédio →
unidade) olhava só `predio_id`; a segunda (unidade → prédio) resolve por três fontes —
prédio fixado à mão no `localStorage`, `predio_id`, e a `ancora` lat/lon do anúncio. O
resultado era um mapa em que a vitrine acha o prédio do imóvel e o prédio não acha o
imóvel de volta — e a única unidade real do acervo (`mirra-114`) tem justamente
`predio_id: null`. Agora a primeira pergunta pela segunda. Percorrer `UNIDADES` é barato:
são uma dezena de itens, e só no clique.

Provado com sonda, e a sonda errou primeiro: **o clique da cidade é `pointerup`, não
`click`** (ver o ouvinte logo abaixo de `endDrag`: "clique é apertar e soltar sem
arrastar"). Com `MouseEvent("click")` a página não chamava nada e as duas provas — a
positiva e a negativa — davam o mesmo "não abriu". Com `PointerEvent("pointerup")`:

    48 cliques em volumes do centro de Ribeirão e de São Carlos -> 0 fichas abertas
    clique no volume do mirra-114                                -> ficha do imóvel abre

### 19.2 O sítio que virava laje

Sintoma: em Ribeirão, uma laje branca de **446 × 444 m a 7,7 m de altura**, atravessada
por cima de quarteirões inteiros, com torres saindo por dentro dela. Não é o telhado do
shopping: é **um** polígono de **107.729 m²** — 47× a p99,9 da cidade (2.272 m²) — que
desenha o **terreno** do RibeirãoShopping. Olhado em planta ele acompanha a divisa da
propriedade (o chanfro da esquina, o recorte da avenida, a rotatória embaixo), e por
dentro dele correm as vias internas e as fileiras de vaga. As torres que apareciam
furando a laje são o Office Tower (79,8 m) e o Centro Profissional (64,1 m). **Não há
nenhum `building` do OSM ali dentro**: esse polígono é tudo que existe naquele
quarteirão.

**Cortar por área está errado, e a medição mostra por quê.** Nas quatro cidades com
dado: Riopreto Shopping tem 44.227 m² de verdade, o Iguatemi 32.145, o Shopping Cidade
Sorocaba 26.384, o Hospital das Clínicas 31.794. Qualquer teto que mate o de Ribeirão
mata shopping e hospital de verdade.

O que separa edificação de sítio é **rua**: prédio não é atravessado por via pública.
Contando o eixo dirigível que cai DENTRO do polígono:

| polígono | área | eixos | eixo dentro |
|---|---|---|---|
| Equus (Ribeirão) | 107.729 m² | 22 | **1.495 m** |
| Assaí Atacadista (Ribeirão) | 50.693 m² | 3 | **620 m** |
| Terminal Urbano (S.J. Rio Preto) | 12.234 m² | 2 | 197 m |
| Museu do Futebol (Araraquara) | 32.538 m² | 1 | 67 m |
| todo o resto das 4 cidades | — | 0 | 0 m |

O corte em **300 m** separa os dois grupos com folga de 3× para os dois lados, sem
constante de cidade. O terminal rodoviário continua de pé — ele tem via por dentro de
verdade, e 197 m dela.

#### Achado o sítio, ele é RECORTADO — não apagado

A primeira versão simplesmente não desenhava o polígono. Funcionava contra a laje e
estava errada pelo outro lado: **o polígono carrega a forma do lugar**, e apagá-lo deixa
buraco onde há shopping. O que ele tem a mais é a **circulação interna**. Então se
subtrai a circulação, com folga de vaga, e ficam as massas.

A folga de 14 m não é chute — é onde a mancha construída se separa do pátio. Medido no
terreno do RibeirãoShopping, subtraindo todo eixo que o toca:

    folga  0 m -> 17 peças, maior 29.380 m²    (ainda é o pátio inteiro)
    folga 14 m ->  9 peças, maior 18.333 m²    <- o bloco do shopping se destaca
    folga 24 m ->  5 peças, maior 11.672 m²    (já comeu o prédio)

E dois filtros por peça, porque nem tudo que sobra é prédio:

- **área ≥ 2.500 m²** — resto de calçada e ilha de pátio não viram volume;
- **sobrevive à erosão de 12 m** — fita de vaga tem ~16 m de largura por 100 m de
  comprimento: ela SOME quando erodida, e o bloco do shopping não. Área sozinha não
  separa os dois; largura separa.

Resultado: **107.729 m² → 7 massas somando 54.504 m²**, e o Assaí 50.693 → 1 massa de
32.576. Nenhuma delas cobre rua, e o chanfro e os recortes da divisa continuam lá.
O nome fica com a MAIOR massa — repetir "RibeirãoShopping" em quatro volumes poria
quatro entradas iguais na busca, apontando pra quatro lugares.

**Isto mora no pipeline** (hoje em `padrao/sitios.py`, chamado pelo `build_v7_city.py`
logo depois do `kept`), e não
no renderizador. A primeira versão ficou no renderizador porque parecia mais barato;
com a regra virando *recorte* isso deixou de ser possível — não há booleano de polígono
em JS — e, mais importante, seria a mesma dívida que a tabela de vias já carrega: duas
implementações da mesma regra, uma delas sabendo só apagar. A etapa 7 custa **2 min por
cidade** e é determinística: Ribeirão saiu de 146.269 para 146.272 volumes, que são
exatamente as 5 massas no lugar dos 2 sítios.

Efeito colateral que ajuda: as massas continuam entrando em `kept_poly`, então os lotes
sob elas seguem excluídos e não nasce casa sintética dentro do shopping.

**03/09/2026 — a regra ganhou um segundo chamador, e por isso saiu de dentro da etapa 7.**
Ela foi extraída para `padrao/sitios.py` (`separa()`), e o `build_v7_city.py` passou a
importá-la. O refactor foi verificado do único jeito que vale: Ribeirão remontado pela
etapa 7 sai **byte a byte idêntico** (sha1 `e42aa629…`, 8.403.095 bytes).

O segundo chamador é `pipeline/recorta_sitios.py`, que aplica o mesmo recorte a um
`city.json` **já fechado** — o caso da variante `ribeirao-preto-proxy`, cujo `city_saida`
aponta pro footprint cru do Overture e portanto nunca passou pela etapa 7. Sem isso o
terreno do RibeirãoShopping aparecia lá como uma laje de 446 m sobre quarteirões
inteiros. O recorte **não é aparência**: é o mapa deixando de afirmar o que não sabe, e
por isso vale também para uma variante de experimento.

    python pipeline/recorta_sitios.py ribeirao-preto-proxy

O trabalho ali não é o recorte — é o **índice**. Um sítio vira N massas, e três
estruturas indexam `b[]` e precisam continuar de acordo: `bl[]` (fatia **contígua** por
quarteirão), `bm[]` (nome/endereço por edificação) e `fa[]` (azimute da frente). A ordem
é preservada de propósito, porque é ela que faz a fatia contígua do `bl` continuar
valendo; o remapeamento sai de uma soma de prefixo sobre a contagem por edificação
antiga. Resultado no footprint cru: os **mesmos 2 sítios e as mesmas 5 massas** da etapa
7 (Equus 107.729 → 4 massas de 34.754 m², Assaí 50.693 → 1 de 29.456), 284.920 → 284.923
volumes.

**03/09/2026 — a folga caiu de 14 m para 8 m.** A pedido, e com medida: "quando eu peço
pra remover algo gigante, remove o EXCESSO". Com 14 m o shopping perdia **68%** da massa
e sobrava fita solta sobre pátio vazio. A curva medida no terreno do RibeirãoShopping,
contando só as massas que sobrevivem aos dois filtros:

| folga | massas | maior | soma | % do sítio |
|---|---|---|---|---|
| 0 m | 8 | 29.373 m² | 80.928 m² | 75% (pátio de volta) |
| **8 m** | **7** | **22.534 m²** | **54.512 m²** | **51%** ← adotado |
| 14 m | 4 | 18.326 m² | 34.757 m² | 32% |
| 24 m | 4 | 15.451 m² | 27.974 m² | 26% |

A tabela antiga (17/9/5 peças) contava as peças **antes** dos filtros de área e erosão;
esta conta as que viram volume. E o que autorizou a mudança foi o portão, não o gosto:
com 8 m, `casa sobre a rua` fica em **0,22% na produção** (exatamente o mesmo de antes,
320 volumes) e **melhora** no proxy (2,36% → 2,35%). Ou seja, os 20 pontos de massa
devolvidos não caíram sobre asfalto nenhum.

**E as peças passaram a ser FUNDIDAS.** O shopping é um prédio, e o recorte o entregava
em 7 pedaços: cada via interna que encosta nele abre um corredor, e o que sobra sai
fatiado. As massas do mesmo sítio agora passam por um **fechamento** (dilata e contrai)
que funde o que está a poucos metros e devolve um contorno único e recortado.

O tamanho do fecho **não é gosto**: é o maior da escada `(10, 8, 6, 4, 0)` que ainda cobre
**zero metro de eixo dirigível** — a mesma medida que decide o que é sítio, agora usada
como guarda. Medido no RibeirãoShopping:

| fecho | peças | maior | via coberta |
|---|---|---|---|
| 6 m | 7 | 22.456 m² | 0 m |
| **10 m** | **2** | **60.742 m²** | **0 m** ← o que a escada escolhe |
| 14 m | 1 | 68.661 m² | 140 m ← reprovado |

A escada desce em vez de fixar um número porque em outra cidade o mesmo 10 m pode fechar
por cima de uma via — e aí ele cai sozinho pro degrau seguinte. Verificado pelo portão:
`casa sobre a rua` fica em **0,22% na produção com exatamente os mesmos 320 volumes** de
antes da fusão, e 2,35% no proxy com os mesmos 42.346. A fusão não pôs um metro quadrado
novo sobre asfalto.



### Verificação

    python padrao/rodar_qa.py ribeirao-preto      # 18 portões, 0 reprova
    python padrao/rodar_qa.py sao-carlos

A etapa 7 imprime uma linha por sítio, com nome, área, metros de via dentro e quantas
massas sobraram — é por ali que se confere um caso novo antes de mexer nos limiares.

---

## 20. Dívida conhecida

- **A vitrine de imóveis (`HOUSES`) ainda é conteúdo de São Carlos dentro do
  `app.js`** — 6 anúncios com lat/lon fixos. É demonstração, não configuração do
  renderizador (o portão da cidade ignora esse array de propósito), mas numa cidade
  nova ela some ou vira dado externo.
- **Os scripts do pipeline ainda moram em `v7/pipeline/`**, com nome de versão. Já
  leem caminho de `CID.caminho(...)` e slug de `CIDADE=<slug>`, então a mudança é de
  lugar, não de código.
- **O renderizador tem a própria cópia da tabela de vias** (JS). O portão compara as
  duas e reprova se divergirem — contenção, não cura.
- **A malha de asfalto tem a terceira conta de largura** (`ROAD_W/2 + 5`, em
  `gen_ruas.py`), diferente da fita de `padrao.vias`. Não afeta encosto de muro nem
  portão nenhum, mas é o próximo a entrar no padrão.
- **A árvore não sabe do poste, da entrada de garagem nem da faixa de pedestre.** O
  asfalto ela respeita (índice global); o resto do mobiliário urbano não existe no dado,
  então não há o que respeitar.
- **A rua tem textura e faixa central, mas não tem o resto da sinalização.** Faixa de
  pedestre, seta de conversão, vaga e lombada não existem — nenhum deles dá pra deduzir
  de `aVia` sozinha, todos precisam de dado que o pipeline não traz. A faixa central
  virou shader na seção 15 e o `buildDashes` saiu.
- **A calçada é a próxima a pedir tom.** O asfalto foi escurecido (ver abaixo), mas a
  calçada ficou no valor antigo e agora é a superfície mais clara da cena depois do
  telhado de laje. Ainda não incomoda; se incomodar, é a mesma linha.
- **O portão da árvore mede uma amostra, não a cidade.** São ~1.650 árvores de rua dos
  80 primeiros quarteirões que a sonda manda montar; a medida vale pra regra (0% fora da
  calçada), não pra cobertura. A sonda drena a fila de streaming ela mesma, de forma
  síncrona — sem isso o resultado variava entre 1.693 árvores e página em branco, porque
  `--virtual-time-budget` adianta os temporizadores sem dar CPU.

  (A seção 16.5 tem a saída geral pra isso, que a sonda da árvore ainda não usa: o
  servidor de espera do `foto.py` segura o relógio virtual pelo tempo real.)
- **A árvore é o que sobrou parecendo jogo.** Depois da telha e do encardido, o objeto
  mais chapado da foto de rua é a copa: poucos polígonos, verde saturado e sombreamento
  plano. Não entrou neste ciclo porque o pedido era prédio e estrutura, e porque a
  árvore é `InstancedMesh` por espécie — mexer nela é mexer na biblioteca do Blender
  (`arvores/`), não no shader da cidade.
- **O minimapa só conhece via.** Quadra, água e área verde não entram — daria contexto
  ("isso aqui é o parque") por mais um índice espacial. A malha viária foi escolhida
  porque já estava decodificada e é o que orienta.
- **A busca não tem bairro.** Tem via, lugar e edificação com nome; bairro não existe
  como dado na página (o `bairros_*.geojson` fica fora do `city.json`).
- **PWA continua fora.** Service worker não registra em `file://`, que é justamente o
  jeito como a página é aberta. Só faria sentido na versão servida, e aí o cache dos
  6,6 MB é o problema interessante, não o `manifest.json`.
- **Dos quatro lançamentos de São Carlos, três têm mais planta do que foi extraído.**
  Entrou uma planta por empreendimento (a que casa com a ficha da imobiliária), e o
  material traz outras seis: Wish 3 dormitórios/78 m²; Cedros aptos 102 e 202 (2 dorm,
  com quintal e com varanda, até 44,32 m²); Colinas aptos 101 e 202. Todas no mesmo
  formato das que já foram lidas — o custo é de leitura, não de código. O que falta pra
  isso valer é o renderizador aceitar mais de uma planta por empreendimento: hoje
  `unidade.json` é uma unidade, e duas plantas do mesmo prédio seriam duas unidades
  disputando o mesmo volume.
- **Nenhum dos quatro tem mobília.** Entram vazios, como o mirra-114 desde 31/08/2026.
- **O plano do Unreal segue por fazer, e de propósito.** O bake da seção 23 entrega o
  resultado (canto escuro, contato, parede clara perto da janela) sem sair da página;
  o que o Unreal ainda daria a mais é material fotografado, ricochetada colorida e
  luz direta assada. O preço continua sendo 30-60 MB por cidade e uma segunda fonte
  de verdade pra mesma planta — ver a abertura da seção 23.
- **O portão do interior mede sempre a PRIMEIRA unidade da vitrine**, que é a primeira
  em ordem alfabética de pasta — hoje `monte-das-colinas-39`. As outras três não são
  medidas por ele. Trocar o nome de uma pasta troca o que o portão olha, em silêncio.
  (05/09/2026: `pipeline/mede_interior.py --unidade <id>` mede qualquer uma delas à mão.
  O portão continua olhando só a primeira — a calibração da faixa é dela.)
- **Duas das quatro unidades de São Carlos reprovariam o portão do interior.** Medido em
  05/09/2026 na página SEM nenhuma mudança de bloco: `monte-dos-cedros-37` dá faixa 80,8
  e `sanca-135-29` dá 61,0, contra o piso de 90. Não é regressão de nada recente — nunca
  tinham sido medidas, porque o portão só olha a primeira da vitrine. Nos dois o defeito
  é ENQUADRAMENTO (a câmera de entrada para de frente pra parede, sem janela no quadro),
  não iluminação.
- ~~**Uma unidade de lote desenha UM volume.**~~ Fechado em 05/09/2026: `lote.predio`
  ganhou `blocos`, uma lista de volumes no frame do lote (`du`/`dv`/`giro_graus`), e o
  grupo de streaming leva N registros. As quatro unidades de São Carlos foram remodeladas
  a partir das perspectivas dos anúncios — o Wish virou lâmina dobrada com embasamento, o
  Cedros as duas torres com portaria, o Colinas quatro blocos MRV, o Sanca o L de lâmina
  mais volume de esquina sobre o embasamento da garagem. Custo: nenhuma chamada de
  desenho a mais (todos os blocos caem numa malha só). Ver
  `plantas_fornecidas/LEIA-ME.md` § `blocos`.
- **`faixa_pav`: a testeira de laje que dá a volta no prédio** (06/09/2026). Medida na
  perspectiva oficial do Wish, é o elemento horizontal que faz a torre ter 21 linhas em
  vez de ser um pano liso. Nas quatro faces, ~12 triângulos por pavimento por face.
- **Vazamento de luz nas juntas do interior — duas causas, as duas fechadas**
  (06/09/2026, reportado pelo usuário). (a) O bake amostrava o vértice do topo da parede
  ONDE ELE ESTÁ, e ele fica 6 cm ACIMA do forro de propósito (senão a tampa do prisma
  briga com o forro pelo mesmo pixel): lá o raio sai por cima do forro, vê espaço aberto
  e volta com irradiância de fachada, que a face lateral interpola pra dentro — fio claro
  em toda junta parede-teto. Agora a amostra é limitada a 2 cm abaixo do forro.
  Confirmado por A/B com `?bake=0` antes de mexer. (b) O rodapé é 2,4 cm mais grosso que
  a parede, então a tampa dele era uma prateleira de 1,2 cm virada pra cima: virada pra
  cima ela vê o cômodo inteiro e recebe irradiância de superfície exposta, no meio de um
  canto escuro — fio branco picotado na junta chão-parede (picotado porque 1,2 cm a 5 m
  não chega a um pixel). Escurecer a tampa NÃO resolveu (medido a 0,72 da cor da parede);
  o que resolveu foi não emitir a tampa (`semTampa` em `prismaQuad`) — no lugar dela
  aparece a face interna do prisma, que está na sombra, que é o que se vê num rodapé de
  verdade.
- **A listra da quina só fechou na TERCEIRA tentativa, e as duas primeiras foram
  diagnóstico errado dado como certo.** O que resolveu: a ponta da parede entra na
  vizinha `ESP/2 − 6 mm`. Com `ESP/2 + 1 cm` (a primeira tentativa) ela ATRAVESSA a
  parede vizinha e sobra 1 cm do outro lado — uma tira de 10 cm encostada na face, que
  de perfil é a mesma listra. Medido na mesma vista, mesma câmera: ponta a descoberto
  **+13,8** de luminância sobre a parede, ponta atravessando **+8,0**, ponta parando
  6 mm antes da face **+0,7** — só que esse −6 mm ABRE UMA FRESTA na quina (nenhuma das
  duas paredes cobre aquele canto), que foi o defeito seguinte que o usuário fotografou.
  O valor certo é `ESP/2` EXATO: a ponta encosta na face de fora da vizinha, sem
  atravessar e sem sobrar. Medido: **+0,9** e sem fresta. A cadeia de A/B que chegou lá está em
  `pipeline/foto_interior.py` (`--pintar`, `--sem-env`, `--sem-lightmap`, `--sem-map`,
  `--sem-sombra`, `--so-vertice`): com luz desligada a listra some, com sombra, atlas,
  textura ou cor-de-vértice isoladas ela FICA — ou seja não era vazamento de sombra nem
  costura de lightmap, era geometria a mais respondendo à luz difusa.
- **Listra vertical nas quinas: era a PONTA do prisma de parede** (06/09/2026, segunda
  leva do vazamento). A ponta é uma tira da espessura da parede com a normal virada pro
  cômodo, encravada entre duas faces que estão no canto: o bake dá a ela irradiância de
  superfície exposta e sombra às vizinhas. Provado pintando só as pontas de magenta — as
  listras que o usuário fotografou ficaram magenta. `semPontas` em `prismaQuad` é MÁSCARA
  por ponta, e a distinção importa: a ponta que morre em outra parede não existe (está
  dentro dela) e sai; a que morre num VÃO é o rasgo da porta, existe, e fica.
  **Medido: apagar as duas derruba a faixa dinâmica do portão de 99,6 pra 65,6** — o
  rasgo da porta carrega contraste de verdade, não é artefato. Com a máscara: 96,2.
  Junto, a ponta de junta passou a entrar meia espessura na parede vizinha.
- **A fachada do lançamento ganhou sacada de verdade** (05/09/2026): `sacadas` no bloco
  emite laje que avança 1,4 m e guarda-corpo cheio, um por pavimento, dentro da mesma
  malha do grupo — ~48 triângulos por sacada e nenhuma chamada de desenho a mais. Vale
  só pra lançamento: a base do Overture não sabe onde há sacada em 96 mil edificações.
- **O portão do interior é INTERMITENTE, e não por causa do interior.** O mesmo build
  mediu faixa 99,6 numa rodada e 73,7 na seguinte. Causa encontrada e corrigida em
  parte: os voos de entrada são ENCADEADOS (o `fim()` do voo até o prédio é que cria o
  voo de entrar), e a sonda rebobinava só o primeiro — aos 2600 ms o segundo às vezes
  ainda corria, e a foto saía de outro lugar. Agora a sonda só mede com `INT.voo` nulo.
  Depois disso: 10 medidas seguidas, 9 em ~99,3 e uma em 74,4 — melhorou, não fechou.
  Enquanto não fechar, **uma reprova isolada deste portão pede uma segunda rodada antes
  de virar diagnóstico.**
- **O Monte das Colinas está no bairro certo e na rua errada, de propósito.** O anúncio
  diz "Rua Antonio Carlos Dalla Déa, 540, JARDIM BOTAFOGO", e no CNEFE essa rua fica no
  Residencial Deputado José Zavaglia, 2,3 km ao sul do Jardim Botafogo. O `_conflito` no
  `unidade.json` tem as quatro fontes; a implantação seguiu o bairro. Vale confirmar com
  a construtora antes de tratar a coordenada como boa.

---

## 21. O miolo vazio: o lote parava em 25 m e a quadra tem 86

Reportado em 04/09/2026 ("os miolos vazios voltaram"), com um print. A causa nao era
falta de casa, e falta de LOTE.

`lotes_sinteticos.subdivide` caminhava o perimetro do miolo e puxava **DEPTH metros
fixos** pra dentro -- 25 m, de `cidades/<slug>.json`. O quarteirao de Sao Carlos tem
**86 m de largura menor**: 25 de um lado, 25 do outro, e **36 m de nada no meio**. Chao
sem lote nao tem muro, nao tem quintal e nao recebe casa: aparece como buraco.

Medido no centro (recorte de 700 x 700 m) antes do conserto:

| | |
|---|---|
| cobertura da quadra por lote | **76,9%** |
| area sem lote | 10,64 ha |
| dela no NUCLEO da quadra (>15 m da divisa) | **95,2%** |

**Quadra nao tem sobra: e dividida inteira em terrenos, e o terreno vai da rua ate o
meio.** Tres mudancas, nessa ordem, porque cada uma so apareceu depois da anterior:

1. **`fundo_ate_o_meio`** (lotes_sinteticos): lanca um raio da testada pra dentro, mede
   a travessia da quadra ali e usa METADE. A fileira da face oposta mede a mesma
   travessia, entao as duas se encontram no meio. Quadra concava faz o raio sair e
   voltar -- vale o trecho que COMECA na testada, nao a soma.
2. **Teto pela largura menor da quadra.** Sem ele a face CURTA media a travessia no
   sentido comprido (130 m numa quadra de 130 x 86) e puxava lote de 65 m, que comia
   metade do quarteirao e deixava o resto em lasca. E `largura_menor(poly)/2`.
3. **Testada minima de 5 m.** O recorte por `feito` deixa caco de 2-3 m de frente na
   quina: passa na area e no retangulo, mas o `build_v7_city` recusa (`w < 3,6`) e o
   lote fica so com muro. Eram **9.729** assim na primeira rodada.

E uma quarta, do outro lado da cerca:

4. **`PROF_REF` no `build_v7_city`.** A tabela `CLASSES` da `recuo` e `prof` como FRACAO
   do terreno, calibrada nos 25 m. Com lote de 43 m as mesmas fracoes geravam casa de
   19 m de profundidade -- galpao, nao casa, e colidindo com a do outro lado da quadra.
   **O fundo do lote nao e o fundo da casa**: a casa ocupa a frente e o resto e quintal.

Resultado, no mesmo recorte:

| | antes | depois |
|---|---|---|
| cobertura da quadra | 76,9% | **93,8%** |
| mediana por quarteirao | 77% | **94%** |
| lotes na cidade | 119.650 | **123.765** |
| lotes com prova de ocupacao | 65.054 | **66.392** |
| predios | 78.999 | 77.145 |
| casas puladas por nao caber | -- | 7.471 |

Os 18 portoes passam. **`pipeline/cobertura_da_quadra.py`** virou a medida disso e deve
rodar sempre que o lote mudar; ele nao so da a media, diz ONDE falta (borda / meio /
nucleo), que e o que separa canto de esquina de buraco no meio da quadra.

**Continua aberto:** na cidade inteira a cobertura e 77,5% com mediana 87%, e 2.220 dos
4.798 quarteiroes ficam abaixo de 85%. Sao as glebas de periferia, onde o teto da
largura menor deixa o centro vazio de proposito -- gleba de 300 m nao vira lote de
150 m. Se incomodar, o conserto e uma segunda fileira de lotes com viela, nao aumentar
o teto.

---

## 22. O clone refeito: duas provas de ocupação e quadra sem sobra (2026-09-04)

Pedido: *"você consegue fazer um clone de São Carlos na última versão, e refazê-lo da
melhor forma que conseguir? já temos quase todos os dados"*. O pipeline já estava na
última versão e passava nos 18 portões — então refazer só valia se atacasse defeito
**medido**. Eram dois, e um terceiro apareceu na foto.

### 22.1 A segunda prova de ocupação estava no disco e desligada

`fontes.enderecos` era só o cadastro do SigaSC (54.111 pontos). O CNEFE de São Carlos
(143.200) tinha sido baixado em 03/09 e gravado em `address_points_cnefe.json` **sem
sobrescrever** o cadastro da prefeitura — o que estava certo — mas nada consumia o
arquivo. Uma prova não anula a outra: o SigaSC cobre lote que o Censo não visitou e o
CNEFE cobre bairro que o cadastro municipal não alcança.

- `padrao/cidade.py` ganhou `caminhos(chave, obrigatoria=False)`: aceita string ou lista
  e ignora arquivo declarado que não existe.
- `fontes.enderecos_extra` (lista) na ficha da cidade. Cidade que não declara continua
  igual — Araraquara, Sorocaba e S.J. do Rio Preto seguem **sem nenhuma** prova de
  endereço, e é o mesmo conserto de dez minutos lá.
- `ocupacao.py` soma tudo e deduplica na grade de 1 m: **197.271 → 166.445 pontos**.

### 22.2 Quadra não tem sobra — inclusive a de planta oficial

A caminhada do perímetro (§21) deixa três restos: a cunha da esquina, o caco que os
filtros recusam e o núcleo da quadra larga. `lotes_sinteticos.sem_sobra` fecha os três:
núcleo vira **fileira de fundo** (a divisa com a primeira fileira faz as vezes de viela,
até `NIVEIS=3`), e o que sobra depois disso entra no **lote vizinho** de maior divisa
compartilhada — que é como um loteamento real fecha a quadra, com a cunha ficando pro
lote de esquina.

E `funde_inuteis`: **lote que não comporta casa não é lote**. Ele continua com prova de
ocupação, então ganhava MURO e não ganhava casa — quintal murado vazio no meio do
quarteirão. Eram 9,4% dos lotes ANTES desta rodada; agora entram no vizinho que constrói.
O limiar é 11 m de fundo, não os 8 m da regra do `build_v7_city`: ele ainda desconta o
recuo (`livre >= 6`, ~9,1 m) e mede no eixo da QUADRA, não do lote.

**A maior fonte de miolo vazio, porém, não vinha da grade — vinha da planta.** Medido na
faixa de quadra comum (60-90 m de largura menor):

| fonte dominante do quarteirão | quadras | cobertura FINAL | a grade cobriria |
|---|---|---|---|
| sintético | 1.121 | 86,3% | 88,1% |
| **planta oficial** | **414** | **48,0%** | 88,9% |
| planta refeita | 100 | 78,4% | 88,1% |

A planta registra o desenho de uma parte do quarteirão e cala sobre o resto. Antes de
completar, foi preciso provar que a sobra é vazio e não fresta entre lotes oficiais:
**1.414 pedaços, 1.000 ha, mediana de 3.796 m² com 58,9 m de largura menor**; pedaço fino
(<6 m) são **3 de 1.414 (0,2%)**. É meia quadra, não erro de recorte.

`juntar_lotes` passou a completar a quadra de planta APROVADA (`fonte:
"planta_complemento"`, 20.923 lotes em 1.018 de 1.026 quadras), usando a frente × fundo
**daquela planta**. **O lote oficial não é tocado**: o complemento nasce de
`miolo − união(lotes oficiais)`, então por construção não invade o desenho registrado.

### 22.3 O teto de fundo, e por que ele é condicional

A foto mostrou o que os números não mostravam: na quadra de 190 m o lote ia "até o meio"
e saía com **96 m de fundo** — um muro de 96 m com uma casa de 10 na ponta. A planta
oficial de São Carlos (18.257 lotes desenhados pela prefeitura) dá fundo mediano de
**24,9 m**, p90 30,9 e p95 **34,2**. Daí `lote.fundo_max_m = 35`.

Mas o teto **não pode ser incondicional**: no quarteirão comum de 86 m, 35 + 35 deixa um
núcleo de 16 m — estreito demais pra virar fileira e grande demais pra ser absorvido como
caco. Reabriria exatamente o defeito do §21. A regra é: **só corta quando o que sobra
ainda dá uma fileira de fundo inteira** (`2 × (dl − FUNDO_MAX) >= NUCLEO_LARG_MIN`).

O teto foi aceito por um teste que não é cobertura: em 146 quarteirões (incluindo as 6
maiores glebas), o centróide dos lotes ocupados de hoje continua caindo dentro de algum
lote novo — **2.383 com teto contra 2.392 sem teto e 2.292 no original**. Ou seja, o teto
não custa casa; ele troca cobertura de miolo de gleba (onde não há construção) por lote
de tamanho real.

### 22.4 O resultado

| | antes (build de 09:19) | depois | |
|---|---|---|---|
| pontos de endereço | 54.111 | **166.445** | +207% |
| lotes | 123.765 | **171.762** | +39% |
| lotes com prova de casa | 66.392 | **86.754** | +31% |
| prédios | 77.145 | **96.168** | +25% |
| cobertura da quadra | 77,5% | **84,8%** | |
| ... p10 por quarteirão | 22% | **62%** | |
| ... área sem lote no NÚCLEO | 843,9 ha | **495,8 ha** | −41% |
| página comprimida | 6,80 MB | **8,11 MB** | |
| portões de QA | 18 ok | **18 ok** | |

Custo: etapa 3 de 324 s para 633 s (a fileira de fundo custa uma volta no perímetro por
nível); passada 4→9 completa em 1.292 s, dos quais 495 s são o QA.

### 22.5 O que ficou aberto

- **Casas puladas subiram de 7.471 para 12.949** (11,3% → 14,9% dos lotes ocupados).
  4.716 delas são lote de complemento raso demais: o complemento herda a frente × fundo
  da planta, e no fundo da quadra nem sempre cabe. O `build_v7_city` agora quebra o
  "não coube" por fonte e motivo (`frente<3,6` / `fundo<8` / `recuo não cabe`), que é o
  que permitiu achar isso — antes era um número só.
- **5.185 lotes sintéticos recusados por "recuo não cabe"** estão em quadra estreita
  demais pra qualquer casa da tabela `CLASSES`. Ou a casa mínima encolhe (mexe em todas
  as cidades) ou o lote sem casa possível deixa de receber muro.
- **A cobertura da cidade inteira ainda é 84,8% com 2.103 quarteirões abaixo de 85%.**
  O que falta agora é miolo de gleba além dos ~105 m que 3 fileiras alcançam — terreno
  sem construção, onde não há o que desenhar.
- **As outras quatro cidades não receberam nada disto.** As mudanças são todas de
  pipeline (não de renderizador), então é só rodar `--de 3 --ate 9 --forcar` nelas; e
  três delas ainda ganhariam o CNEFE, que nunca tiveram.
- **A etapa 6b declara `city_saida` como entrada e roda ANTES da 7.** Depois de uma
  passada completa ela aparece sempre como "velha" no `--listar`, e não é cosmético: o
  `portoes.json` sai do city.json da rodada ANTERIOR. Fechar custa `6b` + `--de 8 --ate
  9` (aqui: 75.208 → 84.826 portões). Ou a 6b passa a rodar depois da 7, ou ela deixa de
  declarar essa entrada.

---

## 23. O bake de luz do interior (2026-09-04, v15)

O pedido veio como dois planos escritos: construir os apartamentos no Unreal Engine
5, iluminar com Lumen, bakear lightmap 2048²/4096², exportar em KTX2 e aplicar as
texturas no Three. **A parte do Unreal não foi executada**, e a razão não é falta de
ferramenta — o UE 5.8 está instalado nesta máquina e o servidor MCP dele responde na
porta 8000. É que o produto daquele caminho não cabe neste projeto:

- **30 a 60 MB de textura por cidade** (número do próprio plano) contra uma página
  que abre com duplo clique em `file://` e hoje pesa 8,1 MB comprimida. KTX2 não é
  embutível em base64 sem perder o que ele economiza, e `fetch` de arquivo local é
  bloqueado por CORS — que é o motivo de a base já ter voltado pra dentro do HTML na
  v6.
- **Uma segunda fonte de verdade pra mesma planta.** O interior nasce de
  `plantas_fornecidas/<id>/unidade.json`. Corrigir a largura de um cômodo passaria a
  exigir rodar o Unreal de novo, refazer UV, rebakear e reexportar — ou conviver com
  textura que não bate mais com a geometria.
- **UV unwrap, materiais e câmeras são trabalho de artista na interface do editor**,
  não roteirizável em uma sessão. As fases 2 e 3 do plano estimam 4 a 7 dias.

O que foi executado é o RESULTADO que o plano queria: a luz do cômodo deixou de ser
um valor chapado por face e passou a ter canto escuro, contato com o piso e parede
clara perto da janela. Só que medida aqui, sobre a mesma geometria que já é gerada, e
escrita onde já havia lugar: **a cor por vértice**.

### O que entrou

`renderizador/app.js`, seção 12b, ~300 linhas. Três fases, porque uma só não cabia
num quadro:

| fase | o que faz | quando roda | custo medido |
|------|-----------|-------------|--------------|
| `bakePrepara` | tessela a malha a 40 cm e monta a tabela de vértices únicos | síncrono, junto com a malha | **85 ms** (mirra-114, 114 m²) |
| `bakePasso` | traça 48 raios por vértice, em fatias | 12 ms/quadro durante o voo, 4 ms depois | **482 ms** em 81 quadros |
| `bakeFecha` | suaviza, normaliza e escreve na cor | uma vez, no fim | dentro dos 482 |

A casa aparece na hora com o albedo puro e a luz **assenta** ao longo do voo de
entrada. `BAKE.cache` guarda o resultado por unidade: reentrar não paga de novo.

**Custo de desenho: zero.** Não entra textura, atributo, material nem malha. As três
malhas da casa (parede, piso frio, piso madeira) continuam sendo três chamadas de
desenho; o que muda é o conteúdo do buffer de cor, que já existia e já era lido.
A malha vai de 2.676 pra 30.018 triângulos em São Carlos — e triângulo não é a moeda
cara aqui, chamada de desenho é (a mesma conta do móvel chanfrado, seção 7).

### Como a irradiância é medida

De cada vértice saem 48 raios cosseno-ponderados (Hammersley + Malley) no hemisfério
da normal. Cada raio devolve **céu** — escapou da planta por um vão — ou a distância
até o que bateu. Céu vale 1; bater vale `0,30 × min(1, d/2,60)`, ou seja pouco e
proporcional à distância: é isso que faz canto de parede (bate a 20 cm) ficar escuro
e meio de sala (bate a 3 m) ficar claro. É oclusão de ambiente com uma ricochetada,
não path tracing — e é o que uma foto de apartamento vazio mostra.

O passeio é 2D (DDA sobre uma grade de 90 cm com as paredes) e a altura entra só no
teste do vão: parede embaixo do peitoril, parede acima da verga, nada no meio. É o
que faz a janela ser janela.

### As cinco coisas que custaram tempo

**1. A conta roda no referencial da PLANTA, e o vértice estava no MUNDO.** A planta é
girada pra assentar no eixo maior do prédio, e o prédio está no rumo da rua. Rodar a
oclusão no frame da planta é o que deixa toda parede paralela a um eixo (caixa
envolvente de uma fatia em vez de 64 células). Só que a geometria sai em coordenada
de mundo, e a primeira versão esqueceu de converter os raios. O efeito não foi normal
torta: foi **bake inteiro valendo 1** — nenhum raio batia em nada, tudo virava céu, e
a página ficava visualmente idêntica. Só a sonda de perfil (`BAKE.k`, com
`min = p50 = max = 1`) denunciou; no print a diferença passava por sutil.

**2. Normalizar pela MEDIANA, não pela média.** A distribuição da irradiância num
apartamento é torta pra direita: quase toda superfície enxerga o mesmo pouco (parede
de frente pra parede) e uma minoria — o que dá de cara pra janela — enxerga muito.
Com a média, essa minoria puxa o divisor pra cima e a parede TÍPICA sai escurecida:
medido, a mediana do ganho ficava em 0,82, ou seja o bake virava um botão de exposição
pra baixo. E a exposição deste projeto tem dono, que é `pipeline/mede_interior.py`.
Pela mediana, a parede típica fica onde estava e o bake só mexe nos extremos.

**3. Suavizar por vizinhança no ESPAÇO, não por aresta da malha.** Duas coisas de uma
vez. Ruído: 48 raios deixam ~14% de Monte Carlo, e num quad de parede isso lê como
MANCHA — que é pior que o defeito original, porque parede manchada parece sujeira, não
iluminação. Emenda: `paredesDaGrade` corta a parede em cada vão, e cada pedaço vira um
prisma próprio com tampa nas pontas; os vértices dos dois lados NÃO coincidem, então
pela malha eles não são vizinhos, e a média por aresta deixava um **degrau vertical em
cada emenda**. Com pouco contraste ninguém via; ao subir o contraste (item 5) as
emendas apareceram como listras na parede de Ribeirão. Vizinhança por distância
atravessa a emenda, porque ela não existe no espaço. O filtro de normal
(`dot > 0,80`) é o que impede o borrão de atravessar quina.

Trocar adjacência por hash espacial ainda derrubou o custo síncrono de 189 pra 85 ms,
porque o `indexOf` da lista de adjacência saiu junto.

**4. O relógio virtual do headless mentiu duas vezes** (a mesma armadilha da seção 16,
com duas caras novas):

- `performance.now()` antes e depois de um bloco síncrono devolve a MESMA leitura sob
  `--virtual-time-budget`: o tempo virtual só avança quando o laço de eventos fica
  ocioso. A sonda relatava `bake: 0 ms` pra um bake de 948. Medir de verdade exigiu
  rodar o Chrome SEM tempo virtual e matar o processo no prazo.
- Pior: o `mede_interior.py` fotografava a câmera ONDE ELA ESTIVESSE aos 2.600 ms, e
  com o laço ocupado o **voo de entrada congelava no ar**. A mesma página, trocando só
  `?bake=0` por `?bake=1`, dava `voo: true` com a câmera na origem de um lado e câmera
  posta do outro — dois ENQUADRAMENTOS. A faixa dinâmica caía de 82,7 pra 65,8 e o
  portão reprovava por causa da foto, não da iluminação. **O portão estava medindo, em
  boa parte, de onde a foto foi tirada** — e isso é anterior ao bake: qualquer mudança
  no custo do quadro decidia o enquadramento.

  Conserto: a sonda rebobina `INT.voo.t0` e deixa o próprio laço da página concluir o
  voo (`t >= 1` → `fim()`), o que põe a câmera no destino que ela sempre teve, sem
  coordenada mágica dentro do medidor. E chama `bakeAgora()`, que termina o bake
  pendente de uma vez — cena assando pela metade é outra cena. A sonda passou a
  relatar `voo` e `cam`, que é o que denuncia essa classe de defeito da próxima vez.

**5. O contraste teve que ser reposto, e não era gosto.** `fyParede` — a curva escrita
à mão que o bake substitui — rampeava 0,76 no rodapé, 1,04 no peitoril e 0,90 no forro
em TODA parede, olhando ou não pra janela. Era falso, mas entregava faixa dinâmica de
graça. Com os primeiros parâmetros do bake (céu:superfície de 1:0,60, gama 0,70),
Ribeirão passava com folga e **São Carlos reprovava**: a vista medida lá é a circulação
do monte-das-colinas, um corredor apertado onde a oclusão é quase uniforme, e a faixa
caía pra 65,8 contra o mínimo de 80. Foi preciso céu:superfície de **1:0,30** e gama
**acima de 1** (que abre o contraste em vez de fechar) pra oclusão medida repor o que a
curva inventada dava. Medido depois: São Carlos 90,4 e Ribeirão 84,6.

### Números do portão (`pipeline/mede_interior.py`, câmera presa)

| cidade | unidade medida | | média | p99 | queimado | faixa |
|--------|----------------|-|-------|-----|----------|-------|
| São Carlos | monte-das-colinas-39 | sem bake | 170,9 | 216,2 | 0,0% | 83,4 |
| São Carlos | monte-das-colinas-39 | **com bake** | 162,3 | — | 0,0% | **90,4** |
| Ribeirão Preto | mirra-114 | sem bake | 169,5 | 221,2 | 0,0% | 87,7 |
| Ribeirão Preto | mirra-114 | **com bake** | 171,3 | — | 0,0% | **84,6** |

Faixa desejada: média 120–175, p99 < 250, queimado < 1,5%, faixa > 80.

### Escapes e sondas

- `?bake=0` na URL desliga o bake e devolve `fyParede`. É o que torna o A/B possível
  sem dois builds.
- `window.__int.BAKE` traz `ms`, `msPrep`, `unicos`, `tris`, `med`, `pronto` e `k`
  (perfil do ganho: min/p05/p50/p95/max e quanto por cento travou em cada trava).
- `window.__int.bakeAgora()` termina o bake pendente de uma vez.

### Dívida deste ciclo

- **36% dos vértices travam no teto do ganho (1,38).** São varanda e superfície de
  cara pra janela, que genuinamente saturam — mas é informação perdida num platô. Uma
  compressão suave no topo (em vez do corte) devolveria a modulação lá.
- **Esquadria e móvel não são assados.** O batente fica no valor plano ao lado de uma
  parede com oclusão. Passa despercebido porque o material dele é outro (mais liso, mais
  claro), mas é a próxima superfície a pedir.
- **A ricochetada é única e sem cor.** Um piso de madeira devolve luz quente e um
  porcelanato devolve fria; aqui os dois devolvem o mesmo `0,30`. Colorir o bounce pela
  cor do que foi atingido é barato (a informação está no raio) e é o que mais
  aproximaria de um render de verdade.
- **O bake não sabe do sol.** Ele mede o que enxerga o céu, não de que ângulo o sol
  entra — quem projeta sombra dura continua sendo a luz direcional. Assar a componente
  direta engessaria a hora do dia, que hoje é livre.
- **`bakePrepara` continua síncrono** (85 ms). Cabe em ~5 quadros a 60 fps e acontece
  uma vez por unidade, no clique que já dispara o voo. Se um dia incomodar, é ele que
  precisa fatiar, não o traço — que já está fatiado.

---

## 24. O caminho do Unreal, executado (2026-09-04, v15)

A seção 23 entregou o RESULTADO do plano por outro caminho e explicou por que o
Unreal não tinha sido usado. O pedido veio de volta explícito: *"eu preciso que seja
feito"*. Está feito — o pipeline inteiro existe, roda por comando e é reprodutível.
O que **não** aconteceu foi ele virar o padrão, e isso é medida, não opinião: está
no fim desta seção.

### O que existe, em ordem de execução

| etapa | comando | o que faz |
|-------|---------|-----------|
| 0 | `python pipeline/dump_planta.py <slug>` | tira da PRÓPRIA página a planta como o renderizador a monta (paredes com y0/y1, cômodos, contorno), em coordenadas locais |
| 1 | `python pipeline/unreal_exporta.py` | planta → `.obj` em centímetros + `.tiles.json` (o plano do atlas: uma peça por face) |
| 2 | `UnrealEditor.exe <AssarLuz> -unattended -nosplash` | importa, monta a cena com Lumen e captura **uma ortográfica por face** — 1.588 capturas para as 5 unidades, ~6 min |
| 3 | `python pipeline/unreal_atlas.py` | recorta, vira, empacota e normaliza → um PNG por unidade (76–243 KB) |
| 4 | `pipeline/montar.py` | embute os atlas em `#__luzue` e a página passa a ter `uv1` + `lightMap` |

Extra: `python pipeline/unreal_atlas_prova.py` troca o atlas por um de cores chapadas,
com faixa de orientação — é o que prova que a `uv1` cai no retângulo certo, e foi o
que achou o defeito do canal (abaixo).

### As sete coisas que custaram tempo

**1. O commandlet renderiza, mas não ilumina.** `-run=pythonscript
-AllowCommandletRendering` captura de verdade — as imagens saem — mas só com **luz
direta**: 90% das peças pretas, média global 33/255, e o que estava claro era o
retângulo de sol entrando pela janela. Nem `recapture_sky()` na mão nem os cvars de
Lumen mudaram um pixel. É estrutural: commandlet não tem laço de quadro, e tanto a
captura do SkyLight quanto o Lumen dependem de quadros passando (o Lumen monta a
indireta com **histórico** entre quadros). A solução foi rodar num editor de verdade,
com o trabalho feito **no tick**, uma peça por vez, com quadros de folga entre mover a
câmera e ler. Média global foi de 33 para 76 e as pretas de 20 para 6.

**2. O `-ExecCmds="py ..."` não roda o script.** Nem trace no log. O que funciona é
`[/Script/PythonScriptPlugin.PythonScriptPluginSettings] +StartupScripts=` no
`DefaultEngine.ini` do projeto — que roda depois da inicialização.

**3. O startup script roda antes de haver mundo.** Montar a cena ali dá "no world
context". O trabalho nasce no tick, depois de ~20 quadros de berço.

**4. Reentrância do tick.** Importar malha e compilar material **bombeiam o Slate por
dentro**, e o Slate chama o mesmo callback de novo: cinco `Trabalho` nasceram ao mesmo
tempo e brigaram pelo mesmo ator. O sintoma foi `StaticMeshComponent: ObjectInstance is
null`, que não diz nada sobre reentrância. Uma flag `_ocupado` resolve.

**5. `export_render_target(None, ...)` não escreve byte nenhum, e não reclama.** A
primeira rodada terminou com "162 capturas" no log e a pasta vazia. Precisa do mundo do
editor (`UnrealEditorSubsystem.get_editor_world()`).

**6. O `lightMap` do three não usa `uv1` sozinho.** Este foi o mais caro. A `uv1` estava
**certa** — medida na página: `u` 0,002–0,990, `v` 0,742–0,998, dentro do atlas, e a
contagem de peças batendo exatamente (294 = 294). E a casa saía com uma faixa do atlas
atravessada na parede, listrada. Desde a r152 cada textura carrega o `channel` que ela
lê, e **o padrão é 0**, ou seja `uv`. O `uv` do interior está em METROS (0 a 3,9 numa
parede), então a textura clampava e desenhava uma tira. Uma linha: `t.channel = 1`.
Nada no console, nada errado na geometria — só a textura lendo o canal errado.

**7. Luz assada soma, não substitui.** Com o atlas ligado por cima do que já existia, a
mesma luz é contada duas vezes: média 189,7 (o teto do portão é 175) e faixa dinâmica
49,9 (o piso é 80) — clara **e** chapada ao mesmo tempo, que é a assinatura disso. As
luzes que saem de cena com o atlas: as até seis pontuais de teto, a hemisférica quente
(era a ricochetada do piso) e três quartos do `envMap`. Esse último é o que menos se
suspeita e o que mais achata: `ambientePBR` é um degradê **uniforme** que ilumina todo
ponto da parede igual, e existia justamente pra fingir ambiente antes de haver bake.

### As três decisões de projeto

**A geometria não vem do Unreal.** Só a luz vem, como imagem. A malha continua nascendo
do cadastro dentro do renderizador. É o que impede o Unreal de virar uma segunda fonte
de verdade da planta — corrigir um cômodo muda a malha aqui e invalida o atlas lá, e o
atlas se refaz por comando. Um `.glb` vindo da engine teria congelado a planta.

**Assa-se com material BRANCO PURO.** O que se quer é irradiância, não aparência. Com
albedo 1,0 a captura mostra exatamente quanta luz chega, e o Three multiplica pela cor
que ele já tem. E o atlas entra como **luminância**, croma zero: o céu da UE deixa tudo
azul, e azul multiplicando o bege do cadastro devolve cinza. O cadastro manda na cor, o
Unreal manda na forma da luz.

**Captura ortográfica por face, não lightmap da engine.** O caminho clássico seria
`build_light_maps()` e ler a textura assada — que existe (`LevelEditorSubsystem.
build_light_maps`). Não serve: o lightmap da UE mora num `ULightMapTexture2D` dentro do
MapBuildData, em formato empacotado (HQ/LQ, coeficientes direcionais), e não há como
extrair isso pelo Python da engine sem reimplementar o decodificador. A ortográfica
alinhada à face devolve o retângulo que o atlas espera, em pixel comum, e usa Lumen.

### Por que o padrão continua sendo o bake em JS

Portão de exposição (`pipeline/mede_interior.py`, câmera presa, monte-das-colinas-39):

| | média | faixa dinâmica | veredito |
|---|---|---|---|
| bake em JS (seção 23) | 162,3 | **90,4** | ok |
| atlas do Unreal | 139,1 | **65,3** | FORA (o piso é 80) |

A cena do Unreal é mais suave e mais correta de forma — a ricochetada é de verdade, não
uma aproximação — mas chega **achatada**, e a causa está identificada e medida: dentro
das peças o atlas tem faixa de 255; o que sobra na tela é 65. A captura sai por
`SCS_FINAL_COLOR_LDR`, ou seja já passou pelo tonemapper, que existe pra **comprimir**
faixa dinâmica — que é exatamente o que um mapa de luz precisa carregar. Tentar corrigir
por `auto_exposure_bias = -1.5` não mudou um byte das capturas (as médias brutas saíram
idênticas: 75,1 / 81,9 / 69,9 / 76,9 / 70,8), então o caminho é outro.

`?luz=ue` liga o atlas; `?luz=js` força o bake em JS; `auto` (o padrão) escolhe o JS.
Trocar o padrão é trocar uma palavra em `cursorDeLuz`, quando a medida virar.

### O que falta pra ele virar o padrão

- **Captura LINEAR.** Alvo de render em `RTF_RGBA16f` + `SCS_SCENE_COLOR_HDR`, exportado
  como `.hdr`/`.exr` e lido com um decodificador RGBE (~30 linhas). É o conserto de
  raiz do achatamento: o tonemapper sai do caminho.
- **Esquadria dentro do assado.** Batente, folha e caixilho não estão no OBJ: o Unreal
  não sabe que existe porta, então a luz atravessa onde ela deveria barrar, e as malhas
  de esquadria ficam sem peça no atlas — com o preenchimento desligado elas saíam
  cinza no meio de uma parede iluminada. Hoje sobra hemisférica em 0,085 só pra elas.
- **Densidade.** 24 texels/m (4 cm por texel) foi escolhido pra irradiância de baixa
  frequência. Com captura linear vale medir 48.
- **Móvel.** Continua fora de escopo, como na seção 23 — as unidades cadastradas estão
  vazias.
- **Atlas mal aproveitado.** 12 a 28% de ocupação: o empacotador por prateleira ordena
  por altura e deixa buraco. Não incomoda (PNG de área preta comprime), mas dobrar a
  densidade vai esbarrar nisso antes de esbarrar no 1024.

---

## 25. Cor e detalhe: o portão que fabricava o defeito (2026-09-04, v15)

Pedido: *"olha a coloração... jogo de cores, nível de detalhes... é isso que eu quero
alcançar — não necessariamente os móveis em si"*, com um print de viewport do Unreal
(o HUD `Selected Actor(s)` no canto denuncia que é tempo real com Lumen, não render
offline — a qualidade vem de material e câmera, não de path tracing).

### A medida que redirecionou o trabalho

Comparado o nosso quadro com o de referência, no mesmo tipo de enquadramento:

| | nossa cena (antes) | referência |
|---|---|---|
| pixels abaixo de 70 | **0,0%** | o tampo e a coifa vivem aí |
| valor p01 → p99 | 138 → 224 | ~30 → ~250 |
| saturação média | **0,044** | a madeira sozinha passa de 0,25 |

**A cena não tinha preto e não tinha cor.** Não era resolução, nem GI, nem falta de
normal map: era a paleta, vivendo inteira entre 138 e 224 num espaço de 255.

E a causa raiz estava **dentro do próprio aceite**. `mede_interior.py` exigia média
entre 120 e 175, e as cores do cadastro foram calibradas *para caber nele* — está
escrito no `_calibracao` da sanca-135: *"Escurecidas ~5% ... saía com média 175,3"*.
Sendo um portão de MÉDIA, ele empurra a cena pro meio-cinza. Foto de arquitetura é o
contrário: média mais baixa, preto de verdade em alguns lugares e uma cor saturada
que segura o quadro. **O portão estava produzindo exatamente o defeito que o usuário
apontou** — e nenhuma quantidade de textura ia consertar isso enquanto ele mandasse.

### O portão recalibrado

| medida | antes | agora | por quê |
|---|---|---|---|
| média | 120–175 | **105–168** | deixa a cena ter sombra |
| faixa (p95−p05) | > 80 | **> 90** | aperta contra o chapado |
| p99 / queimado | < 250 / < 1,5% | (iguais) | o defeito original continua defeito |
| **escuro** (< 70) | — | **> 2,5%** | exige âncora escura |
| **croma** (sat. média) | — | **> 0,09** | exige cor |

Os dois novos são **piso, não teto** — a primeira vez neste projeto que um portão
exige a presença de algo em vez de proibir excesso.

O piso de `faixa` é 90 e não 100: 100 foi o primeiro palpite, tirado da medida de UMA
cidade (São Carlos, 102,4), e reprovou Ribeirão em 93,4 — que tinha **melhorado** (era
84,6). Portão calibrado no melhor quadro de uma cidade só não é portão, é retrato.

### O que mudou na cena

**Âncora escura.** O alumínio da esquadria saiu de `0x8E959C` para `0x4B5158`: é o
único elemento que aparece em TODO cômodo, e em cinza médio ele desaparecia na parede
clara. Escuro, ele vira o recorte da janela — a maior fonte de preto num apartamento
vazio. Junto: tampo de bancada em `0x23262A` e marcenaria em `0x5A6249`.

**Uma cor saturada.** A amplitude de tom por régua do piso de madeira dobrou (0,13 →
0,26) e o veio ganhou croma. A madeira é a única superfície que pode carregar cor sem
virar parede colorida.

**Relevo e brilho.** Os três materiais do interior não tinham `normalMap` nem
`roughnessMap` — rugosidade constante é o que faz superfície parecer papel. Entraram
os três relevos (massa corrida, chanfro do porcelanato, rebaixo da régua), derivados
de mapas de altura por diferença central, e rugosidade em manchas. E o `envMap` deixou
de ser um degradê horizontal e virou **um ambiente com janela**: reflexo que não muda
com o ângulo não lê como reflexo, lê como cor.

**Menos luminária.** Eram até seis pontuais, uma por cômodo, todas iguais: o
apartamento inteiro saía no mesmo nível, e cena sem queda de luz entre cômodos não tem
profundidade. Agora são três, com a intensidade caindo 27,5% por ordem.

**Temperatura na profundidade.** O bake passou a devolver dois números por vértice —
quanta luz chega e quanto dela é céu. Quem enxerga céu recebe luz fria; quem só enxerga
parede recebe a que ricocheteou, que é quente. Não custa raio a mais: a fração já
estava sendo contada, só não saía.

### Resultado medido (São Carlos, monte-das-colinas-39)

| | antes | agora |
|---|---|---|
| média | 155,3 | 135,5 |
| faixa | 90,3 | 102,4 |
| escuro | 0,0% | **4,7%** |
| croma | 0,044 | **0,10** |

18/18 portões passando nas duas cidades.

### Mobília automática, e as três formas de não ter

`pipeline/mobiliar.py` deduz um layout da planta — bancada na parede livre mais longa
da cozinha, fogão no meio, coifa em cima, cama na parede longa sem porta nem janela.
Seis peças novas no catálogo (aéreo, coifa, balcão, guarda-roupa, criado, cortina).
Cada móvel continua custando UMA chamada de desenho.

Grava em `plantas_fornecidas/<id>/moveis.auto.json` e **nunca dentro do
`unidade.json`**. Sai por três caminhos, porque os casos são diferentes:

1. `planta.moveis` posto à mão **ganha** do automático;
2. `planta.mobiliar: false` recusa o automático naquela unidade;
3. `?moveis=0` desliga na página inteira, sem rebuild.

Dois defeitos que a regra teve e valem registro:

- **A bancada da cozinha era recusada** por uma folga de porta boa demais: uma caixa
  inflada de 55 cm em volta de QUALQUER abertura. Entre cozinha e circulação há um
  VÃO de 2,05 m, e o balcão ficava a 45 cm do ponto dele — que é onde balcão fica
  mesmo. Vão é passagem aberta: a parede do lado é útil. A folga agora só vale pra
  porta com folha, e se mede do buraco, não do centro.
- **Cortina em vão interno**: qualquer abertura com mais de 1,1 m ganhava cortina, e
  dois painéis de 2,3 m nasceram entre a cozinha e a sala — tapando justamente a
  vista que o enquadramento existe pra mostrar. Só janela tem cortina.

### `foto_interior.py`: por que o portão não bastava

`mede_interior.py` fotografa UMA entrada fixa, e nas plantas de São Carlos ela cai na
**circulação**: um corredor branco com duas portas. Dá pra aprovar exposição ali; não
dá pra calibrar cor e detalhe, porque não há material nenhum no quadro além de parede.
`pipeline/foto_interior.py` põe a câmera no centroide de um cômodo olhando pro
centroide de outro — cozinha em primeiro plano, sala ao fundo, janela no fim, que é
como foto de arquitetura enquadra. O recuo encolhe sozinho enquanto `livre()` recusar:
numa cozinha de 2,3 m um recuo de 1 m atravessa a parede, e a foto sai do lado de fora
olhando o terreno.

### O que continua faltando pra chegar na referência

- **A parede ainda ocupa muito quadro num valor só.** A referência quebra isso com
  marcenaria de piso a teto e um painel de relevo grande; o nosso relevo é micro e
  some a 3 m de distância.
- **A luminária de teto lê como holofote**, não como luz de dia. A mancha circular no
  forro é o ponto mais artificial do quadro.
- **Cortina existe mas é bloco**, sem prega nem transparência — e é ela que, na
  referência, suaviza a janela e dá tecido à cena.
- **Sem profundidade de campo**. É barato (pós-processo) e vale uns 10% da leitura.
- **Móvel é caixa chanfrada.** A cadeira Tulip, o pendente e o vaso da referência
  precisam de asset real (Fab/Quixel são grátis com a UE; Poly Haven é CC0), em
  glTF+Draco+KTX2, ~200-600 KB por peça e compartilhado entre unidades.


## 26. As tres etapas, e a planta que saiu da cidade (2026-09-19, v17)

Pedido de 19/09/2026: um link que abre direto no imovel, com a camera circulando o
predio e a ficha na tela, e **tres etapas** de visualizacao -- mapa, interior e planta
3D. A planta tinha que ser **cenario separado**, sem a cidade em volta, e com o sistema
de moveis funcionando **tambem na vista aerea**.

Sai em `renderizador-v17/`, copia do `renderizador-v16-moveis/`. O v16-moveis nao foi
tocado: monta-se um ou outro por `MAPA_V`.

    MAPA_V=v17 python pipeline/montar.py sao-carlos
    MAPA_V=v17 python pipeline/testa_etapas.py sao-carlos --unidade <id>

### O link

`?imovel=<id>` abre a pagina ja no imovel; `?etapa=mapa|interior|planta` diz em qual
das tres. Ele e lido em `lerLink()`, **depois** que a cidade montou -- achar o predio de
uma unidade depende de `gGroups`, e esse e o mesmo elo fraco que a vitrine ja tinha (o
predio sai de `predio_id`, da ancora do anuncio ou do lote). Nao resolvendo, a pagina
cai no "clique no predio do empreendimento" de sempre, em vez de abrir em lugar nenhum.

Na chegada pelo link o raio de montagem sobe pra **2.500 m** (`RAIO_LINK`), contra os
1.800 m do uso normal. Nao e o novo padrao da pagina: e quase o dobro de area
(2,5² / 1,8² = 1,93), e so vale quando a cidade em volta do predio e o assunto. O
orcamento por quadro do `streamPump` continua o mesmo -- o que muda e quanto tempo ele
leva pra encher, nao o tamanho do engasgo.

**A URL de um imovel e a do IMOVEL.** `escreveLink()` para de gravar `em/r/p/t`
enquanto ha ficha aberta: com a camera girando, aqueles quatro numeros seriam outros a
cada segundo, e na volta brigariam com o enquadramento do proprio predio. Quem escreve
a URL passa a ser `marcaEtapaNaUrl()`, na troca de etapa.

### A camera que circula

`TOUR`, 0,19 rad/s -- uma volta em ~33 s. O giro e por SEGUNDO, nao por quadro: com
passo por quadro a mesma volta levaria 12 s numa GPU e 90 s no rasterizador de
software, e a diferenca apareceria como "o link do celular esta quebrado".

Ela **para no primeiro toque** no canvas (`pointerdown` e `wheel`). E o ponto: o giro
existe pra mostrar o predio a quem acabou de abrir o link, e insistir por cima da mao
de quem ja esta arrastando e o defeito classico desse recurso. Volta pelo botao "Girar
camera" na ficha.

### A planta ganhou cena propria

Ate o v16 a "vista de planta" era a **mesma cena da cidade** com o plano de corte
descendo pra altura do ombro. Funcionava e custava caro: o quadro continuava montando
quarteirao, plantando arvore, projetando rotulo de rua, redesenhando minimapa e
pintando pino, tudo atras de um apartamento de 60 m² que era o unico assunto da tela --
e o bairro fatiado em volta atrapalhava justamente a leitura que a planta existe pra dar.

Agora existe `cenaPlanta`: fundo, nevoa e tres luzes proprias, mais o "chao" (um disco
escuro com grade de 1 m) em que a maquete pousa -- sem uma superficie embaixo, a sombra
do movel cai no nada e a cena perde a unica pista de profundidade que tem.

**A geometria nao e duplicada.** Quem muda de cena e o grupo `gInteriores` INTEIRO, que
ja carrega a raiz da unidade (paredes, piso, esquadria, mobilia, plafom, interruptor e a
grade do modo moveis), o contorno de selecao e o gizmo de setas. Trocar de etapa e um
`add()`: nao remonta malha, nao realoca buffer e nao recompila material.

Quatro coisas que isso cobrou:

- **As luzes do interior mudaram de dono.** Estavam penduradas direto em `scene`
  (`montaLuminarias` e a ambiente do `acendeInterior`); agora nascem em `gInteriores`.
  Sem isso a etapa 3 abriria sem lampada e a cidade ficaria com quatro pontuais orfas.
- **A unidade assenta em y = 0.** Na cidade ela mora em `baseDaCasa` (cota do terreno +
  andar x pe-direito de pavimento); planta de 3º andar nao se desenha 9 m acima do
  papel. `INT.baseY` vira 0 enquanto durar a etapa, e tudo que deriva dele -- corte,
  caixa de selecao, gizmo, altura da lampada -- segue junto sem saber da troca. O
  `interiorFrame` deixa de perseguir o terreno enquanto `PLANTA.on`.
- **O forro sai.** Com o corte no ombro ele sumia por clipping e ninguem notava; com
  "Paredes inteiras" ele e a tampa de uma caixa, e a planta desaparece debaixo dela --
  foi exatamente o que apareceu no primeiro print. Maquete de arquitetura nao tem laje
  de cobertura. A troca do forro saiu do ouvinte do botao orfao "Teto" e virou
  `poeTeto()`, que as duas pontas chamam.
- **A cor escrita na cena da planta e a cor na tela.** O resto do arquivo escreve hex
  CRU porque a paleta da cidade foi calibrada a olho contra a saida sRGB (ver a nota do
  `ColorManagement`): na pratica cada hex daquela paleta e um valor LINEAR. Numa cena
  nova isso nao se herda -- o primeiro fundo foi escrito `0x121820` (quase preto) e saiu
  **#4A5561** na tela, um cinza-azulado de meio-tom. `corTela()` faz a conversao
  explicita, e so nesta cena.

**O ganho e o laco.** `plantaFrame()` e o contrario do `frame()`: nao chama streaming,
arvore, portao, pino, rotulo de rua, minimapa, nevoa do quadro nem noite. Quem nao e
desenhado nao e atualizado -- e isso e o recurso, nao um efeito colateral. O bake de luz
continua rodando ali (`cenaDoBake` ja e cena separada e nao le nada da cidade): sem essa
linha, um link que abre direto na etapa 3 ficaria com a parede sem lightmap ate alguem
voltar pro mapa.

### Dois consertos que vieram junto

- **`flyTo` ganhou GERACAO.** Dois voos disparados no mesmo gesto (a vitrine enquadrando
  o anuncio e, logo depois, a etapa enquadrando pelo tamanho do predio) rodavam os dois
  ao mesmo tempo, cada um escrevendo em `target` e `sph.radius` no seu proprio rAF.
  Medido: a etapa 3 abria a 190 m de distancia -- um apartamento de 10 m virava tres
  pixels -- porque o voo da vitrine escrevia DEPOIS do enquadramento. Agora o voo novo
  invalida o velho na primeira linha do passo, e `paraVoo()` cancela sem mexer na camera.
- **O arrasto inverte na etapa 3.** Ali a pessoa olha um OBJETO, nao um mapa: esquerdo
  gira, direito move -- que e o que o texto da dica da vista de planta sempre prometeu e
  o codigo nunca fez. A faixa de `phi` tambem abre (0,10 a 1,35 contra 0,75 a 1,15):
  de cima a pino E a vista util numa planta, e nao ha horizonte pra proteger.

### O que NAO foi feito

- O raio de 2.500 m vale pra qualquer nivel de grafico, inclusive "baixo". O
  `streamPump` espalha a montagem no tempo, entao nao ha engasgo -- mas a memoria
  residente de um celular fraco sobe junto. Se aparecer, o teto por nivel entra aqui.
- A pagina real nao foi montada neste ambiente: o acervo (`city.json`, relevo, plantas
  fornecidas) nao esta no checkout. A prova saiu de uma fixture sintetica -- um predio,
  uma planta de cinco comodos, mobilia parametrica -- pelo mesmo Chrome headless que os
  outros portoes usam. `pipeline/testa_etapas.py` e o portao pra rodar contra o acervo
  de verdade.

### Publicar o v17 num link separado

O v17 sobe num **segundo site de Hosting**, com URL propria, sem encostar no site de
producao. A config dele e `firebase.v17.json` -- arquivo separado, e nao uma segunda
entrada dentro do `firebase.json`, porque assim nao existe comando que suba o v17 e
derrube o v16 junto. O `firebase.json` continua sendo o dono de `v16-moveis/publicado`.

Uma vez, pra criar o site (o nome vira a URL; se trocar aqui, troque tambem no
`firebase.v17.json`, que e o unico outro lugar em que ele aparece):

    npx firebase login
    npx firebase hosting:sites:create imobiliaria-v17

A cada publicacao:

    MAPA_V=v17 python pipeline/montar.py sao-carlos
    MAPA_V=v17 python pipeline/publicar.py sao-carlos "Sao Carlos 3D - v17"
    npx firebase deploy --config firebase.v17.json --only hosting

Sai em `https://imobiliaria-v17.web.app`. O link direto de um imovel e essa URL mais
`?imovel=<id>` -- e `&etapa=planta` (ou `interior`) pra abrir direto na etapa.

`MAPA_V` tem que estar nos DOIS comandos: e ela que faz o `montar.py` ler
`renderizador-v17/` e escrever em `v17/`, e e dela que o `publicar.py` tira a pasta
onde procurar a pagina (`from pipeline.montar import VERSAO`). Sem ela os dois
montam e publicam o v15.

Se um dia a preferencia for um site so, com o v17 num caminho proprio em vez de num
dominio proprio, e trocar o `hosting.public` do `firebase.json` por `v17/publicado` e
copiar a pagina do v16 pra dentro de `v17/publicado/mapa/` -- as duas continuam
servidas, muda quem e o `index`. Nao foi feito assim porque "link separado" e
literalmente o que foi pedido, e dominio separado e o unico jeito de as duas versoes
terem index proprio.
