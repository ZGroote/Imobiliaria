# Tarefa 2 da Visual (esforço médio)

O Motor mudou (v0.5.0). Leia só a seção 2 de `viabilidade/motor/RELATORIO.md`.
1. A página tem que abrir também os 7 estudos de `viabilidade/motor/exemplos/pilotos/*.json` (uma lista pra escolher o lote basta).
2. `caixa_maxima.area_computavel_max_m2` pode vir `null` (zona sem CA): mostrar "sem limite na lei", sem quebrar.
3. Mostrar as `incertezas` e os alertas de área especial ("sem altura numérica, NÃO aplicada") bem visíveis.
4. Rode `visual/testar.cjs` com os 7 + o exemplo; prints em `visual/evidencias/`.
Escreva só em `viabilidade/visual/`. Relatório em `visual/RELATORIO.md`; pra central, uma linha:
`maestri ask "Claude Code" "Visual tarefa 2 concluída. Testes ok/falhou. Relatório: visual/RELATORIO.md"`
