# O motor da maquete (MG-2, MG-3)

O motor que mostra a maquete de qualquer imóvel, a partir da [maquete geral](../../tasks/painel/maquete-geral.md):

- veio do visualizador do LIV, já separado dos dados dele (o MG-1, na `liv-melhorado`);
- usa three.js 0.186.1, com WebGPU e reserva automática em WebGL2;
- abre a cena de um pacote de dados, conferindo o tamanho e o sha256 de cada recurso;
- a luz pré-calculada é opcional. Sem ela, o sol da cena e a sombra dele são calculados no navegador;
- traz as unidades clicáveis, a Planta 2D e 3D, o Tour, a fila de preparação e o ambiente de reflexos.

## O que é o quê

- **O motor**: os arquivos desta pasta, menos `dados/` e `pacote-casa/`. Não tem nome, medida, caminho nem
  número de imóvel nenhum; `test_motor.mjs` confere.
- **Os dados de um imóvel**: `dados/`. Um imóvel de verdade troca a pasta inteira; o motor não muda.
- **Os dois pacotes de teste**: os arquivos de exterior e de unidades saem de `gerar_pacote_teste.mjs`, e
  saem iguais em toda rodada e em todo sistema.
  - `dados/` é o **prédio** (MG-2):
    - um volume de 12 × 6 × 8 m sobre um chão;
    - dois apartamentos no pavimento piloto;
    - uma luz pré-calculada de 64 × 64.
  - `pacote-casa/` é a **casa** (MG-3):
    - uma casa térrea de uma unidade, de 10 × 8 m;
    - duas edições do mesmo modelo: `leve/`, sem luz pré-calculada, e `premium/`, com a de 64 × 64;
    - a ficha e a planta estão em `pacote-casa/maquete.js`.

## As páginas

- **`maquete.html`**: a entrada do imóvel de uma unidade (`tipo: 'casa'` ou `'apartamento'`), sem lista nem
  pavimentos.
  - **Maquete**: o exterior, na edição padrão (`?geometria=` escolhe outra);
  - **ficha**: o que o imóvel tem, o preço e "O que tem por perto?", que leva ao mapa do build
    (`dados.mapa.pagina`);
  - **Planta**: a Planta 2D desenhada da planta do cadastro (`dados.planta`) pelo `floor-plan.js` do v16
    (`v1.5/renderizador-v16-moveis/interior/`), o mesmo que levanta as paredes do interior em 3D.
  - O prédio (`tipo: 'predio'`) continua com a página dele, a do LIV, que usa o `viewer.js`.
- **`prova-rgbm.html`**: só o exterior. A `maquete.html` o mostra por dentro, num quadro.
- **`interior.html`**: o interior de uma tipologia.

**A vitrine ao vivo** (`pipeline/vitrine_ao_vivo.js`, do #88) não é do motor: o build a põe na
`maquete.html` (MG-5). Para isso:
- ela entra **depois** do `casa.js`, como `<script type="module">`, para rodar depois que a ficha está
  preenchida. Como script comum, ela poderia procurar o preço antes de ele existir;
- ela troca o último texto de `#fPreco` pelo preço do painel, ou pela situação (reservado, vendido,
  alugado);
- quando o imóvel sai do ar, ela cobre a página inteira, inclusive a maquete.

## Como conferir

- **No CI** (`npm test` na raiz), sem placa de vídeo, `test_motor.mjs` confere:
  - que o motor não tem dado de imóvel;
  - que os dois pacotes de teste saem iguais ao gerar de novo;
  - que as identidades do manifesto batem com os arquivos;
  - que o ajudante que baixa e confere (`decodificar-worker.js`), rodado no Node, recusa recurso trocado,
    tamanho errado e conteúdo corrompido;
  - que as unidades, o prédio e as câmeras vêm dos dados;
  - que a casa leve não pede luz pré-calculada em nenhum material, e que o sol da cena projeta sombra;
  - que a Planta 2D tem os cômodos, as janelas e as portas de giro da planta, sem peitoril nem verga, e
    sem marcação vinda de nome de cômodo.
- **Com placa de vídeo**:
  ```
  npm ci --prefix maquete/motor
  python maquete/motor/qa_abrir.py
  npm run qa:casa
  ```
  - O `qa_abrir.py` abre o prédio no WebGPU e no WebGL2, e confere que o motor recusa um byte trocado na
    luz.
  - O `qa:casa` roda o `qa_casa.py` dentro do emulador do Firestore (precisa do Java). Ele abre a casa nas
    duas edições e nos dois modos de gráfico, e confere:
    - a ficha e a Planta 2D;
    - um telefone sem rolagem para o lado;
    - a vitrine lendo `vitrine/casa-de-teste` no emulador: o preço do painel, "Vendido" no lugar dele e o
      "fora do ar" cobrindo a tela.
  - Até o #88 chegar à main, o `qa_casa.py` pega o `vitrine_ao_vivo.js` e a regra de `vitrine/<slug>` do
    galho dele (`origin/feat/imovel-no-ar`).

## O que ficou de fora, por enquanto

- **O leitor do estoque** (`estoque-runtime.js`) é gerado do modelo de estoque do painel, que ainda
  descreve só o prédio do LIV. O `viewer.js` só o carrega com o estoque ligado; a imobiliária usa a
  vitrine ao vivo.
- **O adaptador do mapa de 5 km** (`mapa-retorno.js`) é do LIV. Para a imobiliária, o mapa é o
  `tour.html` do build.
- **O interior da casa** (Planta 3D e Tour) vem da planta fixada, no MG-7.
- **O build** passa a montar a pasta com o motor, os dados e a vitrine no MG-5. Ele também leva o
  `floor-plan.js`, que mora fora desta pasta.
- **O otimizador da publicação** entra no MG-8, já lendo a página dos dados. Hoje ele cita a página do
  LIV pelo nome.

A cópia do LIV (`experimentos/liv-experimental-2026-10-14/`, na `liv-melhorado`) é o mesmo motor.
Mudanças no motor passam a nascer aqui; o LIV vira um pacote de dados deste motor quando a construtora
entrar no fluxo.
