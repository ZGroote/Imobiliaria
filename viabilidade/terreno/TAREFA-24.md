# T24 — divisa falsa pela borda da linha de rua (16/11)

Galho `viabilidade/duas-zonas`. É o item 5 do seu `RELATORIO-23.md`: a `distancia_divisa_m` lê a borda suavizada da linha cinza de rua (e a sombra de texto) como Z5B ou Z1, e recusa lote de zona única por "Divisa/cor não zonal a menos de 10 m". Você mediu que, com a mesma mancha mínima de 3×3 px da T23, 65 dos 66 lotes com uma candidata só deixariam de ter divisa a menos de 10 m.

## O que fazer

1. Na `distancia_divisa_m` de `sugerir_zona.py`, aplicar o mesmo filtro de mancha mínima da T23 (de preferência a mesma função, não uma cópia). **Cor não zonal (branco, cinza de rua, Represa etc.) continua contando como divisa como hoje**: o filtro só tira o pixel de zona que não forma mancha. `DIVISA_M = 10.0` não muda.
2. **Prova na imagem antes de aceitar:** no sorteio de 500 (semente 20261120), liste os lotes que passam de recusados a aceitos. Abra no Anexo 02 **todos** (ou, se passar de 40, 40 sorteados mais todos que ficarem a menos de 15 m de outra zona depois do filtro) e confira que são de uma zona só. Se achar **um** que esteja de fato numa divisa, pare, não aceite o filtro como está e conte no relato o que viu.
3. **O que pode mudar:** lote antes recusado passa a aceito; nos já aceitos, só o número `distancia_divisa_m` pode subir (diga quantos e quanto). Zona, `alternativas`, frente, geometria e o resto do `lote.json` dos aceitos não mudam. Pilotos: `novo_lote --testar` igual; se a distância deles mudar, diga.
4. Os 6 `so_divisa` da T23 continuam `so_divisa` com as mesmas candidatas.

## Números para o relato

Sorteio de 500: aceitos antes/depois, recusas por motivo antes/depois, a lista dos que passaram a aceitos com a zona e a nova distância, e o resultado da conferência na imagem (com 2 ou 3 prints em `terreno/evidencias/t24/`, pequenos).

## Teste

Um caso sintético de linha fina de Z5B colada ao lote que hoje recusa e passa a aceitar; um caso de divisa real Z2|Z1 que continua recusando; o 90050 continua `so_divisa` Z4|Z3. Rode `novo_lote --testar`, `gerar_lotes --testar`, `test_ponto.py` e `conferir.py` (8/8).

Não toque em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`. Não commite. Relato em `terreno/RELATORIO-24.md`. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 24 pronta"`.
