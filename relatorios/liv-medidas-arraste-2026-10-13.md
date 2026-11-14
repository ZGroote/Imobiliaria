# LIV: medidas 2D e resposta do arraste

O arraste da planta 2D captura o ponteiro e impede seleção de texto e arraste nativos. A restrição de seleção fica no visualizador; o texto das informações continua selecionável.

O botão discreto **Medidas**, dentro do visualizador, liga/desliga as estimativas nas plantas Canto e Meio e continua disponível com informações minimizadas. A escolha permanece durante as trocas de planta. As etiquetas acompanham o retângulo efetivamente desenhado por `object-fit: contain`, o zoom e o deslocamento. O tamanho do texto permanece legível durante a ampliação. Na planta Canto, os banheiros vizinhos têm etiquetas em alturas diferentes para evitar sobreposição. Em telas estreitas, as etiquetas mostram primeiro as dimensões; os nomes aparecem ao ampliar a 150% ou mais e continuam disponíveis para leitores de tela.

Os valores são dimensões nominais aproximadas entre eixos de paredes, provenientes da reconstrução existente; não representam cotas técnicas ou vão útil. Ambientes em L usam trechos identificados. As fontes e registros da imagem estão documentados junto aos dados em `tipologias.js`: `interiores/meio/{leitura,referencia}.json`, `interiores/canto/unidade.json` e a referência herdada em `v1.5/miniaturas/liv-ipanema/interior/referencia.json`.

A planta 3D usa `OrbitControls.enableDamping = false`. A câmera responde ao arraste e para ao soltar, sem movimento residual. A revisão do módulo do interior garante carregamento da configuração atual. Os imports relativos versionados também são resolvidos pelo empacotamento.

## Verificação

- Node: 39 testes de fluxo/cache/zoom/medidas aprovados.
- Python: 6 testes de empacotamento aprovados; inventário real de 240 arquivos inclui os módulos atualizados.
- Navegador: arraste 3D alterou a imagem, e duas capturas do canvas após soltar permaneceram idênticas.
- Navegador: arraste 2D produziu `translate(0px, 30px)` e o overlay acompanhou o deslocamento; seleção de texto vazia.
- Medidas de Meio e Canto conferidas no celular em 320 px; Canto sem sobreposição entre etiquetas e sem rolagem horizontal. Preferência preservada ao trocar de planta. Sem erros de console nos testes de navegação.

Captura final: `C:/Users/respawn/.codex/visualizations/2026/10/12/01a13221-b953-7a61-9a32-077c5eedde69/liv-medidas-arraste.png`.

Prévia local: http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html
