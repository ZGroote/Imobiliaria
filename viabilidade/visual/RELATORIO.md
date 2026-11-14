# Ajustes da frente Visual — contrato v3

- `index.html`: aviso no fluxo da página, sem cobrir botões ou alertas; VGV sem preço menor e sem quebra.
- Caixa máxima desenhada por degraus, respeitando projeção, cota inicial e altura de cada faixa.
- Recuos lateral/fundos por volume e frontal de cada opção; valores ausentes não viram zero.
- Frontal destacado como premissa, com aviso de restrição do loteamento e conferência da matrícula.
- Exemplo atual do Motor 0.3.0, zona SC-Z2, opções A–D; README atualizado.
- Contrato: o exemplo omite `altura_m` dos degraus. O Visual usa próximo `z0_m` ou topo da caixa; aceita altura explícita e mantém caixa simples em arquivos antigos.
- `evidencias/`: 14 capturas de página renovadas e 2 dos degraus; opção B, comparação e celular conferidos sem cortes ou sobreposição.
- Chrome headless PASS: 12 degraus, alturas explícitas/inferidas equivalentes, caixa antiga, recuos zero/ausentes e 14 entradas inválidas preservando o estudo.
- Sem erros de console ou overflow em 320/390/768/1024/1440 px; resultados em `evidencias/teste-browser.json`, regressões em `testar.cjs`.
- Somente `viabilidade/visual/` alterada; sem commit nem publicação. Integração pela central.
- Limites: sem aparelho físico, validação legal ou relevo; 3D depende de CDN/WebGL e o Motor pode amostrar os degraus.
