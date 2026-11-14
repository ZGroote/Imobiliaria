# Ajustes para celular — 11/09/2026

**Registro histórico.** A fonte atual é `v1.5/renderizador-v16-moveis/`; a modularização
foi concluída posteriormente. Scripts e cópias `antes-*` deste ensaio foram preservados
em `_arquivo/organizacao-2026-10-04/relatorios/mobile/`. O procedimento abaixo descreve
o ambiente da época; para reproduzi-lo, restaure os caminhos a partir do manifesto local.

Fontes alteradas: `renderizador-v16-moveis/app.js`, `corpo.html` e `estilo.css`.
Os arquivos `antes-*` preservam as fontes anteriores (a pasta não possui Git).

- Navegação Mapa / Imóveis / Opções, com um painel por vez.
- Busca legível com fonte de 16 px e seleção por toque.
- Fichas roláveis, ações acessíveis e retorno à ficha nos arredores.
- Saída da visita por botão; cancelamento de ajustes e instruções para toque.
- Painel de móveis contido na tela, separado do controle de caminhada.
- Pinça e rotação usam Pointer Events, sem disputa com o arrasto de um dedo,
  sem seleção ao terminar a pinça e com limite de zoom próprio da planta.
- Gráficos baixos por padrão em celular com toque; escolha salva e parâmetro q
  continuam tendo precedência. Remoção do desfoque dos cartões em telas pequenas.
- Build de Hosting comprimido, com hash no nome para respeitar o cache imutável.
  Builds antigos preservados. Nenhum deploy executado.

## Validação

`teste.json` registra o aceite no build final indicado em `build.json`.
Chrome isolado, emulação de toque, larguras 320, 390, 768, 812 (horizontal),
1024 e 1440 px. Verificados limites da lista, alternância dos painéis, abertura
de ficha, arredores e retorno, visita, móveis, saída, busca por toque e pinça
com eventos reais do protocolo do Chrome. Zero exceções JavaScript.
Sintaxe JavaScript e unicidade dos IDs HTML verificadas. Capturas PNG nesta pasta.

O fluxo completo foi exercitado em 390 × 844. Os demais tamanhos verificam
layout e navegação da lista. Não houve teste em aparelho físico ou Safari,
nem medição de FPS/bateria. O arquivo continua grande para redes móveis:
25.859.192 bytes aberto, 11.381.576 bytes comprimido (56% menor).

## Reproduzir

1. `$env:MAPA_V='v16-moveis'; python pipeline/montar.py`
2. `python relatorios/mobile/preparar.py` (preparação local, sem deploy).
3. `python -m http.server 8765 --bind 127.0.0.1`
4. `node relatorios/mobile/captura.cjs`

O teste usa o Playwright do runtime local e Chrome instalado; requer autorização
para iniciar o navegador fora do sandbox. `preparar.py` atualiza o índice local
do Hosting para o nome com hash. Não execute o publicador antigo depois dele,
pois aquele publicador substitui o índice pelo HTML aberto de nome fixo.
