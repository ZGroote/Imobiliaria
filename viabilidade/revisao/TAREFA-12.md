# Revisão 12 — resto do galho `viabilidade/duas-zonas` (16/11)

Revise o que entrou depois da revisão 11, de `bb6bd246` até o HEAD. Relatos de cada entrega:
- `f87a5280`: Terreno T24, divisa falsa pela borda da linha de rua (`terreno/RELATORIO-24.md`).
- `f3bd6404`: Terreno T25 + Motor T30, parque e campus com mancha 3×3, alternativas filtradas e teste do 68491 (`terreno/RELATORIO-25.md`, `motor/RELATORIO-30.md`).
- O commit da Visual T22: `varredura.html` com o status `divisa` (`visual/RELATORIO-22.md`).

Procure principalmente:
1. **Lote aceito que devia ser recusado:** algum caminho em que zona real estreita, parque, campus, branco ou Represa deixa de contar como divisa. O filtro de 3×3 px pode apagar uma faixa real de 2 px no mapa? Branco e Represa continuam sem filtro?
2. **Alternativas:** alguma zona real some das `alternativas`? `so_divisa` e `candidatas` continuam coerentes com as alternativas?
3. **Aceitos que mudam além do combinado:** em lote já aceito, só podem mudar `distancia_divisa_m` e `alternativas`. Confira em 5 lotes do sorteio.
4. **`varredura.html`:** um status desconhecido ainda aparece sem quebrar? A contagem bate com "Mostrando N de N"?
5. Rode `conferir.py` (8/8).

Achados em `revisao/REVISAO-12.md`, como ALTA/MÉDIA/BAIXA, com arquivo:linha e como reproduzir. Se não houver nenhum, escreva "sem achados". Não conserte nada e não commite. Ao terminar: `maestri ask "Claude Code" "Revisor tarefa 12 pronta"`.
