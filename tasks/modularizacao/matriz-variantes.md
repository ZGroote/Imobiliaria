# Matriz de diferenças entre as três variantes do renderizador

Medida em 18/09/2026, para a tarefa 27 (consolidar variantes por capacidade).

## O que mascarava a comparação

`diff renderizador/app.js renderizador-v16/app.js` acusa **as 9.890 linhas** como
diferentes. Não são: `renderizador/app.js` está em LF e `renderizador-v16/app.js` em
CRLF. Normalizando a quebra de linha, a diferença real é de **205 linhas em 23 trechos**.
Os outros arquivos da variante (`estilo.css`, `cabeca.html`, `corpo.html`, `rabo.html`)
são **idênticos** entre v15 e v16.

## A matriz

| Capacidade | v15 (`renderizador/`) | v16 | v16-moveis |
|---|---|---|---|
| Sombra projetada na cidade (`castShadow` em prédio, muro, portão e árvore) | **sim** | não | não |
| Sol a 30° de elevação (`SOL_OFF.y = 476`) | **476** | 940 | 940 |
| Mapa de sombra enquadrado pelo zoom (`sombraDoQuadro`, histerese de 8%) | **sim** | não | não |
| `shadow.bias -0,0006` + `normalBias 0,55` (calibrado pra cidade) | **sim** | -0,0012 | -0,0012 |
| Especular por fragmento (`gShin`: reboco 8, vidro 56, asfalto 26) | **sim** | não | não |
| `matArvore()` com especular próprio | **sim** | não | não |
| Forro neutro no interior (`FORRO_NEUTRO`, chave `forro16iso`) | não | **sim** | **sim** |
| `envMap` só em material PBR (plafom não vira buraco preto) | não | **sim** | **sim** |
| `willReadFrequently` nos canvas 2D lidos por pixel | não | **sim** | **sim** |
| Modo móveis, editor e visita mobiliada | não | não | **sim** |
| Renderizador modularizado (72 arquivos + manifesto) | não | não | **sim** |

## A leitura que importa

**Não é uma linha de evolução; são dois galhos.** O v15 recebeu um trabalho de
aparência de cidade que nunca chegou no v16 (a sombra projetada, que vale 19% do quadro
segundo a medida registrada em `[[mapa-3d-sol-era-a-alavanca]]`, e o especular por
fragmento). O v16 e o v16-moveis receberam correções de interior e de canvas que nunca
voltaram pro v15. Consolidar, portanto, **não é apagar cópia**: é levar capacidade de um
galho pro outro e só então ficar com uma fonte.

## Medida de promoção (27d, 18/09/2026)

As duas capacidades do galho v15 foram portadas atrás de chave (27b e 27c) e depois
**medidas nas duas cidades**, em três enquadramentos, com o `mede_cidade.py`:

| capacidade | onde age | quanto | promover? |
|---|---|---|---|
| `sombra_projetada` | o quadro inteiro, nos três enquadramentos | `escuro%` de rua 7,08 → 8,87 (Ribeirão) e 8,70 → 12,72 (SC); `faixa` +3,4 e +7,5 | **candidata (só São Carlos)** — falta refazer a foto de controle |
| `especular_fragmento` | só o telhado, visto de cima (92,4% do que ele move) | +2,68 de luminância média no construído no quadro alto; 0,11 no de rua | **não** — o ganho some com a sombra ligada |

Três coisas que essa medida corrigiu:

1. **A medida do 27c estava no enquadramento errado, por um fator de 24.** Especular é
   luz em superfície larga vista de cima; quadro de rua quase não mostra telhado.
2. **`realce%` (`lum > 235`) é inalcançável**: o máximo do quadro é 234,5 nas 18
   combinações, e esses 234,5 são o texto branco do `#panel` que o recorte não exclui a
   1280×800 — não a cidade, que para em ~227.
3. **As duas chaves são antagonistas de cima**, não acopladas: a sombra baixa o sol,
   escurece o telhado e apaga o ganho do especular.

Detalhe em `baseline/promocao-aparencia-results.json`.

## Consequência pro plano

1. Cada linha da tabela vira uma chave de capacidade, no mesmo mecanismo que a
   `aparencia` do JSON da cidade já usa (ver `[[mapa-3d-aparencia-promovida-sc]]`):
   promover é decisão por cidade, com medida, não efeito colateral de remontagem.
2. A ordem de porte começa pelo que tem medida registrada e portão de aceite existente:
   sombra projetada + sol a 30° (o `compara_print.py` acusa a diferença, e isso é
   esperado, não regressão — está escrito no próprio comentário do v15).
3. Só depois disso as duas pastas antigas viram invocadores ou saem de cena. Enquanto a
   capacidade viver só num galho, apagar o galho é perder a capacidade.

## Como reproduzir a medida

```bash
python - <<'PY'
import difflib
a=open('renderizador/app.js',encoding='utf8',newline='').read().replace('\r\n','\n').split('\n')
b=open('renderizador-v16/app.js',encoding='utf8',newline='').read().replace('\r\n','\n').split('\n')
d=[l for l in difflib.unified_diff(a,b,'v15','v16',n=0,lineterm='')]
print('linhas de diferenca:', len([x for x in d if x[:1] in '+-'])-2)
PY
```

## Escopo: uma cidade

**São Carlos é a única cidade em escopo** — é a única que está na versão mais recente do
renderizador. As outras (`araraquara`, `sorocaba`, `sao-jose-do-rio-preto` e as quatro de
Ribeirão) têm `city.json` no acervo, mas a página delas não é montada há tempos: medir
aparência nelas é medir uma versão que não vai ser publicada.

Consequência para esta matriz: onde `PADRAO.md` diz "promover é decisão por cidade,
com medida", leia **uma** cidade. A medida de Ribeirão que está em
`baseline/promocao-aparencia-results.json` serviu para achar que o portão `realce%` é
inalcançável — esse achado vale para qualquer cidade, porque o teto de 234,5 é do
renderizador —, mas Ribeirão não é alvo de promoção.
