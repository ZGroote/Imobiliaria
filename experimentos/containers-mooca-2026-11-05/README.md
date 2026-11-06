# Moradia estudantil em containers (Mooca) — terceiro empreendimento no molde do Laranjeiras

Branch `feat/containers-mooca`. Fonte única: o caderno do TCC de Tamires Ruffino (Escola da Cidade, 2025),
em `plantas_fornecidas/containers-mooca/` (ficha, páginas e o que falta no `LEIA-ME.md`). O caderno só
autoriza o uso para estudo e pesquisa, com a fonte citada: publicar exige o OK da autora.

Ordem, a mesma do Laranjeiras: plantas → implantação → modelo externo → luz do exterior + visualizador →
cadastro dos dormitórios → página → interiores e luz por hora → mapa 2D da Mooca → pacote.

## Plantas (feito)

Os cinco dormitórios do caderno foram traçados pela API real do construtor de plantas do painel.
`interiores/construir.ts` e `interiores/exportar.py` são cópias dos do Laranjeiras; os pontos ficam em
`interiores/<tipo>/planta.json`, em pixels da imagem original do caderno.

```
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual-pne
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts quadruplo
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal-bebe
```

Os cinco saem `PASS` em `conferencia.jpg`/`conferencia.json`: todo móvel fica dentro de um cômodo, e
nenhum se sobrepõe a outro.

| Tipo | Container | Área | Aluguel | Cômodos / portas / janelas / móveis |
|---|---|---|---|---|
| individual | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 8 |
| individual-pne | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 6 |
| casal | 6 m | 14,8 m² | R$ 800 | 2 / 2 / 2 / 8 |
| quadruplo | 12 m | 29,7 m² | R$ 1.000 | 2 / 2 / 2 / 10 |
| casal-bebe | 12 m | 29,7 m² | R$ 900 | 3 / 3 / 2 / 9 |

Como cada coisa foi aproximada:

- **Escala:** as plantas são 1:50, mas sem cotas. O contorno externo do container foi igualado à área
  do container marítimo: 6,058 × 2,438 m = 14,8 m² e 12,192 × 2,438 m = 29,7 m². São os dois números
  do caderno.
- **Pé-direito:** 2,35 m. O corte dá 2,69 m de piso a piso (container de 2,59 m mais a laje).
- **Catálogo:** o construtor não tem beliche, banheira nem berço. O beliche virou cama de solteiro (a
  ficha diz 4 moradores), a banheira virou box e o berço virou uma cama de solteiro pequena.
- **Quádruplo:** quarto e estudo são um cômodo só, porque a divisória do meio não chega à bancada.
- **Esquadrias:** lidas no desenho quando aparecem (portas do PNE, do casal e dos 12 m, vidros do lado
  comprido). No individual, a porta e a janela são aproximadas.
- **Prédio declarado:** 45 × 40 m e 2 pavimentos, que é a pegada do conjunto. O pipeline exige um prédio,
  e o container não serve como prédio.
- O desenho preto da folha dos dormitórios 6 m (dois vasos, quatro lavatórios, copa e dois armários)
  não é um dos cinco tipos do caderno e ficou de fora.

## Implantação (feito)

`implantacao/leitura_da_planta.py` registra o que foi lido nas duas plantas gerais 1:200, gravando
`implantacao.json`. Depois, `implantacao/montar.py` assenta cada container com a medida real, centrado
onde o caderno o desenha, e grava `implantacao-m.json` (metros + coordenadas geográficas) e
`conferencia.jpg`. O térreo aparece em azul, o 1º pavimento em vermelho e as superfícies em cor clara.

```
python experimentos/containers-mooca-2026-11-05/implantacao/montar.py
```

- **Escala:** 18,9 px/m na `planta-terreo.png`, medida pelos próprios containers. Com ela, o lote dá
  ~2.150 m² (o caderno diz 2.179,7 m²), e o trecho diagonal da Rua João Antônio de Oliveira mede 58 m
  (61 m no OSM).
- **Rumo:** norte para cima (seta da p. 90). A Rua Guaratinguetá corre leste-oeste na planta e no OSM.
- **Âncora:** esquina das ruas Guaratinguetá e João Antônio de Oliveira (−23,5581268, −46,6057803), no
  cruzamento das duas faixas hachuradas da planta. O conjunto fica 37 a 76 m ao norte dela. O bloco
  noroeste fica 7 m a leste da rua, do lado de dentro do lote.
- **1º pavimento:** a imagem dele está deslocada (58, −58) px em relação ao térreo. O deslocamento foi
  achado por correlação das linhas, e a leitura já foi feita com as duas plantas sobrepostas.
- **Conjunto:** 30 containers, sendo 20 dormitórios e 10 áreas comuns, numa pegada de 44 × 39 m.
  - Térreo: 6 individuais, 2 PNE e as áreas comuns (banheiros coletivos, refeitório, cozinha,
    convivência, administração, lavanderia e estudos).
  - 1º pavimento: 3 quádruplos, 1 casal com bebê, 2 casais e 6 individuais. Os 12 m passam por cima
    dos 6 m do térreo, como no caderno.
  - Decks de madeira, passarelas de grade, pergolados, escadas e pátio verde.
- **Tipos aproximados:** o caderno não diz qual dormitório 6 m é de qual tipo. Os 2 PNE ficaram no
  térreo, perto da entrada sul, e os 2 casais no bloco noroeste de cima. Para os 12 m, a proporção 3:1
  entre quádruplos e casal com bebê é a do diagrama da p. 77.
- **Ficaram de fora:** o volume da escada oeste (7,3 m, que não é container) virou passarela.

## Modelo externo (feito)

`modelo/modelar_containers.py` monta o conjunto no Blender com as ferramentas do LIV
(`v1.5/miniaturas/blender_maquete_base` + árvores de `liv-ipanema/modelar_implantacao`) e exporta
`modelo.json` + `containers.glb` (fora do git, regeneráveis).

```
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python experimentos/containers-mooca-2026-11-05/modelo/modelar_containers.py
```

- Cada container tem a medida real (6,058 ou 12,192 × 2,438 × 2,591 m), com chapa corrugada (passo de
  30 cm), quadro e colunas de canto.
- Os dormitórios têm porta e vidro nos dois lados compridos. As áreas comuns têm uma faixa de vidro
  maior. A posição exata das esquadrias de cada container não está no caderno.
- **Cores:** dormitório em chapa branca e área comum em azul "Oceano Pacífico" (Suvinil, aproximado
  pelos renders: a amostra da p. 79 é de madeira).
- Decks de madeira, passarelas de grade com guarda-corpo e pilares, terraço sobre o refeitório coberto,
  pergolados, escadas de 15 degraus até +2,69 e 5 árvores no pátio.
- O conjunto fica centrado na origem da cena; `metadata.origemM` guarda o deslocamento até a esquina.
- `preview-aerea.jpg` e `preview-patio.jpg` são renders de conferência (Cycles, 32 amostras).
- **Pátio** (planta do térreo e render 7 do caderno):
  - caminho de concreto em L entre os gramados;
  - banco sinuoso de 11 pufes redondos de concreto;
  - 3 mesas de piquenique, nos retângulos brancos da planta;
  - 5 postes de 4,5 m com globo, na beira do caminho.

  As posições estão na mesma leitura ampliada da implantação.
- **Árvores e texturas** (para chegar perto dos renders do caderno sem sair do tempo real):
  - As árvores do pátio têm 8 a 10 m, com tronco, 5 galhos e uma copa de 230 cartões com a textura de um
    galho de folhas (`texturas/folhas.webp`). Elas ficam fora da luz gravada e são iluminadas em tempo
    real, com sombra.
  - Grama, caminho, calçada e deck têm textura de cor e de relevo (`texturas/`, CC0 do ambientCG; ver o
    `LEIA-ME.md` de lá). São 330 KB no total.

## Luz do exterior e cena (feito)

Os scripts de luz do LIV rodam sem mudança sobre o `modelo.json` dos containers (atlas de 2048 px:
o conjunto é pequeno, 17.588 triângulos com luz gravada):

```
python v1.5/miniaturas/liv-ipanema/preparar_luz.py --model experimentos/containers-mooca-2026-11-05/modelo/modelo.json --out experimentos/containers-mooca-2026-11-05/modelo/luz --size 2048
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out experimentos/containers-mooca-2026-11-05/modelo/luz --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out experimentos/containers-mooca-2026-11-05/modelo/luz --output-guard 4
python experimentos/containers-mooca-2026-11-05/modelo/exportar_cena.py
```

O bake leva 16 s (OptiX, GTX 1650), e o denoise 7 s. `exportar_cena.py` é a cópia do Laranjeiras com
outro cadastro: `assets/unidades.json` (schema `containers-mooca-units-v1`) tem 20 dormitórios, um por
container, com a caixa de clique do container, o tipo, a área e o aluguel da p. 41. O conjunto é uma
"torre" só (`conjunto`), porque o seletor do LIV agrupa por torre. O pavimento é o nível do container
(0 ou 1), e o "final" é o número do dormitório (01..20). A cena tem 0,5 MB e o atlas 3,3 MB (gzip).

## Página (feito: maquete + planta 2D)

`site/` é a cópia do código do site do Laranjeiras (só os arquivos versionados, sem interiores), e a
página é `site/maquete-containers.html` (servidor `mapa`, porta 8765, raiz do repositório):
<http://localhost:8765/experimentos/containers-mooca-2026-11-05/site/maquete-containers.html>

O que mudou em relação ao Laranjeiras:
- `tipologias.js`: os 5 tipos de dormitório. As plantas 2D vêm de `interiores/gerar_plantas2d.py`,
  que recorta o container da folha do caderno e põe a entrada na porta do contorno externo.
- `unidades.js`: schema `containers-mooca-units-v1` (20 dormitórios, final de 2 dígitos, 5 tipos).
  `test_cadastro.mjs` confere 8 + 12, os tipos, a área e se os containers do mesmo nível se cruzam.
- **Clique:** o seletor do LIV acha primeiro a "torre" atingida e depois a unidade dentro dela. Por
  isso cada container é uma torre (30). Os 10 de área comum não têm unidade e só barram o clique.
- `horario-solar.js`: latitude/longitude da Mooca, `buildingYaw` 0 (a planta tem o norte para cima),
  finais até 99.
- **Rótulos:** "Dormitório 12 · Quádruplo · 1º pavimento". O preço vira "aluguel de R$ 1.000,00/mês
  (proposta do caderno)". O botão "← Prédio" virou "← Conjunto". Os textos do cabeçalho são os do
  caderno, com a autora e a escola.
- "Ver em 3D", "Entrar" e "Conhecer a região" funcionam desde as etapas de interiores e de mapa
  (abaixo).

## Interiores (Planta 3D e Tour, luz dinâmica)

```
python experimentos/containers-mooca-2026-11-05/interiores/gerar_pacote.py
```

É a cópia do `gerar_pacote.py` do Laranjeiras para os 5 dormitórios, no modo `native-factories` do LIV
(luz dinâmica). Os recursos compartilhados do LIV são copiados sem alteração e conferidos pelo hash.

No site:
- `interior-renderer.js` aceita os 5 tipos no lugar de canto/meio.
- **Sombra dos vizinhos:** `viewer.js` passa ao interior só os 8 containers mais perto (`towerOccluders`).
  O interior aceita no máximo 8, e são 29 vizinhos.

Testado no navegador: no dormitório 12 (quádruplo), a Planta 3D abre com paredes inteiras e baixas, e o
Tour começa na porta. Dá para ver a copa, a geladeira, a bancada de estudo junto do vidro e os armários.

Ficou para ajustar: o piso sai porcelanato (o caderno pede madeira tauari), e o armário aprovado do LIV
fica mais alto que o pé-direito de 2,35 m do container.

## Luz por hora dos interiores (feito)

```
node experimentos/containers-mooca-2026-11-05/interiores/luz/chaves.mjs
bash experimentos/containers-mooca-2026-11-05/interiores/luz/gravar_todos.sh [tipos...]
```

São os scripts do Laranjeiras com a lista dos 7 tipos (5 dormitórios + refeitório e convivência): 28 horas por tipo (7 horários × 4 fachadas) e mais
a noite, com cerca de 30 min de Blender por tipo. Os atlas ficam em
`site/interiores/<tipo>/luz-horario/` (fora do git, ~45 MB por tipo). O catálogo está em `frozen-source`.

Diferenças em relação ao Laranjeiras:
- **Porta de entrada:** o bake achava a folha pelo número do material (`m3`). No quádruplo e no casal com
  bebê há um material a menos antes da porta, então agora `leaf_material` acha a folha pela cor junto à
  dobradiça. Ele também gira só a peça presa à dobradiça, porque no casal com bebê o batente do banho
  fica a 0,7 m e a regra do LIV (tudo a até 0,8 m) o girava junto.
- **Teto do RGBM:** às 6h o sol entra rasante e deixa de 37 a 134 texels (de ~1,6 milhão) acima de 16.
  O empacotador corta esses pixels no teto e escreve `RGBM_CORTE`; se passarem de 1000, ele recusa.
  A convivência, com a janela para o oeste, chega a 478 às 16h.
- **Navegador fechado:** um Tour 3D aberto disputa a placa de vídeo e cada chave sobe de 75 s para 276 s.
- **Tapete:** a auditoria do atlas do LIV exige um tapete por planta, e o `escrever_plantas.py` põe um.

Testado no navegador: os 5 tipos abrem no Tour, cada um com a luz da própria fachada às 10h, e o
console fica sem erro.

## Mapa do entorno (feito)

```
python experimentos/containers-mooca-2026-11-05/mapa/preparar_mapa.py [--baixar]
```

É uma cópia do runtime do mapa 2D do LIV, com o empreendimento padrão e os textos trocados, e o LIV e o
Laranjeiras ficam como estão. São 6.316 estabelecimentos do OpenStreetMap num raio de 5 km. O modelo fica
no centro do conjunto, com o norte para cima como na planta do caderno, e aparece sobre o terreno da
esquina usada como âncora.

## Acabamentos do caderno (piso, armário)

- **Piso de madeira tauari:** o `exportar.py` marca `piso: "madeira"` em todo cômodo que não é banho.
  O LIV decide o piso pelo nome do cômodo ("Suíte", "Dormitório", "Sala", "Circulação"), então
  "Quarto e estudo" e "Quarto" saíam com porcelanato. A cópia de `site/interior-navigation.js` agora
  segue o campo `piso` quando ele existe. A textura é a madeira aprovada do LIV (`web-wood-floor`), e a cor
  da planta (`piso_madeira`) foi para #C9A57B, mais clara, como o tauari.
- **Armário:** o guarda-roupa paramétrico tinha a altura do pé-direito (2,35 m) contada da laje e, com o
  piso, furava o forro em 3 cm. A planta agora pode dar a altura do móvel (`h`, lida pelo `construir.ts`),
  e os guarda-roupas ficam com 2,30 m.
- **Acabamento pelo número do material:** o LIV troca parede e pisos pelos ids fixos `m0`/`m1`/`m2`. Numa
  fonte congelada os ids pulam o piso que não existe, e as áreas comuns (só madeira) recebiam porcelanato.
  `finishIds` no `interior-renderer.js` calcula os ids de verdade.

## Áreas comuns (refeitório e convivência)

Desenhadas da folha de áreas comuns do caderno (`areas-comuns-b.png`) e tratadas como mais 2 tipos do
interior, com a luz por hora gravada. No cadastro entram como os containers c02 (refeitório) e c04
(convivência), com tipologia "Área comum" e "área comum dos moradores" no lugar do aluguel.
O catálogo não tem mesa redonda nem pufe: as mesas de 6 viraram mesas de 4 e os pufes, poltronas.
