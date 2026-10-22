# O motor da maquete (MG-2 a MG-5)

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
`maquete.html` (`com_vitrine(..., modulo=True)` no `build_imovel.py`, desde a junção do #108). Assim:
- ela entra **depois** do `casa.js`, como `<script type="module">`, para rodar depois que a ficha está
  preenchida. Como script comum, ela poderia procurar o preço antes de ele existir;
- ela troca o último texto de `#fPreco` pelo preço do painel, ou pela situação (reservado, vendido,
  alugado);
- quando o imóvel sai do ar, ela cobre a página inteira, inclusive a maquete.

## O exportador (MG-4)

O `pipeline/maquete_dados.py` transforma a maquete de hoje num pacote de dados deste motor:

```
python pipeline/maquete_dados.py <imovel> --modo leve|premium --saida PASTA
```

1. **Monta a página de hoje** com o `pagina_maquete.py`, como o build: no LEVE, a do cadastro; no
   PREMIUM, a do padrão do Cedros, com a luz calculada dele.
2. **Abre a página num Chrome sem janela** e lê a cena dela (`window.__maq`), como o `exportar_cena.py`
   do LIV.
   - Não precisa de placa de vídeo: o gráfico roda no processador (SwiftShader).
   - O relógio dos quadros fica parado: a maquete de hoje gira sozinha e pulsa o andar da unidade, e isso
     mudaria a câmera e a cor a cada exportação.
3. **Grava o pacote**:
   - `maquete.js`: a ficha e a planta, lidas da própria página;
   - `exterior/`: a cena, o manifesto e as texturas;
   - no PREMIUM, também a luz do Cedros. O arquivo do padrão tem 8 bytes de cabeçalho (largura e altura)
     antes das cores; o motor lê só as cores e confere o tamanho, então o cabeçalho sai.

**Exportar duas vezes na mesma máquina dá os mesmos bytes**: chaves em ordem, gzip sem data e nenhum
horário no manifesto.

**Medido em 21/10, neste computador**:

| | LEVE (Monte das Colinas) | PREMIUM (Cedros) |
|---|---|---|
| Montar a página de hoje | 3,2 s | 6,9 s |
| Abrir e ler a cena | 4,5 s | 5,8 s |
| Gravar o pacote | menos de 0,1 s | 3,6 s (comprimir a luz de 4096²) |
| Memória do navegador (JS) | 10 MB | 37 MB |
| Pacote | 0,25 MB (cena de 163 KB e 4 texturas) | 8,2 MB (cena de 1,4 MB e luz de 6,7 MB) |
| A página de hoje, para comparar | 3,3 MB | 43,7 MB |

- O Python chegou a 211 MB de pico exportando os três casos duas vezes.
- Na máquina do GitHub, o tempo e a instalação do Chrome e do Playwright ainda são a medir, no MG-5.

**Diferenças conhecidas para a página de hoje:**
- **As linhas verdes do andar da unidade não vêm.** O motor só desenha malhas. No LEVE, o andar continua
  pintado de verde, porque a cor está nas próprias paredes. No PREMIUM, as linhas eram o único realce do
  andar, então ele some.
- **O reflexo do céu é o do motor**, e não o da página.

## O build novo (MG-5)

`python pipeline/build_imovel.py <imóvel>` monta, por padrão, o build da maquete geral (schema 2). **A pasta
do build é a pasta deste motor**, com:
- `maquete.html` (a entrada da casa) e os arquivos do motor;
- `dados/`, que o exportador gera da maquete de hoje;
- `tour.html`, o mapa da cidade, como sempre;
- `manifest.json`, schema 2.

Assim nenhum arquivo do motor precisa ser reescrito, e os ponteiros `/imovel/<id>` e `/maquete/<id>`
continuam os mesmos.

- **Quais arquivos do motor vão**: `arquivos_do_motor()` segue, a partir de `maquete.html` e
  `prova-rgbm.html`, tudo o que eles carregam: módulos, ajudantes, `assets-ambiente/` e o three pelo
  importmap. Hoje são 24 arquivos e 3,8 MB, quase tudo do three (o MG-8 enxuga). Texto vai com fim de
  linha LF, então o build sai igual em qualquer sistema.
- **O `floor-plan.js` é cópia fiel do v16**, para a pasta do motor bastar num build. O `test_motor.mjs`
  exige que a cópia continue idêntica.
- **O manifesto schema 2**:
  - lista todos os arquivos, cada um com bytes e sha256;
  - `build` = sha256 da lista "caminho sha256", uma linha por arquivo, em ordem de caminho (12 dígitos);
  - `entradas` = `tour.html` e `maquete.html`;
  - `motor` é o hash dos arquivos do motor; `formato` é `maquete-geral-v1`.
- **A reserva**: `--formato 1` monta o build antigo (a página de hoje), até o MG-8 medir.
- **A publicação** (`publicar_imovel.py`) e o painel aceitam os dois schemas. Um build schema 2 é
  conferido arquivo por arquivo, e é recusado se:
  - tiver arquivo a mais ou a menos;
  - algum caminho sair da pasta ou começar com ponto (o Hosting não subiria esse arquivo);
  - as entradas forem outras.
- **Medido** com o Monte das Colinas (LEVE):
  - o build novo leva 14 s; o antigo, 11 s;
  - a pasta nova tem 32 arquivos e 17,4 MB; a antiga, 16,6 MB. O tour.html é a maior parte das duas.

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
  - O `qa_casa.py` usa o `vitrine_ao_vivo.js` e a regra de `vitrine/<slug>` do próprio repositório. Onde o
    #88 ainda não chegou (a linha do MG-2 ao MG-5), ele os pega do galho do #88
    (`origin/feat/imovel-no-ar`).
  - O `qa_exportados.py` exporta duas vezes o Monte das Colinas (LEVE) e o Cedros (LEVE e PREMIUM), e
    confere que os bytes são os mesmos. Depois abre cada pacote no motor, no WebGPU e no WebGL2, e grava
    um print lado a lado com a página de hoje.
- **O exportador sem navegador** (`tests/test_maquete_dados.py`, no CI): o pacote sai igual da mesma
  cena, os manifestos batem, a luz do Cedros vira o formato do motor, e cada produto leva só a luz dele.
- **O build novo**:
  - no CI: `tests/test_build_imovel.py` (a identidade schema 2 e a lista de arquivos do motor);
    `tests/test_publicacao_live.py` (builds de vários arquivos, promover X mantém Y byte a byte, voltar
    a um build schema 1); o `aprovacao.test.ts` do painel;
  - com placa de vídeo: `python maquete/motor/qa_build.py` monta o build antigo e o novo de um imóvel.
    Monta o novo duas vezes e exige o mesmo build. Depois leva o novo do canal ao ar, abre
    `/maquete/<imóvel>` e reverte para o antigo.

## O que ficou de fora, por enquanto

- **O leitor do estoque** (`estoque-runtime.js`) é gerado do modelo de estoque do painel, que ainda
  descreve só o prédio do LIV. O `viewer.js` só o carrega com o estoque ligado; a imobiliária usa a
  vitrine ao vivo.
- **O adaptador do mapa de 5 km** (`mapa-retorno.js`) é do LIV. Para a imobiliária, o mapa é o
  `tour.html` do build.
- **O interior da casa** (Planta 3D e Tour) vem da planta fixada, no MG-7.
- **O robô na máquina do GitHub** (M2-8) vai precisar do Chrome e do Playwright para montar o formato
  novo, e do `npm ci --prefix maquete/motor`. Os testes do robô no CI montam no formato antigo, para não
  gastar minutos de Actions com o Chrome (`tasks/painel/m2-worker.md`, andamento do MG-6).
- **O otimizador da publicação** entra no MG-8, já lendo a página dos dados. Hoje ele cita a página do
  LIV pelo nome.

A cópia do LIV (`experimentos/liv-experimental-2026-10-14/`, na `liv-melhorado`) é o mesmo motor.
Mudanças no motor passam a nascer aqui; o LIV vira um pacote de dados deste motor quando a construtora
entrar no fluxo.
