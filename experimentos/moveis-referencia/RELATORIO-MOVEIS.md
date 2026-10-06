# Móveis no nível da cama: 3 peças, peso medido, escala para a casa

06/10/2026. Pergunta: com cortina, tapete, armário, guarda-roupa... no nível de qualidade da cama, quanto
pesa a casa? Em vez de estimar com os móveis atuais do Cedros (que não servem de régua), fiz 3 peças
representativas — uma de cada tipo que pesa diferente — contra foto, e medi o peso real no navegador.

Painel: `painel_3_pecas.webp` (foto | Cycles | navegador).

## 1. Parecido com a foto?

Regra: print da criação contra a referência, refazer até chegar (≤ 3 rodadas sem convergir = parar).
Erro = diferença média de luminância por região da peça (`compara.py`, região quase preta usa diferença
absoluta, não razão).

| peça | tipo | rodadas | foto × Cycles | Cycles × navegador |
|---|---|---|---|---|
| cozinha compacta 2,07 m (adega, ripado) | marcenaria | 7 | 5,5 % | ~10 % |
| geladeira French door inox preto | metal | 6 | 15,8 % (quase tudo preto) | 13,6 % |
| sofá 3 lugares "nuvem" | estofado | 7 | 7,4 % | ~10 % |

O sofá **ficou estacionado**: cor e proporção bateram, mas o braço em voluta com vivo não chegou igual à
foto. Ele já cumpriu o papel de medir estofado; o próximo sofá deve ser de braço reto (mais comum).

## 2. Como (efeito → técnica → por quê)

- **Câmera da foto**: nivelada + shift (foto de produto). Cozinha: mínimos quadrados com 6 cantos, mas a
  foto sozinha é degenerada (rms 0,5 px com largura de 1,9 a 2,2 m) — a medida de catálogo (207,4 ×
  193,2) ancora a escala. Geladeira: frente ortográfica, 292 px/m bate nos dois eixos com 83,6 × 186,4.
  Sofá: sem catálogo; largura 2,50 + duas linhas da foto dão altura 0,85 e distância 4 m.
- **Medidas internas** (gaveta, porta, puxador): perfil de luminância ao longo de uma linha 3D na foto
  (`perfil.py`, `bordas.py`). Ler grade a olho errou a gaveta em 5 cm; o perfil acha a fresta.
- **Madeira, linho, inox escovado**: textura procedural que repete sem emenda (ruído filtrado na FFT é
  periódico por construção), a MESMA imagem no Cycles e no navegador. Cor por *tinta* (um linho serve
  para várias cores).
- **Grafite fosco**: o Standard do three fixa 4 % de especular; a porta espelhava a luz da janela e saía
  cinza-claro. Especular baixo → `MeshPhysicalMaterial.specularIntensity`.
- **Luz da foto de produto**: ablação (desligar uma luz por vez, medir frente e lateral) e resolver o
  peso de cada luz pro alvo da foto. Foto de catálogo é CGI com curva sRGB: render em Standard, não AgX
  (o AgX levanta o escuro).
- **Metal**: não tem cor própria, é o reflexo do estúdio. O exportador gera um **panorama 360°** do
  estúdio visto do centro da peça (float16) e o navegador reflete o MESMO ambiente.
- **Estofado**: caixa de pano inflada por pressão (`kit.estofado`) — aresta puxa, canto vira ponta, ruga
  nasce na costura. Rolo do braço: tubo com UV em arco de verdade (raio cheio até a ponta espremia o
  linho em estrela).
- **Navegador**: geometria decimada até uma meta de triângulos; o detalhe volta como relevo assado da
  malha alta. Três armadilhas resolvidas:
  1. bake com todas as peças selecionadas: o raio da almofada acertava o encosto → bake **por peça**;
  2. malha de bake em "sopa" de triângulos: tangente por triângulo e relevo facetado → **solda** por posição;
  3. o three monta a base tangente por triângulo → exportar a **tangente MikkTSpace** do Blender.
- **Geometria formato 2**: vértice na ordem da 1ª aparição, 12 bits, diferença do anterior, índice em
  zigzag. Mesma imagem (erro idêntico ao formato antigo), peso: cozinha 73 → 24 KB, geladeira 22 → 12,
  sofá 132 → 84 KB.

## 3. Estratégias e peso medido (AVIF, geometria com brotli)

- **A — textura única**: cor + AO (+ relevo) assados num atlas só da peça.
- **B — material compartilhado**: textura que repete (uma por casa) + AO pequeno da peça.
- **BN — B + relevo assado** da malha alta (ruga), sem perder a trama do tecido.

| peça | tri | geometria | AO 512 | única 512 / 1024 | relevo 512 | escolhida | **total da peça** |
|---|---|---|---|---|---|---|---|
| cozinha | 9.280 | 24 KB | 18 | 14 / 31 | 4 | B | **42 KB** |
| geladeira | 2.948 | 12 KB | 7 | (metal não tem) | — | B | **19 KB** |
| sofá 10k | 10.300 | 84 KB | 18 | 19 / 62 | 8 | BN | **110 KB** |
| sofá 5k | 5.150 | 46 KB | 18 | 19 / 60 | 11 | BN | **75 KB** |

Compartilhado (uma vez por casa): madeira 7 KB (512) / 19 KB (1024); inox 5 / 12 KB; linho 41 KB (512;
o 1024 tem relevo de 107 KB — não compensa).

Por tipo, a decisão:
- **Marcenaria → B.** A madeira compartilhada fica mais nítida de perto do que a única (206 px/m no
  atlas) e custa quase nada. A geometria (frestas, puxador, ripado) é o que dá qualidade.
- **Metal → B obrigatório.** Textura única não guarda reflexo (o bake de cor de metal sai preto).
- **Estofado → BN.** B puro mostra faceta da malha decimada; A sai liso mas perde a trama; BN junta os
  dois. 5k triângulos já basta com o relevo.

Em todos, **a geometria pesa mais que a textura**. O que cortou peso foi o formato da geometria, não a
textura.

## 4. A casa inteira (15 peças)

Medido = as 3 acima. O resto é estimado por semelhança (complexidade e área), marcado com ~.

| grupo | peças | KB |
|---|---|---|
| marcenaria | cozinha 42 · guarda-roupa casal ~35 · solteiro ~30 · rack/painel ~30 · mesa ~15 · cadeira ×4 ~15 (1 malha) · criado ×2 ~10 · gabinete banheiro ×2 ~30 | ~207 |
| estofado | sofá 75 · cama casal ~75 · cama solteiro ~60 · poltrona ~40 | ~250 |
| metal/louça | geladeira 19 · fogão ~20 · pia/cuba ×2 ~30 · vaso ×2 ~12 | ~80 |
| têxtil (não medido) | cortina ×3 ~25 (1 malha) · tapete ~30 | ~55 |
| compartilhado | madeira, linho, inox, louça | ~90 |
| **total dos móveis** | | **~0,7 MB** (faixa 0,6–0,9) |

Com a página base enxuta do Cedros (v6 sem a cama, ~430 KB): **~1,1 MB por apartamento**.

Tráfego e custo (Firebase Hosting: 360 MB/dia grátis, US$ 0,15/GB depois):
- 1000 visitas/dia × 1,1 MB = 33 GB/mês → 22 GB pagos → **~US$ 3,3/mês** (~R$ 18). No pior caso: todo
  visitante entra na visita e baixa todos os móveis.
- Tempo extra dos móveis (só depois de entrar na visita, cômodo a cômodo): 4G bom ~0,3 s; 3G ~3,4 s no
  total (estimado pela banda; a medição com rede emulada vem com a peça dentro do Cedros).

## 5. O que falta

1. Geladeira (e depois fogão e um sofá de braço reto) **dentro do Cedros**, com rede 3G/4G emulada.
2. Modelar têxtil (cortina, tapete) pra trocar o "~" da tabela por medida.
3. Escolher a referência do sofá de braço reto.

Arquivos: `kit.py` (cena), `texturas.py`, `exporta.py` (A/B/BN + panorama), `prep.py` (níveis AVIF/WebP),
`ver.html` + `foto_web.py` (navegador), `compara*.py`, `perfil.py`/`bordas.py`, `enxuga_geo.py`.

## 6. Rodada 2 (06/10): mais 5 peças e o Cedros v7 medido

### Peças contra a foto

| peça | rodadas | foto × Cycles | o que decidiu |
|---|---|---|---|
| fogão 4 bocas | 10 | 21,6 % (corpo quase preto) | foto de lente longa: câmera **ortográfica**; luz do chão rebatido manda no preto |
| cortina de ilhós | 3 | 12,4 % | onda em zigue-zague presa nos ilhós; blackout de mescla fina (o linho virava mancha) |
| painel de TV + rack | 3 | 14,6 % | mármore procedural de veio quase reto (turbulência alta vira curva de nível) |
| tapete de lã | 11 | 7,5 % (contraste local 11 × 26 da foto) | **fios com gravidade** (sugestão sua), ver abaixo |
| mesa + 6 cadeiras | 3 | 19,7 % | capitonê é geometria (botão afunda o estofado); disposição das cadeiras não confirmada |
| fogão 5 bocas, mesa de vidro | 3 | 20,3 % | sem fundo luminoso (o vidro o espelhava inteiro); softbox só de reflexo à esquerda |

O sofá "nuvem" foi estacionado (aprendizados em `sofa/APRENDIDO.md`). O de braço reto está no fim da lista.

**Tapete por fios** (`tapete/fios.py`):
- **Fios:** 350 mil fios em curvas de cabelo, num pedaço de 1 m que repete. Cada tufo nasce em pé e tomba ao longo da fileira.
- **Gravidade e colisão:** uma altura acumulada faz o tufo seguinte deitar por cima dos que já caíram.
- **Captura:** foto de cima, em três passadas de emissão pura (cor, AO e normal), viram a textura.
- **Armadilhas:**
  - a ordem de queda igual em todas as fileiras deixava uma linha a cada 50 cm;
  - um número não inteiro de fileiras no pedaço deixava uma linha diagonal;
  - o PIL lê PNG RGB de 16 bits como 8 bits.
- **Limite:** o contraste local para em ~11 (foto: 26). Relevo de normal map some sob luz suave (a mesma lição da cama). Chegar lá pede deslocamento de verdade, que no navegador exige um shader de paralaxe.

### Peso medido por peça (geometria brotli + AO 512 [+ relevo 512 no BN], AVIF)

| peça | tri | estratégia | KB da peça |
|---|---|---|---|
| cozinha compacta | 9.280 | B | 42 |
| geladeira | 2.948 | B | 19 |
| fogão 4 bocas | 10.760 | B | 66 (grelha e queimadores: dá pra enxugar) |
| cortina (serve às 3 janelas: a mesma malha esticada) | 7.172 | BN | 32 |
| painel + rack | 3.012 | B | 36 |
| tapete | 564 | B | 14 |
| mesa + 6 cadeiras | 14.804 | BN | 89 |
| sofá (5 mil tri) | 5.150 | BN | 75 |
| fogão 5 bocas (não cabe na vaga de 62 cm do Cedros) | 17.408 | B | 96 (queimador e trempe chanfrados: dá pra cortar pela metade) |

Texturas compartilhadas em 512 (uma vez por casa):

| textura | KB |
|---|---|
| madeira | 7 |
| inox | 5 |
| mármore | 3 |
| blackout | 29 |
| linho | 41 |
| lã de fios | 123 (a de fios pesa 3× a procedural; relevo em 256 economizaria ~70) |

### Cedros v7 = v6 + geladeira, fogão, cortina e painel (`publicacao/.../cedros-v7/site-leve`)

- **Montagem:** `montar_cedros.py`; carregador `movel-web.js`, irmão do `cama-assada.js`. As peças só baixam quando o visitante entra na Planta 3D ou na Visita.
- **Encaixe no registro:**
  - `caixa` (geladeira);
  - `altura` (fogão, na proporção real);
  - `plano` (cortina: estica largura e altura, mantém a dobra);
  - `real` (painel + rack, que também esconde o ripado e a TV do catálogo).
- **Reflexo:** o metal reflete a sonda do cômodo.

Medido com rede emulada (Chrome com a GPU real; o visitante entra na visita assim que a página abre):

| rede | página abre | 4 peças instaladas | cama q3 |
|---|---|---|---|
| 4G bom (20 Mbps) | 1,1 s | 3,8 s | 3,0 s |
| 4G fraco (5 Mbps) | 1,4 s | 4,9 s | 4,5 s |
| 3G (1,6 Mbps) | 2,6 s | 7,6 s | 7,8 s |
| celular lento (Lighthouse + CPU 4×) | 4,2 s | 11,8 s | 10,9 s |

Bytes na rede: página 328 KB + cama 287 KB + 4 peças 190 KB = **805 KB**.

### A casa inteira, refeita com os números medidos

| grupo | KB |
|---|---|
| medidos: cozinha, geladeira, fogão, cortina ×3, painel + rack, tapete, mesa + cadeiras, sofá | 372 |
| estimados por semelhança: 2 guarda-roupas, 2 criados, 2 gabinetes de banheiro, 2 vasos, máquina, coifa, poltrona | ~190 |
| cama (o bake atual, em textura única q3) | 287 (refeita em BN, ~90) |
| texturas compartilhadas | ~210 |
| **móveis** | **~0,86 a 1,06 MB** |
| + página | 328 |
| **apartamento** | **~1,2 a 1,4 MB** |

- **Custo:** 1000 visitas/dia → 36 a 42 GB/mês. Descontados os ~10,8 GB grátis do Firebase Hosting, sobram 25 a 31 GB a US$ 0,15/GB: **US$ 4 a 5 por mês** (~R$ 22 a 26), no pior caso (todo visitante entra na visita).
- **Tempo:** a página continua abrindo em 1,1 s no 4G e 2,6 s no 3G, porque os móveis não entram na abertura. Os 15 móveis levariam ~3 s a mais no 3G. Carregar por cômodo, o mais próximo primeiro, é o próximo ajuste do `movel-web.js`.

### Próximos passos

1. **Sofá de braço reto:** preciso do arquivo da foto (veio só no chat).
2. **Carregamento por cômodo** no `movel-web.js`.
3. **Tapete:** paralaxe, se o contraste da lã for prioridade.

## 7. Cama em BN (Cedros v8)

**Como ficou** (`cama-box-referencia/prep_bn.py`, `cama-assada.js`):
- **Detalhe compartilhado:** os 3 padrões de matelassê da cena (célula do box 14 × 18 cm, célula da lateral 10 × 14, bordado e vinco do tampo 18 × 18) são periódicos. Viraram 3 bumps de 256 px que repetem: 6,5 KB no total.
- **Malhas:** o corpo foi partido em 3 (box, lateral, tampo), cada uma com o seu padrão. A UV de detalhe sai da projeção de caixa em metro, a mesma que o Cycles usa.
- **Cor única pequena:** fica, porque a cor da cama não é lisa (cordão claro, mancha escura do tufo, bordado). Só caiu de 768 para 512 px, com o relevo assado da malha alta também em 512.
- **Patch de shader:** o three faz normal map OU bump (é um `#elif`). O patch aplica o bump depois do relevo e escurece o fundo da costura na cor, normalizado pela média para não escurecer a cama inteira.
- **Sem recompilar:** o material nasce com um bump plano de 1 px no mesmo canal, então a chegada do detalhe não recompila o shader.
- **Níveis:** q1 (cor 192) → q3 (512 + relevo + detalhe). O q2 de 384 custava 58 KB a mais na rede lenta para adiantar ~0,5 s.

**Contra a cama atual** (mesma câmera, 1 m do pé, `fotos/cama-bn-x-atual.webp`):
- diferença média de cor: 1,6/255;
- contraste local: 12,07 contra 12,03;
- a estrela do tufo fica um pouco mais macia que em 768 px. Em 384 ela borrava, por isso o teto é 512.

| | cama hoje (v6/v7) | cama BN (v8) |
|---|---|---|
| bytes na rede, 4G (pula níveis) | 229 KB | **128 KB** |
| bytes na rede, 3G / celular lento (sobe nível a nível) | 287 KB | **128 KB** |
| cama pronta, 3G | 7,2 s | **6,2 s** |
| cama pronta, celular lento | 10,7 s | **9,1 s** |

**Cedros v8** (`publicacao/.../cedros-v8/site-leve`, v7 + cama BN):
- página 329 + cama 128 + 4 peças 190 = **647 KB** (o v7 tinha 805);
- abre em 0,9 s no 4G e 2,5 s no 3G;
- tudo instalado aos 3,5 s no 4G e 7,3 s no 3G.

**Casa inteira, refeita:** móveis ~0,9 MB e apartamento ~1,2 MB. A 1000 visitas/dia: ~37 GB/mês, ~26 GB pagos, **~US$ 4 por mês**.
