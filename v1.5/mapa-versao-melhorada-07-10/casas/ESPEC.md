# Casas procedurais com regras: especificação para implementação

Faz parte de `../PLANO.md`, etapa 3. O objetivo é trocar todas as casas da biblioteca
Blender (74 modelos, 50.277 encaixes, 62% dos triângulos do mapa) e as casas procedurais
antigas (`fonte/world/buildings.js`) por casas geradas **por lote**, com regras de
arquitetura e de engenharia, em três níveis de detalhe.

## Onde cada coisa mora (só nestes caminhos)

| Caminho | O quê |
|---|---|
| `regras/sao-carlos.json` | Todos os números das regras, cada um com `_nota` e `"a_conferir": true` quando vier de prática e não de lei |
| `casas/sorteio.js` | Gerador pseudoaleatório determinístico (splitmix32/mulberry32 sobre inteiros) e fluxos por etapa |
| `casas/regras.js` | Motor de regras: lote → plano da casa. Puro, determinístico, sem DOM. Roda no Node (gerador) |
| `casas/formato.js` | Codifica e decodifica o plano binário (ArrayBuffer/DataView) |
| `fonte/casas/geometria.js` | Plano → triângulos (LOD0, LOD1, LOD2) no contrato de atributos do renderizador. Roda no navegador e no Node |
| `gerador/casas.mjs` | Roda a cidade inteira e grava `derivados/casas/*.bin` + `derivados/casas/qa.json` |
| `testes/casas.test.mjs` | Testes com `node --test` |
| `medicoes/vitrine.mjs` | Renderiza casas de amostra em three.js r168 (Playwright + SwiftShader) e grava PNGs em `medicoes/vitrine/` (fora do git) |

Os módulos de `casas/` e `fonte/casas/` usam o mesmo padrão do renderizador:

```js
(function (root) { "use strict"; /* ... */ root.CasasGeometria = { ... }; })(globalThis);
```

Assim funcionam como script comum no navegador e com `require`/`import` de efeito no Node.
O `fonte/casas/geometria.js` **não pode depender** de `THREE`: devolve arrays tipados.

## Entradas (todas no repositório, só leitura)

- **Cidade:** `sao-carlos/sao-carlos-v7.city.json`.
  - Decodificador em `fonte/core/city-data.js`; o `q` vem do JSON, em decímetros.
  - Campos: `b` (prédios `[classe, altura×10, n, Δx, Δz…]`), `fa` (ângulo da frente em graus; 400 = sem frente), `bl` (quarteirões `[cx, cz, raio, início, quantidade]`), `r` (vias).
  - Coordenadas em metros relativos ao centro `c`: x para leste, z para o sul (`pz = -(lat-lat0)·111132,92`).
- **Lotes:** `sao-carlos/dados/lotes_saocarlos_completo.geojson`.
  - 110.089 polígonos lon/lat.
  - Propriedades: `area_m2`, `frente_m`, `fundo_m`, `quadra`, `loteamento`, `fonte`, `padrao_lote` etc.
  - Projeção igual à do renderizador: `MLAT = 111132.92`, `MLON = 111319.49·cos(lat0)`, com centro em `padrao/cidades/sao-carlos.json` → `centro`.
- **Ruas:** `sao-carlos/dados/street_tris.json` (triângulos `[x, z]` em metros; preenchimento entre quadras) e as vias `r` do city.json (larguras em `ROAD_W` de `fonte/app.js:133`).
  - Servem para achar a testada (a borda do lote voltada para a rua).
  - Servem também para o portão "casa sobre a rua ≤ 1%": hoje está em 0,56%, não pode piorar. A conta está em `padrao/` e `relatorios/qa_sao-carlos.json`.
- **Relevo:** `sao-carlos/relevo_wide.json` (grade de elevação; ver `fonte/world/terrain.js`). Serve para saber a declividade do lote.
- **Referência do que existe hoje:**
  - `pipeline/city_final.py:274-516` (partidos, testada, recuos, edícula);
  - `pipeline/encaixar_casas_lotes.py` (como o volume residencial é ligado ao lote, filtros de encaixe);
  - `fonte/world/buildings.js` e `fonte/world/building-type.js` (tipologias, paleta, coberturas);
  - `fonte/materials/facades.js` (janelas no shader);
  - `pipeline/portoes.py` e `pipeline/muros.py`.
- **Cadastrados:** o que estiver ligado aos 5 empreendimentos (`plantas_fornecidas/*/unidade.json`, `fonte/listings/identity.js`) e à área protegida em volta deles **não** é trocado. Procure a regra de proteção no código: `exterior-details.js` e o pipeline de exteriores.

## Quais casas entram

1. **Todo lote que tem casa hoje.** É lote com volume residencial (classe 1) cuja tipologia é CASA, SOBRADO ou ANEXO (`building-type.js`): até 8 m de altura, sem nome, fora de cadastro e da área protegida.
2. **Os volumes desse lote saem do mapa.** O índice deles vai na lista `substituidos`, para o renderizador pular, e a casa nova é planejada do zero a partir do **lote**.
   - Os volumes antigos só servem de pista: número de pavimentos, a casa ser térrea ou sobrado, ocupação aproximada.
3. **Volume residencial fora de lote fica como está** e continua sendo desenhado pelo `buildings.js`.

## Referência visual do cliente (08/10)

O cliente mandou uma imagem aérea, a 45°, de duas casas típicas que ele quer ver. É o alvo
de aparência das casas, sobretudo no LOD0 e no LOD1:

- **Casa 1:**
  - térrea, com telhado cerâmico **de quatro águas** cor terracota (laranja-avermelhado), inclinação moderada e beiral visível;
  - paredes brancas ou creme claro;
  - **na frente, um volume branco de laje com platibanda** (garagem ou varanda coberta com laje), mais baixo que a cumeeira, colado ao corpo principal. Essa combinação "corpo de telhado + caixa de laje branca" é muito comum aqui e deve ser um partido frequente;
  - **muro branco contornando o lote todo**, liso e com capa, mais alto nas divisas;
  - palmeira e árvores no quintal, gramado amplo.
- **Casa 2:**
  - térrea **em L ou em várias alas**, com telhados cerâmicos de quatro águas que se encontram em rincões (cor terracota mais escura e marrom);
  - paredes brancas e um trecho de laje plana;
  - muro branco baixo e jardim com árvores.
- **Em geral:**
  - lotes grandes com **muito gramado**, casas térreas de planta composta e telhados terracota de quatro águas;
  - muros brancos e cores claras nas paredes;
  - leitura limpa vista de cima. É exatamente o que o mapa mostra a 45°.

Consequências para as regras e a geometria:
- dar peso alto a: quatro águas, corpo + caixa de laje com platibanda, planta em L com rincões e muro branco contínuo com capa;
- a cor da telha varia entre terracota claro e escuro/marrom, e as paredes ficam majoritariamente claras;
- o quintal é gramado, com árvores e palmeiras (a vegetação vem do mapa, mas o gerador pode deixar pontos de plantio no plano).

## Regras, aplicadas em ordem

Todos os números ficam em `regras/sao-carlos.json`. Os valores abaixo são o ponto de
partida e são todos **"a conferir"** com o Plano Diretor e o Código de Obras de São
Carlos. **Nenhum número de cidade fica escrito no código.**

1. **Lote → moldura local.**
   - **Testada:** a borda do polígono mais próxima de rua (pela fita/vias), com desempate pelo `fa` do volume antigo.
   - **Moldura local:**
     - origem no meio da testada;
     - eixo `u` ao longo da testada, para a direita de quem olha o lote da rua;
     - eixo `v` entrando no lote.
   - Classe por testada: estreito < 7,5 m; padrão < 11,5; largo < 16; grande acima disso.
   - Recusa testada < 3,6 m ou fundo < 8 m.
   - **Lote de esquina** (duas bordas com rua): marcar, porque a lateral voltada para a rua vira fachada.
2. **Recuos.**
   - Frontal: 4,0 m. A garagem coberta leve (pergolado/telha) pode avançar até o alinhamento.
   - Lateral: 1,5 m na face com janela; 0 m na face cega encostada na divisa (geminada). O lado encostado é decidido por regra: lote estreito encosta um lado, o da garagem.
   - Fundo: pelo menos 2,0 m.
   - Taxa de ocupação: alvo de 40 a 60% e teto de 70%. Permeabilidade mínima de 15% (grama ou jardim).
   - Esquina: recuo de 2,0 m na lateral voltada para a rua.
3. **Partido e volumetria em malha estrutural.**
   - Vãos entre pilares de 3,0 a 4,5 m. Corpo principal de 6 a 9 m de largura.
   - Partidos: retangular, em L, em T, garagem lateral, edícula ao fundo (só com fundo ≥ 22 m) e sobrado.
   - **Variação por bairro:** use `loteamento`/`fonte` e o tamanho do lote.
     - Conjunto habitacional (lotes pequenos e iguais): partido repetitivo de duas águas, com pouca variação de cor.
     - Bairro de classe média: mais sobrados e casas em L.
     - Centro antigo: geminada no alinhamento.
   - Alturas:
     - piso 0,15 a 0,30 m acima do terreno na frente;
     - pé-direito de 2,6 a 2,8 m e laje de 0,12 m;
     - respaldo da térrea em 2,9 a 3,2 m e do sobrado em 5,8 a 6,2 m.
   - **Pavimento de cima:** área até a do térreo, apoiado sobre a malha de baixo, com balanço de no máximo 1,2 m.
   - **Declive:** acima de 8% de declividade, embasamento ou arrimo aparente; o piso fica na cota da frente.
4. **Telhado: um por casa.**
   - **Tipos:**
     - quatro águas;
     - duas águas com empena em alvenaria (cumeeira paralela ou perpendicular à rua);
     - platibanda: telhado escondido de fibrocimento a ≤ 10%, com a platibanda pelo menos 0,2 m acima do ponto mais alto dele;
     - laje impermeabilizada com caimento de 1 a 2%;
     - meia-água só em anexo.
   - **Telha cerâmica** de 30 a 35% de inclinação (hoje o mapa usa 72 a 98%, o que dá o aspecto de brinquedo).
   - **Beiral** de 0,5 a 0,8 m, descendo abaixo do respaldo, com testeira (≈ 0,2 m), cumeeira e rufo.
   - **Planta em L ou T:**
     - cada retângulo recebe o seu telhado com o **mesmo beiral e a mesma inclinação**;
     - as águas se cruzam e o teste de profundidade desenha o rincão;
     - o resultado tem que parecer um telhado só: mesma cota de beiral, cumeeiras coerentes, nenhuma água atravessando outra por baixo.
   - **Caixa d'água** de 500 a 1.000 L: sob o telhado (não aparece), exceto em casa de laje (aparece sobre a laje, recuada) ou como torre de caixa.
5. **Aberturas por face e por função.**
   - **Frente:** porta social alinhada ao portão social; janela de sala de 1,5 a 2,0 m × 1,2 m com peitoril de 1,0 a 1,1 m.
   - **Laterais:** só com recuo ≥ 1,5 m (Código Civil, art. 1.301). **Zero janela em face encostada na divisa.**
   - **Fundo:** basculante alto (peitoril de ≈ 1,5 m) de banheiro e cozinha, e porta de serviço.
   - **Posição:**
     - janela a pelo menos 0,6 m do canto e do pilar, dentro do vão estrutural, com verga e contraverga;
     - no sobrado, alinhadas com as de baixo;
     - área de janela por cômodo como parâmetro (≈ 1/6 do piso, a conferir).
   - **Garagem:** portão de garagem de 2,6 a 3,0 m na frente da garagem.
6. **Muros e portões.**
   - **Frente:** mureta de 0,6 a 1,0 m com gradil até 1,8 a 2,0 m, ou muro de 1,8 a 2,2 m.
   - **Portões:**
     - portão de garagem (2,6 a 3,0 m) alinhado à garagem;
     - portão social (0,9 a 1,2 m) alinhado à porta.
     - Isso substitui o lado sorteado por `crc32` em `portoes.py`.
   - **Laterais e fundo:**
     - 2,0 a 2,5 m de altura e ≈ 0,15 m de espessura;
     - pilarete a cada ≈ 3 m e capa no topo;
     - em declive, em degraus.
   - **Piso de entrada:** do portão até a porta, e a rampa de garagem.
7. **Quintal.**
   - Grama e jardim na parte permeável.
   - Piso cimentado ou cerâmico nas áreas de passagem.
   - **Piscina** por regra: lote ≥ 300 m², fundo livre ≥ 8 m e sorteio de ≈ 12%. Piscina de 3×6 a 4×8 m com borda.
8. **Cores e materiais.**
   - Paletas por partido (aproveitar a paleta CASA/SOBRADO de `buildings.js` e os ajustes de cor que já estão lá).
   - Casa, garagem e edícula do mesmo lote compartilham semente, paleta e telha.
   - Esquadrias: alumínio claro ou escuro, ou madeira.
   - Portão: ferro preto, cinza ou branco.

**Determinismo:** a semente é `hash(slug, id estável do lote, versão das regras)`, e cada
etapa tem um fluxo próprio. Assim, mudar a regra do telhado não reembaralha recuos e cores.
Use matemática inteira ou arredondamento fixo (decímetros/centímetros) no plano, para o
mesmo plano sair igual em qualquer máquina.

## O plano binário (`casas/formato.js`)

Um registro por lote, com no máximo ~40 bytes. Tudo que **puder** ser derivado da semente
no navegador (cor exata, posição fina de janela, piscina) é derivado lá. O plano só leva o
que é geometria decidida por regra. Sugestão (ajuste se precisar, documentando no topo do
`formato.js`):

- origem (x, z) em dm, int32 ×2, ou int16 relativo ao tile;
- ângulo da moldura (u16);
- testada e fundo (u16 dm cada);
- os 4 cantos do lote na moldura local (int16 dm ×8; o lote raramente é retângulo perfeito);
- partido, telhado, número de pavimentos, lado encostado, lado da garagem, esquina, tipo de muro da frente, piscina (bits);
- 1 a 3 retângulos (corpo, ala/garagem, edícula) em dm na moldura;
- inclinação, beiral, piso, pé-direito;
- índice de paleta;
- semente (u32).

**Arquivos (`derivados/casas/`):**
- `casas.bin`: cabeçalho, mais registros agrupados por quarteirão (índice do `bl` do city.json) e um índice `[início, quantidade]` por quarteirão;
- `substituidos.bin`: lista de índices de `b` que o renderizador deve pular;
- `qa.json`.

Tamanho alvo: cerca de 65 mil casas × ≤ 40 B ≈ 2,6 MB brutos, bem menos depois de Brotli.

## Geometria (`fonte/casas/geometria.js`)

```js
CasasGeometria.expande(plano, nivel, saida) // nivel 0|1|2; escreve em buffers que crescem
CasasGeometria.criaSaida()                  // { pos: Float32 xyz em metros na moldura do MUNDO (já girado e posto na origem),
                                            //   nor: Int8 xyz normalizado, cor: Uint8 rgb,
                                            //   face: Float32 (u, v) [v = -1 em telhado/laje, como hoje],
                                            //   estilo: Uint16 (tipo, semente 0-255, altura útil dm),
                                            //   janela: Uint8 ×4 (máscara de janelas por face para o shader no LOD1),
                                            //   base: Float32 (x, z) do centro da casa, para o relevo [presetCenter],
                                            //   idx: Uint32 }
```

- **Indexada.** Sem `DoubleSide`: winding consistente, normais para fora. Y = 0 é o terreno na testada; o renderizador soma o relevo.
- **LOD0** (≈ 600 a 1.500 triângulos por casa, perto da câmera):
  - parede com espessura nos vãos;
  - janela com recuo real de 10 a 15 cm, peitoril e moldura, porta, portão de garagem;
  - beiral com testeira, cumeeira e rufo;
  - empena em alvenaria;
  - muro com capa e pilaretes, mureta + gradil (gradil como poucas barras, ou um plano com textura/alfa: escolha o mais barato que leia bem);
  - portões;
  - piso de entrada, grama e piscina;
  - caixa d'água da laje.
- **LOD1** (≈ 40 a 80 triângulos):
  - paredes + telhado correto + beiral, com janelas pintadas no shader e o atributo `janela` dizendo **onde pode** (máscara por face);
  - muro da frente como caixa, quintal como 1 ou 2 polígonos.
- **LOD2** (≈ 12 a 24 triângulos): caixa + telhado em cor média, e o lote como um polígono só.
- **Desempenho:** expandir 1.000 casas em LOD1 em menos de 30 ms no Node (meça); LOD0 de uma casa em menos de 0,2 ms.

## Validação obrigatória (`gerador/casas.mjs` → `qa.json`, mais testes)

**Histogramas e contagens:**
- inclinação do telhado e cota de cumeeira (térrea mediana ≈ 5 a 5,5 m);
- respaldo, taxa de ocupação e permeabilidade;
- recuos frontal, lateral e de fundo;
- partidos por bairro e casas por classe de testada;
- lotes recusados, com o motivo.

**Portões duros** (o gerador falha se não passarem):
- 0 janelas em face a menos de 1,5 m da divisa;
- casa sobre a rua ≤ 0,56% (área de casa sobre o preenchimento de rua, como no QA atual), sem regredir;
- 0 casas fora do próprio lote (tolerância de 0,05 m);
- 0 balanços de sobrado maiores que o máximo;
- toda garagem com portão de garagem à frente;
- todo telhado cerâmico entre 30 e 35%;
- determinismo: duas execuções dão o mesmo SHA-256 do `casas.bin`.

**Testes:**
- formato (codifica → decodifica = igual);
- regras em lotes sintéticos (estreito, padrão, largo, esquina, declive, fundo curto);
- a geometria não gera triângulo degenerado nem normal para dentro;
- contagens de triângulos por LOD dentro da faixa;
- desempenho.

**Vitrine (`medicoes/vitrine.mjs`):**
- 12 casas típicas (uma de cada partido e classe), em LOD0 e LOD1, vista de rua (1,6 m de altura, a 15 m) e vista aérea a 45°;
- um quarteirão inteiro real de São Carlos (escolha um conjunto habitacional e um de classe média) visto de cima a 120 m.
- Luz parecida com a do mapa: hemisférica + sol direcional, ACES, `ColorManagement` desligado. Ver `fonte/app.js:271-349`.
- Grava PNG, para revisão visual.

## Restrições

- **Não editar nada fora destes caminhos.** Em especial `v1.5/renderizador-v16-moveis/**`, os arquivos de `fonte/` fora de `fonte/casas/`, e qualquer coisa fora de `v1.5/mapa-versao-melhorada-07-10/`.
- Não fazer commit.
- Derivados acima de 1 MiB e imagens ficam fora do git (anotar no `.gitignore` da pasta).
- Python 3.11+ e Node 22 estão instalados. `three@0.168.0` está em `../miniaturas/versao-melhorada-07-10/node_modules/three`, e o Playwright em `../miniaturas/versao-melhorada-07-10/node_modules/playwright-core`, com Chromium em `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` e as flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Se precisar de dependências, crie um `package.json` nesta pasta (`v1.5/mapa-versao-melhorada-07-10/`) e rode `npm i` aqui.
