# LIV — revisão visual

O histórico de falhas, causas, correções e regras para próximas tentativas está
em [DIARIO_DE_QUALIDADE.md](DIARIO_DE_QUALIDADE.md). Leia esse diário antes de
reutilizar os renders ou alterar a apresentação.
O [comparativo visual](COMPARACAO.md) reúne a versão anterior e a revisão.

Fonte preservada: `../liv-render-blender-2026-10-26/entrega/`.
Revisão: `entrega/LIV_Revisado.blend`, com quatro cenas e texturas incorporadas.

## Reproduzir

Execute com o Blender instalado, em segundo plano:

```text
blender --background --factory-startup --python-exit-code 1 --python revisar_liv.py -- --mode build
blender --background --factory-startup --python-exit-code 1 --python revisar_liv.py -- --mode draft --shot all --round revisao
blender --background --factory-startup --python-exit-code 1 --python verificar_composicao.py
blender --background --factory-startup --python-exit-code 1 --python revisar_liv.py -- --mode final --shot all
blender --background --factory-startup --python-exit-code 1 --python revisar_liv.py -- --mode finish
```

O script reabre o `.blend` após montar as cenas, verifica a preservação dos
vértices e matrizes da origem (exceto folhagem substituída), as texturas
incorporadas, os materiais de vidro/caixilho e as dimensões dos PNGs.
Essas checagens são técnicas e não concedem aprovação visual.
`verificar_composicao.py` mede a projeção do sofá e do quadro e falha se faltar
margem de 2%. O mesmo critério é conferido no fechamento da entrega.

## Critério visual e limites

Prévia aprovada para cálculo grande significa que a composição está pronta para
ser inspecionada na resolução de entrega. Não significa aprovação pelo usuário.
A base continua sendo uma maquete ilustrativa. Veículos, ferragens e parte dos
móveis conservam geometria simplificada; a vegetação e a decoração novas foram
criadas por geometria procedural. Não apresentar como anúncio fotorrealista ou
como projeto executivo.

Scripts e notas permanecem sem commit. Saídas, fontes e logs são ignorados no Git.
