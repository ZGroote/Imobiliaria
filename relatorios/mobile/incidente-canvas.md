# Tela parcial após ajuste automático de resolução

Reproduzido na versão publicada `95f1f62f6ea3`: a DPR 0,5, a janela de
1366 × 768 tinha canvas CSS de 683 × 384. No celular, 390 × 844 virava
195 × 422. O HUD continuava ocupando a tela inteira.

Causa: o canvas principal não tinha dimensões CSS explícitas, e
`renderer.setSize(..., false)` deixava o tamanho visual seguir as dimensões
intrínsecas do drawing buffer. A guarda de resize também ignorava mudanças de DPR.

Correção: `#c` ocupa 100% da largura e altura; resize considera janela, DPR e
buffer e mantém a projeção da câmera sincronizada. O minimapa mantém suas regras.

Regressão: `viewport.cjs` confere CSS, buffer, viewport WebGL e proporção da câmera
em sete DPRs, desktop, celular e rotação. Three r168 arredonda o viewport WebGL
e trunca o buffer; a diferença normal de até um pixel é aceita, sem permitir
área descoberta. Evidências: `viewport-antes.json` e `viewport-corrigido.json`.

Os testes anteriores cobriam tamanhos de tela, mas não conferiam o tamanho CSS
do canvas após a mudança automática de resolução.
