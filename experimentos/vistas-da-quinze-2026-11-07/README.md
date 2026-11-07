# Vistas da Quinze (Grupo Plano, São Carlos): quarto empreendimento no molde do Laranjeiras

Branch `feat/vistas-da-quinze`, saída de `feat/containers-mooca` (que já tem o Laranjeiras inteiro e o
desempenho do Codex). Meta do usuário (07/11): "o santo graal da qualidade e otimização", ou seja, juntar
tudo o que cada empreendimento anterior aprendeu e não deixar nenhum desses ganhos de fora.

## Fontes

- `plantas_fornecidas/vistas-da-quinze/anexos/`: as 10 imagens coladas na conversa do Codex de 06/11
  (6 plantas T01..T06 e 4 da implantação). Saem do Temp e ficam aqui.
- `plantas_fornecidas/vistas-da-quinze/site/`: o que está público em grupoplano.eng.br (6 plantas, 2
  implantações e 16 renders, até 4000 × 5000 px). Os renders são a referência de aparência.
- `experimentos/vistas-da-quinze/` (Codex, sem commit): `plantas.json` (paredes, vãos e zonas das 6
  plantas, em px) e `gerar.py` (IFC). O traçado de lá é o ponto de partida, não a verdade.

Dados que temos:
- Endereço: R. Major Manoel Antônio de Mattos, 1850, alto da Vila Nery, junto da XV de Novembro.
  O pino do Google no site oficial fica em −22,01235, −47,88188. **É São Carlos**, a cidade do mapa 3D.
- Áreas: 44,79 m² no 2 dormitórios com suíte sem terraço (anúncio); 61,59 a 76,16 m² nos com terraço
  (Contato Imóveis). O resto vem das imagens.
- **É uma torre em L de 20 andares**, não um prédio baixo (o `Implantacao.ifc` do Codex está errado nisso).
  A perspectiva colorida dos anexos (`anexos/c5be99a0…png`) numera as unidades: os finais vão de 01 a 18
  (3º andar: 301..318, 20º: 2001..2014), e as duas alas sobem em degraus a partir do 9º (lado sul) e do 15º
  (lado leste). As cores marcam a tipologia de cada unidade: vermelho é o tipo sem terraço, e verde, roxo,
  laranja e amarelo são as com terraço nos degraus. Esse desenho é o cadastro unidade → tipologia.
- Ruas: XV de Novembro ao norte e Major Manoel Antônio de Mattos a oeste (esquina no canto NO). As fotos do
  drone (`anexos/5e43…`, `anexos/7d1a…`) mostram a obra com a estrutura pronta e a vizinhança.
- Embasamento com lazer (piscina, spa, kids, gourmet, academia) na laje sobre a garagem. Fachada branca, guarda-corpo de réguas horizontais brancas, madeira no rodapé dos
  terraços. Obra em 81,5% (maio/2026).

## Ordem (a mesma do Laranjeiras e do Mooca)

| # | Etapa | O que sai | Ganhos que entram aqui |
|---|---|---|---|
| 1 | Plantas | `interiores/T0N/planta.json` → construtor do painel, conferência PASS | escala pela área anunciada; móveis do catálogo; `h` dos móveis; piso pelo campo `piso` |
| 2 | Implantação | `implantacao/` em metros + lat/lon, conferência sobre a imagem | rumo pela rua no OSM; tipologia por posição no L |
| 3 | Modelo externo | `modelo/modelar_*.py` (Blender) → `modelo.json` | fachada pelas plantas; guarda-corpo de réguas; degraus; lazer; árvores de folha; texturas CC0 |
| 4 | Luz do exterior + cena | atlas RGBM + `scene.json.gz` | scripts do LIV com `--model/--out`, OptiX |
| 5 | Cadastro + página | `assets/unidades.json`, `site/maquete-*.html` | seletor por torre, finais, horário solar com a lat/lon real |
| 6 | Interiores | pacote `native-factories` | OLHAR/REBOCO, `finishIds`, corredor atrás da porta, plantas espelhadas |
| 7 | Luz gravada por hora | 29 chaves por tipologia (~30 min cada) | sondas abaixo do forro, corte do RGBM, folha da porta pela dobradiça, navegador fechado |
| 8 | Mapa | mapa 2D do LIV com o prédio em 3D | POIs do OSM/Overture |
| 9 | Peso e celular | pacote minificado, medido com brotli | PageSpeed, prévia leve, textura adiada |
| 10 | Archicad | o mesmo `planta.json` vira IFC e entra no Archicad pela conexão (Tapir), sem o seletor de arquivo | ver a conversa do Codex de 06/11 |

## 1. Plantas (feito)

```
node experimentos/vistas-da-quinze-2026-11-07/interiores/construir.ts T01   # ... T06
```

`construir.ts` e `exportar.py` são os do Mooca, que suportam `h` nos móveis e polígono. As 6 saem `PASS`
(`T0N/conferencia.jpg`). As imagens são pequenas (~45 px/m), então os eixos ficam a ±5 cm.

| Tipo | O que é | Área (m²) | Cômodos / portas / janelas / móveis |
|---|---|---|---|
| T01 | 2 dorm. (suíte), sem terraço | 44,79 (anúncio, calibra a escala) | 5 / 5 / 3 / 24 |
| T02 | 1 dorm., sem terraço | 31,5 | 3 / 3 / 2 / 19 |
| T03 | 2 dorm. (suíte com closet), terraço lateral | 62,3 (anúncio: 61,59) | 6 / 6 / 5 / 27 |
| T04 | 2 dorm. + escritório, terraço lateral | 77,6 (maior anunciada: 76,16) | 7 / 7 / 6 / 35 |
| T05 | 2 dorm. (suíte com closet), terraço lateral | 62,4 | 6 / 6 / 5 / 28 |
| T06 | o T01 com terraço na frente | 44,79 + terraço | 6 / 6 / 4 / 28 |

- **Escala:** os 44,79 m² do anúncio são o T01 sem terraço. A mesma escala (21,95 mm/px) dá 62,3 m² no
  T03 com terraço e 77,6 m² no T04, o que confere com a faixa de 61,59 a 76,16 m² anunciada. Então os
  anúncios contam o terraço junto.
- **T06** vem em outra escala (o mesmo corpo é 9-10% maior na imagem) e é calibrado como T01 + terraço.
- O id do construtor tem que ser minúsculo (`vistas-da-quinze-t01`): com `T` maiúsculo o validador M1-0
  recusa com `INVALID_STRUCTURE /id`.
- **Rotação dos móveis no construtor:** 0 = fundo para cima na imagem, 90 = fundo à esquerda, 180 = embaixo,
  270 = à direita (a cabeceira da cama é o "fundo").
- **Faltam no catálogo:** banheira de hidromassagem, churrasqueira, vasos de planta e pufe (virou poltrona).
  Entram na etapa dos interiores.

## 2. Implantação (feito)

```
python experimentos/vistas-da-quinze-2026-11-07/implantacao/montar.py
```

`implantacao.json` guarda as hipóteses. `montar.py` grava `implantacao-m.json` (258 apartamentos com caixa
em metros, terraço e coordenada geográfica), `conferencia.jpg` (3º andar sobre o pavimento do lazer) e
`fachadas.jpg` (as faces do pátio andar por andar, na cor da tipologia).

- **Lugar:** a origem é o cruzamento das ruas Quinze de Novembro e Major Manoel Antônio de Mattos no OSM
  (−22,012203, −47,880943). As duas correm quase exatamente leste-oeste e norte-sul. O pino do Google no
  site oficial cai uma quadra a oeste. O lote (62 × 48 m) fica a sudeste da esquina, e o L ocupa as bordas
  sul e leste, com o pátio da piscina virado para a esquina.
- **Perspectiva numerada:** 18 finais por andar, do 3º ao 20º. A ala sul tem os finais 01..10 (ímpares no
  pátio, pares fora, 01/02 junto do núcleo). A ala leste tem os 11..18.
- **A ala leste é de T02 (7,0 m):** na imagem do pavimento ela tem ~40 m, o que fecha com 4 apartamentos de
  7,0 m e não com os 8,4 m da T01. Isso também responde onde fica a planta de 1 dormitório.
- **Degraus:** a partir do 9º andar na ala sul e do 15º na leste, cada andar recua a ponta em 1/3 de
  apartamento (2,8 e 2,33 m), e o recuo vira o terraço do andar de cima. O par da ponta tem um corpo de
  4/3, 3/3 ou 2/3 de apartamento, nessa ordem a cada 3 andares, e isso reproduz as cores da perspectiva
  número por número (909 verde, 1007 roxo, 1107 laranja, ..., 1913 roxo, 2013 laranja).
- **Tipologia da ponta (hipótese):** roxo = corpo de 4/3 = T04; laranja = 3/3 = T03 no pátio e T05 fora;
  verde = 2/3 = T06. O amarelo (o apartamento antes do degrau) ficou com a planta da ala.
- **Total:** 258 apartamentos: 104 T01, 118 T02, 12 T04, 12 T06, 6 T03 e 6 T05.
- **Limites:** na conferência, a ala leste passa ~1,7 m da ponta norte desenhada. O pavimento do lazer
  tem um apartamento a mais no canto, e esse não aparece na numeração. O embasamento foi suposto com 2
  pavimentos (6,4 m).

## 3. Modelo externo (feito)

```
& 'C:\Program Files (x86)\Steam\steamapps\common\Blenderlender.exe' --background --factory-startup --python-exit-code 1 --python experimentos/vistas-da-quinze-2026-11-07/modelo/modelar_vistas.py
```

Roda em 30 s. Grava `modelo.json`, `vistas.glb` e `vistas.blend`, que ficam fora do git, e as prévias
`preview-aerea.jpg`, `preview-patio.jpg` e `preview-terraco.jpg`, nas câmeras dos renders `galeria-00`,
`galeria-15` e `galeria-01` do site.

- **Andar por andar:** cada andar tem geometria própria por causa dos degraus. As duas alas são as
  "torres" 0 (sul, com o núcleo) e 1 (leste), e o andar 3 é o `floor` 0.
- **Fachada:**
  - as janelas saem da frente de cada planta (T01..T06), espelhadas a cada apartamento como no render;
  - cada janela tem esquadria branca e uma condensadora preta ao lado;
  - a testa da ala tem janela; com terraço, tem porta de correr.
- **Cores dos renders:** reboco branco, faixas grafite e quadros fendi com moldura escura. Os painéis são
  a cor da própria parede no trecho, e não uma placa na frente: como placa, eles tapavam as janelas.
- **Terraços dos degraus:** ficam sobre a laje do andar de baixo. Essa laje vai até a ponta de baixo, porque
  é o teto dele. Cada terraço tem guarda-corpo de réguas brancas com rodapé de madeira, spa, vaso com árvore
  e uma mureta bege de 15 cm no eixo do corredor.
- **Embasamento:** 3 andares de garagem (9,0 m), com as faixas escuras nas fachadas das ruas e a
  platibanda branca.
- **Lazer:** piscina com deck, academia e espaço gourmet com telhado escuro, playground, a praça com 3
  árvores de folha e a pista "RUN FAST".
- **Implantação revista:** comparando com `galeria-15`, o pátio estava longo demais. O lote passou a
  57 × 42 m, com a quina da torre em (62, 47).

## 4. Luz do exterior (feito)

```
python v1.5/miniaturas/liv-ipanema/preparar_luz.py --model experimentos/vistas-da-quinze-2026-11-07/modelo/modelo.json --out experimentos/vistas-da-quinze-2026-11-07/modelo/luz --size 4096
& 'C:\Program Files (x86)\Steam\steamapps\common\Blenderlender.exe' --background --factory-startup --python-exit-code 1 --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out experimentos/vistas-da-quinze-2026-11-07/modelo/luz --samples 64 --sun=-45,110,-60
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out experimentos/vistas-da-quinze-2026-11-07/modelo/luz --output-guard 4
python experimentos/vistas-da-quinze-2026-11-07/modelo/exportar_cena.py
```

- **Números:** 106 mil triângulos com luz gravada num atlas de 4096 px, com 82% de aproveitamento.
  A gravação leva 2 min (OptiX) e a limpeza 27 s, sem nenhum pixel acima do teto do RGBM.
- **Sol:** o `bake_luz.py` do LIV gravava com o sol fixo do sul, em `(-18, 110, 55)`, o lado bom do LIV.
  Aqui o pátio olha para o norte e para o oeste, então ficava na sombra. A opção nova `--sun` (posição na
  web) mantém o padrão do LIV, e o Vistas grava com o sol de noroeste (`-45,110,-60`, à tarde). Por isso a
  página abre às 15h.
- **Peso:** a cena tem 2,7 MB e o atlas 10,5 MB (gzip). Isso fica para a etapa 9.

## 5. Cena, cadastro e página (feito)

- **Cena:** `modelo/exportar_cena.py` é a cópia do Mooca com o cadastro das duas alas.
  - A cena junta numa malha só, por material e ala, os grupos de uma instância só (o vidro e a água do spa de
    cada andar). Isso baixa de 120 para 50 chamadas de desenho.
  - As câmeras ficam do lado do pátio (noroeste) e o raio sai da torre, não do terreno.
- **Cadastro** (`assets/unidades.json`, schema `vistas-da-quinze-units-v1`):
  - 258 apartamentos, cada ala é uma "torre" do seletor;
  - `floorIndex` é o andar real (3..20), num prédio de 21 pavimentos (0..2 são as garagens). Com isso a
    conta de altura do LIV (andar × altura/21) bate com o prédio a menos de 20 cm;
  - o número comercial é andar + final, como na perspectiva.
- **Site** (`site/`) é a cópia do **Laranjeiras**, não a do Mooca: a do Laranjeiras é a mais nova na parte
  de venda (vagas por apartamento, estoque simulado), e a do Mooca foi feita para aluguel. A página é
  `site/maquete-vistas.html` (servidor `vistas`, porta 8811):
  <http://localhost:8811/experimentos/vistas-da-quinze-2026-11-07/site/maquete-vistas.html>
  - `tipologias.js` traz as 6 plantas, e as plantas 2D saem de `interiores/gerar_plantas2d.py`, com a
    imagem pública ampliada 3x.
  - `catalogo-unidades.js` escreve "Nº andar" (0..2 = garagem); `horario-solar.js` tem a lat/lon da
    esquina, yaw 0 e finais até 18.
  - Comercial ausente e estoque desativado; `vagas.json` não existe (a página ignora o 404).
  - **Clique:** o seletor do LIV acha primeiro a caixa da ala, que acima dos degraus é ar. No Vistas
    (`picking.js`), o escolhido é o primeiro apartamento que o raio atravessa.
- **Testado no navegador:** a página abre do lado do pátio. Clicar na face do pátio seleciona o apartamento
  (por exemplo "Ala sul · 14º andar · final 05", a T03 da ponta), e "Ver planta" abre a T03 com o terraço.

## 6. Interiores (feito, luz dinâmica)

```
python experimentos/vistas-da-quinze-2026-11-07/interiores/gerar_pacote.py
```

- É a cópia do gerador do Mooca para as 6 plantas, no modo `native-factories` do LIV. A pasta e o id do
  site são minúsculos (`t01`..`t06`), como no cadastro.
- **Piso:** "laminado de madeira e piso frio" (anúncio). Fica madeira nos quartos e no escritório, e
  porcelanato na sala/cozinha, nos banhos e no terraço (`exportar.py`). Do Mooca vieram o campo `piso`
  em `interior-navigation.js` e os `finishIds` em `interior-renderer.js` e `interior-melhorias.js`.
  A cara do caderno do Mooca não veio (reboco quente, armário branco, cama colorida): o Vistas tem parede
  clara neutra, como nos renders.
- **Terraço descoberto** (`abrirTerracos` em `interior-renderer.js`):
  - o motor do LIV põe um forro só para o apartamento inteiro, e cada terraço virava um cômodo fechado
    com uma janela em cima da mureta;
  - agora a borda de fora do terraço é um vão que vai do peitoril de 1,05 m até o forro, ocupando a borda
    inteira;
  - depois da montagem e antes da cópia que vai para a luz gravada, o site apaga os triângulos da casa
    acima de 1,12 m dentro do terraço (forro, rodateto, o vão e o teto oculto da sombra do sol, que usa a
    geometria do forro), menos no lado da porta de correr;
  - o plafon do terraço some.
  
  Resultado: céu e sol entram, com 292 a 298 triângulos a menos por planta.
- **Spa** (`spaNosTerracos`): a banheira de hidromassagem (casco branco de 1,9 m, água e apoios
  grafite) fica no fundo do terraço, longe da porta, como nas plantas. Ela não existe no catálogo.
- **Testado:** as 6 plantas abrem no Tour sem erro, com 5 a 8 móveis trocados pelos aprovados do LIV.
  Na T03, dá para entrar pela porta de correr num terraço aberto com o spa.

Commit ao fim de cada etapa. Nada publicado sem o OK do usuário (e, sendo um lançamento real de outra
incorporadora, sem o OK do cliente).
