# Rótulos ingleses das plantas originais

`canto.png` e `meio.png` são as variantes inglesas das imagens humanizadas
originais, no mesmo registro de 1000×1000 pixels. As duas são selecionadas
somente com `?lang=en`; a versão portuguesa conserva os JPEGs originais.

Os rótulos foram traduzidos com a ferramenta integrada `image_gen`, modo
`text-localization`, usando cada JPEG original como alvo de edição. A saída foi
ajustada a 1000×1000 e somente as dez pequenas regiões dos rótulos foram
compostas sobre os pixels originais, com uma transição de dois pixels nas
bordas. A composição nativa e suas imagens intermediárias estão no journal
local `publicacao/planta2d-en-20261103/`; não fazem parte do site.

`validacao.json` registra os retângulos, hashes, dimensões e a comparação de todos
os pixels. Resultado: **zero pixels diferentes fora das regiões dos rótulos**.
Os polígonos de recorte, as coordenadas da régua, as medidas e o marcador da
entrada não foram alterados.

## Prompt usado nas duas edições

> Edit the attached original furnished floor plan. Change only the small black
> Portuguese room labels to the English labels below, centered in the same
> locations, with understated small black sans-serif type directly on the floor.
> Remove the old letters while preserving the floor texture. Keep all geometry,
> walls, windows, doors, furniture, materials, lighting, silhouette, white margins,
> framing and entrance arrow unchanged. Do not redraw, redesign, crop, mirror,
> rotate, zoom, shift or add objects, headings, boxes or callouts. Preserve the
> original square framing and 1000×1000 registration.

Cada chamada recebeu a sua própria planta (`canto.jpg` ou `meio.jpg`) e a posição
de cada rótulo nessa imagem, com estas substituições:

| Original | Inglês |
| --- | --- |
| VARANDA | BALCONY |
| SERVIÇO | LAUNDRY |
| COZINHA | KITCHEN |
| SALA / JANTAR | DINING |
| SALA / TV | LIVING ROOM |
| CIRCULAÇÃO | HALLWAY |
| DORM. 01 | BEDROOM 01 |
| SUÍTE | PRIMARY BEDROOM |
| BANHO SUÍTE | EN SUITE |
| BANHO | BATHROOM |

## Integração

`clonar_demo.py:internacionalizar_plantas()` valida os dois PNGs, copia-os como
`plantas2d/{canto,meio}-en.png`, atualiza o catálogo com uma revisão pelo hash e
inclui os arquivos no manifesto de transferência. `planta2d-idioma.js` escolhe a
imagem antes do preparo inicial; o cache existente continua decodificando cada
planta uma única vez. Recompile o viewer e recalcule os hashes ao atualizar assets.

Os testes de `tests/test_apresentacao_planta_ingles.mjs` conferem seleção de
idioma, preservação do catálogo português, idempotência, dimensões obrigatórias,
manifesto e reutilização das duas imagens.
