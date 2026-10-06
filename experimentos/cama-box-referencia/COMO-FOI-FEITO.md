# Cama box contra a foto: como foi feito

Teste de 06/10/2026: reproduzir no Blender a foto de uma cama box casal com colchão
pillow-top (`referencia.webp`), no mesmo enquadramento, e conferir por print a cada
rodada. Regra combinada: referência e resultado lado a lado, você vendo cada rodada,
e no máximo 3 rodadas por objetivo sem convergir.

Resultado em uma imagem: `evolucao.webp` (foto, teste inicial, cor calibrada, final).

## Ferramentas

| Ferramenta | Para quê |
|---|---|
| Blender 5.2.2 em linha de comando (`-b`), Cycles na GPU (OptiX, GTX 1650) | Modelar e renderizar sem mexer no Blender aberto. Cada rodada leva de 1,5 a 2,5 min |
| Python do Blender (`bpy`, `bmesh`, `numpy`) | Toda a cena é código: `cena.py` reconstrói tudo do zero a cada rodada |
| Python do sistema (`numpy`, `scipy`, `Pillow`) | Medir a foto, resolver a câmera e comparar os renders |
| `camera_solve.py` | Calcula a câmera a partir de cantos medidos na foto |
| `compara.py` | Monta foto, render e sobreposição de 50% lado a lado, e mede a cor por região |
| `contraste.py` | Mede o contraste local do tampo, que é o número que diz se o tufo aparece |

## O laço de conferência

1. Render (`cena.py`).
2. `compara.py`: lado a lado, sobreposição e tabela de cor por região (render dividido pela foto, 1,00 = igual).
3. Recorte ampliado da peça em questão, porque o print chega reduzido e o detalhe some.
4. Um número para o que a cor média não enxerga (contraste do tampo).
5. Decido a próxima mudança pelo número e pelo recorte, e não pela impressão geral.

**Por quê:** olhando a imagem inteira eu tendo a ver a melhora que espero. Por duas vezes
o número desmentiu o olho (rodadas 4 e 5, abaixo).

---

## Efeito por efeito

### 1. A cama no mesmo ângulo e no mesmo tamanho da foto

**O que se vê:** na sobreposição de 50%, os cantos da cama, a emenda do box e a etiqueta
caem em cima da foto.

**Como:**
- Ampliei a foto em grade (3 a 4 vezes, com linha a cada 5–10 px) e anotei 11 cantos da cama:
  base, emenda do colchão, topo, pé de trás e emenda central do box.
- Mais 3 pontos da borda esquerda do tampo, usados como restrição de reta.
- Suposição: medida padrão de casal, 1,38 × 1,88 m.
- `scipy.optimize.least_squares` acha a posição da câmera, a lente e as alturas da cama que fazem esses pontos baterem.

**Raciocínio:**
- A primeira solução, com a câmera inclinada para baixo, errava 5,9 px em média, e o canto esquerdo saía torto 18 px.
- Isso denunciou que a foto tem as verticais retas, que é correção de perspectiva típica de foto de produto.
- Troquei por câmera **nivelada com lente deslocada** (`shift_x/shift_y` do Blender). O erro caiu para **3,4 px** com menos parâmetros, sinal de que o modelo está certo, e não só ajustado.
- O comprimento da cama deixado livre ia para 2,29 m sem melhorar o erro. A foto não determina o comprimento, então fixei o padrão.
- De quebra, as alturas saíram da própria foto: base até 0,30 m, colchão até 0,52 m, pillow-top até 0,59 m.

### 2. Box bipartido, pés, vivos (cordão) e bordado

**O que se vê:** duas metades de box com emenda no meio, pés escuros recuados, cordão
torcido nas três costuras e o bordado manuscrito na frente.

**Como:**
- Caixas com o modificador **Bevel**, que dá canto arredondado sem entrar no modo de edição. O `mode_set` trava o Blender em linha de comando.
- Os pés são cones curtos.
- O cordão é uma curva retangular de canto redondo com `bevel_depth`, e uma textura listrada no relevo faz o "torcido".
- O bordado é um texto em fonte manuscrita (Segoe Script negrito) com 0,6 mm de extrusão.
- O lugar e o tamanho do bordado foram **calculados**: projetei candidatos com a câmera resolvida até cair no pixel medido na foto (centro em u=233, v=328).

**Raciocínio:** troquei o nome da marca da foto por "Descanso", com o mesmo tamanho e posição. Um móvel de catálogo não deve carregar a marca de terceiro, e a comparação continua valendo.

### 3. Matelassê do box e da lateral do colchão

**O que se vê:** células de canto redondo em colunas defasadas, com o vinco da costura mais escuro.

**Como:**
- Em `numpy` gerei um **mapa de altura** com a distância até a borda de um retângulo arredondado (SDF), repetido em colunas defasadas meia célula.
- A imagem é "não-cor" e entra de duas formas:
  1. no nó **Bump**, para o relevo;
  2. como fator de mistura da cor, que deixa o fundo do vinco 22% mais escuro, como a sombra de costura num tecido real.
- A projeção é **Box** em coordenadas do objeto, sem UV.
- No box a célula tem 7 × 9 cm; na lateral, 5 × 7 cm.

**Armadilha que custou uma rodada:** no teste inicial o matelassê não apareceu. A causa: **trocar o espaço de cor da imagem depois de preencher os pixels zera a imagem**, sem erro nenhum. A ordem certa é espaço de cor primeiro, pixels depois. Achei isolando o problema num script de 10 linhas que media a média dos pixels antes e depois de cada operação.

### 4. Cor e luz calibradas pela foto

**O que se vê:** box, lateral, piso, cortina e travesseiro esquerdo com a cor da foto
dentro de ±5%.

**Como:**
- `compara.py` mede a cor mediana de 12 regiões na foto e no render.
- A cada rodada escalei a cor de base de cada material pela razão render/foto.
- A luz é uma área principal à direita, um preenchimento vindo da câmera e o abajur.

| Região | Teste | Rodada 1 | Rodada 3 | Final |
|---|---|---|---|---|
| Box | 1,32 | 1,11 | 1,07 | 1,04 |
| Lateral do colchão | 1,31 | 1,13 | 1,04 | 1,01 |
| Piso | 1,98 | 1,56 | 1,05 | 1,02 |
| Cortina | 1,56 | 1,33 | 1,02 | 0,99 |
| Travesseiro esquerdo | 1,39 | 1,22 | 0,91 | 1,01 |

**Raciocínio:**
- O brilho no canto superior direito da foto parecia uma arandela na parede.
- Projetei aquele pixel na cena e ele caiu a 1,06 m de altura, em cima do criado-mudo. Era um **abajur** fora do quadro, então ele foi para lá.
- A cortina e a planta também foram posicionadas projetando: a parede esquerda só aparece até y=0 na foto, e o vaso fica escondido atrás da cama.

### 5. Os tufos do pillow-top (o objetivo mais difícil)

**O que se vê:** pontos afundados com vinco em estrela e o almofadado entre eles.

**Como, em ordem:**

| Rodada | O que tentei | Contraste (foto: 16,2) | Por que deu ou não deu |
|---|---|---|---|
| 1–3 | Tufo só no relevo pintado (bump) | 8,7 → 9,8 | Com luz suave, o bump só inclina a normal e não faz sombra. Na imagem reduzida ele some |
| 4 | Malha de verdade: grade de 93,6 mil vértices, a cada 5 mm, subindo até 1,8 cm entre os tufos | 9,85 | Nenhum efeito medido. O olho dizia que "melhorou um pouco", o número disse que não |
| 5 | Tufo mais fundo (3,5 cm) e oclusão de ambiente no material | 10,2 | Quase nada, e o render subiu de 90 s para 328 s. Descartado |
| 6 | Investigação, depois cone de "botão" e mancha escura por vértice | **10,6** | Ver abaixo |

**O que a rodada 6 descobriu:**
1. O fundo de cada tufo ficava **exatamente no plano do tampo da caixa de baixo**. Ali aparecia o tampo liso, não o tufo. Baixei a caixa 1,2 cm.
2. A gaussiana de 1 cm que fazia o "botão" tinha 2 vértices numa malha de 5 mm, ou seja, não existia. Troquei por um **cone** de 2,2 cm de raio.
3. A mancha escura do tecido dobrado dentro do botão virou um **atributo gravado em cada vértice**, lido pelo material (nó Attribute). É determinístico e não custa nada no render, ao contrário da oclusão de ambiente.

**Raciocínio:** criei o `contraste.py` (desvio da luminância depois de um passa-alta) porque a cor média não enxerga relevo. Foi ele que mostrou que as rodadas 4 e 5 não tinham mudado nada.

**O que ficou faltando:** a foto tem os tufos mais espaçados e um bordado grande em espiral bege, que é desenho de **cor** e não de relevo. É dali que vem boa parte da diferença entre 10,6 e 16,2.

### 6. Travesseiros de pano

**O que se vê:** canto em ponta, lateral côncava e babado na costura.

**Como, em ordem:**

| Rodada | O que tentei | Resultado |
|---|---|---|
| 1–6 | Travesseiro por fórmula: espessura que cai até a borda, mais um anel ondulado | Cara de **cabeceira estofada**: frente reta e moldura uniforme |
| p1 | **Simulação de pano com pressão interna**: frente e verso costurados formam um envelope fechado; modificador Cloth com `use_pressure`, sem gravidade, 36 quadros; o resultado é congelado em malha | O pano não estica, então a borda puxa para dentro e o canto vira ponta, sozinho. Mas inflou demais: 33 cm |
| p2 | Pressão menor, babado em 3 anéis e mais escuro | O babado continuou liso |
| p3 | **Babado como malha própria, reamostrada**: 6 pontos por prega ao longo da costura | Prega visível. Espessura de 22,6 cm |

**Raciocínio:**
- A fórmula nunca ia dar a ruga, porque a ruga é consequência física de um pano que não estica sendo inflado. Por isso troquei por simulação em vez de ajustar mais número.
- O babado liso da p2 era amostragem: 152 vértices na borda para 124 pregas é pouco mais de 1 vértice por prega, e a prega some. É o mesmo tipo de defeito do tufo de 1 cm numa malha de 5 mm.

**O que ficou faltando:**
- O babado ficou **regular demais**, com cara de plissado; o da foto é franzido mole e irregular. O próximo passo seria simular o babado também como pano.
- O travesseiro da direita está 46% mais claro que o da foto, e o cetim não tem as rugas horizontais da foto.

### 7. Ambiente

**O que se vê:** piso de tábua, tapete de sisal, cortina, planta e criado-mudo com abajur.

**Como:**
- **Piso:** textura de tijolo girada 90° (uma "tábua" de 1,2 × 0,19 m) vezes um ruído esticado no sentido do veio.
- **Tapete:** ondas com ruído numa rampa de cor.
- **Cortina:** plano com dobra em senóide.
- **Planta:** procedural, com 13 hastes e folhas lanceoladas sorteadas com semente fixa.

**Raciocínio:** o ambiente só precisa acertar luz e cor em volta da cama. Não gastei rodada nele.

---

## Lições

1. **Medir antes de opinar.** Câmera por mínimos quadrados, cor por região e contraste por passa-alta. Em duas rodadas o número desmentiu a impressão visual.
2. **Efeito invisível tem causa concreta, e quase sempre é amostragem ou ordem de operação:** imagem zerada pelo espaço de cor, fundo do tufo no plano do tampo, botão menor que a malha, babado com 1 vértice por prega. Nenhum desses dava erro.
3. **Quando o ajuste de número para de render, a técnica está errada.** Ajustar mais nem sempre resolve. Relevo pintado virou geometria, e fórmula virou simulação de pano.
4. **O teto de 3 rodadas evita girar em falso.** Os tufos pararam em 10,6 de 16,2 porque o que falta (o desenho em espiral) é outro problema.

## O que ainda não está igual à foto

| Item | Situação | Próximo passo |
|---|---|---|
| Bordado grande em espiral no tampo | Não existe | Mapa de cor com o motivo (é cor, não relevo) |
| Espaçamento dos tufos | Mais denso que na foto | Rede quadrada de ~0,16 m em vez do losango de 0,18 |
| Babado | Plissado regular | Simular o babado como pano preso na costura |
| Travesseiro direito | 46% claro demais | Luz principal mais frontal ou mais giro |
| Parede esquerda | 25% escura demais | Luz quente entrando pela cortina |

## Arquivos

- `cena.py`: a cena inteira (rodada final). `cena_r3.py` e `cena_r6.py` guardam as versões intermediárias.
- `camera_solve.py` e `camera.json`: a câmera resolvida.
- `compara.py`, `contraste.py`, `regioes.json`: a conferência.
- `render_*.png` e `comp_*.png`: cada rodada. `zoom_tampo_r6.webp` e `zoom_trav_p3.webp`: os recortes dos dois objetivos difíceis.
- `cena.blend`: abre no Blender. As texturas de matelassê ficam em `tex/`.

---

## Parte 2: a mesma cama assada para o navegador (o motor do app)

**Pergunta:** quanto do render de 2 minutos sobrevive no three.js do app, que desenha cada quadro em 16 ms?

**Resultado:** comparado com o render do Cycles (`comp3_t3.webp`, `zoom3_tampo.webp`):

| | Cycles | Navegador (assado) |
|---|---|---|
| Triângulos da cama | ~100 mil (só o tampo tem 93,6 mil vértices) | **7.350** (corpo 432 + travesseiros 6.438 + pés 480) |
| Tempo por quadro | ~2 min na GPU | tempo real |
| Chamadas de desenho da cama | — | 3 (corpo, travesseiros, pés) |
| Cor da cama (navegador / Cycles) | 1,00 | 0,92–1,05 nas 6 regiões, travesseiro direito 0,86 |
| Contraste do tampo | 10,6 | **10,1** com curva AgX, **15,4** com a curva ACES do app |
| Peso no download | — | **1,8 MB** (geometria 677 KB + texturas 1.113 KB) |

### Efeito: o detalhe da cama pesada numa cama de 432 triângulos

**Como:** o `assa.py` monta a cena pesada (`cena.py` com `SO_CENA=1`, sem render) e depois:
1. Faz a cama leve com as mesmas caixas e chanfro de 2 segmentos. Os travesseiros vêm do pano simulado, decimados a 22%.
2. Abre a UV **à mão**, porque operador de UV não roda com o Blender em linha de comando. Cada face vai para o mapa da sua peça e do seu eixo dominante, projetada no plano dele. Os mapas são empilhados em prateleiras num atlas de 2048 px (611 px/m), e o que nunca aparece (fundo, face colada) é encolhido a 15%.
3. Assa da pesada para a leve, com "selecionado para ativo": **relevo** (normal map tangente, onde entram tufo, matelassê e cordão), **cor** sem luz e **oclusão** só da cama, com quarto e travesseiros escondidos.
4. Exporta num formato próprio (JSON + binário + WebP), na mesma linha do `moveis_lib.json` do app. O three r168 do app não tem leitor de GLTF.

**Raciocínio:**
- A malha leve fica **dentro** da pesada, no meio da altura dos tufos. Por isso ela é invisível para os raios durante o bake; senão cada vale de tufo assa preto.
- Cor e oclusão saem **separadas** e a mistura é dosada fora (`combina.py`). Na t1 a oclusão entrou junto na cor, a 55%, e o tufo escureceu duas vezes.

### Efeito: mesma câmera e mesma luz no navegador

**Como:**
- `cama_three.html` usa o próprio `three.min.js` do app e lê a câmera do `camera.json`. O deslocamento de lente do Blender vira `setViewOffset`.
- As luzes ficam nas mesmas posições. A intensidade é parâmetro na URL e foi calibrada pela razão de cor contra o Cycles.
- `foto_three.py` tira o print pelo Chrome sem janela (Playwright), com um servidor local, porque textura por `file://` é barrada no WebGL.

### Efeito: o tufo virando "bolinha" (e por quê)

| Rodada | O que mudou | Contraste do tampo (Cycles 10,6) |
|---|---|---|
| t1 | Oclusão a 55% dentro da cor | 16,5 |
| t2 | Oclusão a 25%, luz calibrada | 15,4 |
| t3 (diagnóstico) | Sem relevo: 12,0. Com a curva **AgX**: **10,1** | — |

**Raciocínio:**
- Testei uma causa de cada vez em vez de ajustar no escuro.
- O que endurece o tufo é a **curva de tom ACES do app**, não o bake. O Cycles usou AgX, que é mais suave no escuro. Com a mesma curva o número bate.
- **Mas o número bater não basta.** No recorte, o tufo do navegador ainda é uma mancha borrada; no Cycles é vinco em estrela iluminado. A luz em tempo real modula pouco o relevo assado, e quem domina é o escuro gravado na cor.

### Armadilhas desta parte

- **Amostras no bake:** com 64 amostras para tudo, o bake levou 30 min. Cor e relevo precisam de 4; só a oclusão precisa de mais (32). O mesmo bake caiu para **94 s**.
- **Atlas com 40% vazio:** o empacotamento por prateleira desperdiça espaço ao lado do mapa grande do tampo. A densidade poderia ser ~1,3x maior no mesmo tamanho.

### Peso: onde estão os 1,8 MB e quanto dá para cortar (estimativa, não medido)

| Parte | Hoje | Como cortar |
|---|---|---|
| Relevo do corpo (WebP 2048) | 713 KB | Atlas de 1024 bem empacotado: ~200 KB |
| Travesseiros (geometria float32 sem índice) | 603 KB | Decimar mais, indexar e quantizar: ~80 KB |
| Relevo dos travesseiros | 238 KB | 512 px: ~70 KB |
| Resto | ~240 KB | — |

Estimativa total depois do corte: ~0,5 MB por cama. Hoje o 3D do imóvel inteiro pesa 10 KB, então isso é decisão de produto, não detalhe.

---

## Parte 3: a cama na Cedros, carregando em níveis

O relatório completo, com marcos, tempos em 3G e 4G, peso e custo, está em [RELATORIO-CEDROS.md](RELATORIO-CEDROS.md).

As técnicas novas desta parte:

| Efeito | Como | Por quê |
|---|---|---|
| A cama troca no lugar sem recarregar | Extensão `cama-assada.js` (padrão do `visual.js`): adiciona a cama nova como filha do móvel e esconde a antiga | A página abre como sempre, e ninguém espera a cama |
| Sobe de qualidade sem travar | O material nasce com um relevo plano de 1 px; cada nível só troca a imagem | Trocar "sem relevo" por "com relevo" recompila o shader, e isso trava o quadro |
| Geometria 10× menor | Índice + posição em 16 bits + normal em 8 bits + UV em 16 bits | Os travesseiros em float cru pesavam 603 KB; a cama toda passou a 55 KB comprimida |
| Cama começa cedo | Baixa assim que o script roda, os 4 arquivos de cada nível em paralelo, e só instala quando a casa existe | Esperar a casa adiava o início para 5,5 s; em fila, eram 4 latências seguidas |
| Cor certa no interior | Ganho por canal mais brilho próprio quente, calibrados medindo o quarto contra a foto | A luz do interior é céu azul; a cama do catálogo traz a luz quente assada nos vértices, a nova não |
