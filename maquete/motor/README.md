# O motor da maquete (MG-2)

O motor que mostra a maquete de qualquer imóvel, a partir da [maquete geral](../../tasks/painel/maquete-geral.md):

- veio do visualizador do LIV, já separado dos dados dele (o MG-1, na `liv-melhorado`);
- usa three.js 0.186.1, com WebGPU e reserva automática em WebGL2;
- abre a cena e a luz pré-calculada de um pacote de dados, conferindo o tamanho e o sha256 de cada
  recurso;
- traz as unidades clicáveis, a Planta 2D e 3D, o Tour, a fila de preparação e o ambiente de reflexos.

## O que é o quê

- **O motor**: os arquivos desta pasta, menos `dados/`. Não tem nome, medida, caminho nem número de
  imóvel nenhum; `test_motor.mjs` confere.
- **Os dados de um imóvel**: `dados/`. Aqui mora o **pacote de teste**:
  - um volume de 12 × 6 × 8 m sobre um chão;
  - dois apartamentos no pavimento piloto;
  - uma luz pré-calculada de 64 × 64.

  Os arquivos de `dados/exterior/` e `dados/unidades.json` saem de `gerar_pacote_teste.mjs`, e saem iguais
  em toda rodada e em todo sistema. Um imóvel de verdade troca a pasta `dados/` inteira; o motor não
  muda.

## Como conferir

- **No CI** (`npm test` na raiz), sem placa de vídeo, `test_motor.mjs` confere:
  - que o motor não tem dado do LIV;
  - que o pacote de teste sai igual ao gerar de novo;
  - que as identidades do manifesto batem com os arquivos;
  - que o ajudante que baixa e confere (`decodificar-worker.js`), rodado no Node, recusa recurso trocado,
    tamanho errado e conteúdo corrompido;
  - que as unidades, o prédio e as câmeras vêm dos dados.
- **Com placa de vídeo**:
  ```
  npm ci --prefix maquete/motor
  python maquete/motor/qa_abrir.py
  ```
  O script abre `prova-rgbm.html` com o pacote de teste no WebGPU e no WebGL2. Depois troca um byte da luz
  servida e confere que o motor recusa.

## O que ficou de fora, por enquanto

- **O leitor do estoque** (`estoque-runtime.js`) é gerado do modelo de estoque do painel, que ainda
  descreve só o prédio do LIV. O `viewer.js` só o carrega com o estoque ligado; a imobiliária usa a
  vitrine ao vivo.
- **O adaptador do mapa de 5 km** (`mapa-retorno.js`) é do LIV. Para a imobiliária, o mapa é o
  `tour.html` do build.
- **O otimizador da publicação** entra no MG-8, já lendo a página dos dados. Hoje ele cita a página do
  LIV pelo nome.
- **A página de entrada genérica** (`maquete.html` a partir dos dados) e o imóvel de uma unidade sem luz
  pré-calculada são o MG-3.

A cópia do LIV (`experimentos/liv-experimental-2026-10-14/`, na `liv-melhorado`) é o mesmo motor.
Mudanças no motor passam a nascer aqui; o LIV vira um pacote de dados deste motor quando a construtora
entrar no fluxo.
