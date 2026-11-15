# Relatório do Motor, tarefa 19: frente presumida vira incerteza
1. **`motor.py`** (5 linhas, junto das incertezas da zona): lê `lote.qualidade.frentes[0].regra`. `arestas_colineares` → "Frente presumida (juntou N arestas colineares, asfalto a até 6 m): confirmar testada e alinhamento na matrícula."; qualquer outra regra (`tolerancia_asfalto_12m`) → "Frente presumida (asfalto a X m, acima dos 6 m da regra): confirmar testada e alinhamento na matrícula." Entra em `estudo.incertezas`, portanto no relatório e na tela. Lote sem `qualidade` ou sem regra: nada muda.
2. **Pilotos intactos:** `test_motor.py` passa (linha de base 0.8.1 pelo sha e monotonia iguais); o 30516 não ganha o aviso.
3. **`test_estudar.py`, caso (h):** 59281 (asfalto a 8,312 m) e 94130 (2 arestas juntadas) trazem o texto exato, uma vez só, no `estudo.json` e no `relatorio.html`. `test_estudar.py` passa.
4. Sem commit: `motor.py`, `test_estudar.py`, este relatório.
