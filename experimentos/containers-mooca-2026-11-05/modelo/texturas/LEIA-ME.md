# Texturas do exterior

Todas CC0 (domínio público), do ambientCG.com, baixadas em 05/11/2026 na versão 1K-JPG:

| Material do ambientCG | Vira | Uso |
|---|---|---|
| Grass004 | `grama-cor.webp`, `grama-normal.webp` | gramados do pátio, 1 repetição a cada 2 m |
| Concrete034 | `concreto-cor.webp`, `concreto-normal.webp` | caminho e calçada, 1 repetição a cada 2,5 m |
| LeafSet024 | `folhas.webp` | galho com folhas, fundo transparente, nos cartões da copa |

`preparar_texturas.py` gera os arquivos a partir dos zips abertos (que ficam fora do git). A madeira do deck
é a `madeira_nature` de `experimentos/moveis-referencia/web/materiais/`.

`exportar_cena.py` leva as imagens para `assets/` e calibra a cor de cada material: média da textura igual
à cor do modelo, para o tom não mudar.
