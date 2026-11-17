# T25 — parque/campus na borda da rua e alternativas falsas (16/11)

Galho `viabilidade/duas-zonas`. São os itens 7 e 8 do seu `RELATORIO-24.md`; decidi pelas duas propostas:

1. **Parque e campus com mancha mínima:** na `distancia_divisa_m`, as cores de parque (Pq. Ecológico etc.) e de campus passam a contar como divisa só com mancha de 3×3 px ou mais, a mesma `mancha()`. **Branco e Represa continuam contando sempre**, sem filtro. Parque ou campus de verdade é mancha grande, então não pode sumir: confira isso num lote real colado a um parque e num colado ao campus (ache um de cada no cadastro) e ponha no teste.
2. **Alternativas com o mesmo filtro:** zona que só aparece em pixel solto (sem mancha 3×3) sai das `alternativas`. A candidata da T23 já usa esse filtro; as duas listas passam a concordar.

## Prova na imagem

No sorteio de 500 (semente 20261120), liste os que passam de recusados a aceitos (você mediu 40 dos 42) e abra **todos** no Anexo 02. Se achar **um** numa divisa real ou colado a parque/campus de verdade, pare e conte no relato sem aceitar a mudança. Um print de folha, como o `aceitos-24.png`, em `terreno/evidencias/t25/`.

## O que pode mudar

- Recusado passa a aceito.
- Nos aceitos, só `distancia_divisa_m` (sobe ou vira `null`) e `alternativas` (perde zona falsa). Diga quantos lotes e quais zonas saíram das alternativas. O resto do `lote.json` fica igual.
- Os 6 `so_divisa` continuam iguais.
- **Pilotos:** rode `novo_lote --testar` e diga se algum piloto muda de `alternativas` ou de distância. Se o lote de algum piloto mudar, **não** mexa em `lotes-piloto.json` nem na linha de base do motor: só conte qual muda e como, que eu passo ao Motor.

## Teste

- Borda de parque de 2 px colada ao lote: antes recusava, agora aceita.
- Parque grande colado ao lote: continua recusando.
- Branco colado: continua recusando.
- Alternativa falsa de pixel solto: sai da lista.
- 90050 continua `so_divisa` Z4|Z3.
- Rode `novo_lote --testar`, `gerar_lotes --testar`, `test_ponto.py` e `conferir.py` (8/8).

Não toque em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`. Não commite. Relato em `terreno/RELATORIO-25.md`. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 25 pronta"`.
