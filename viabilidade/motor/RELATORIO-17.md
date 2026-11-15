# Relatório do Motor, tarefa 17: a incerteza da zona reconhece a origem nova
1. **Corrigido em `motor.py`** (só o dicionário `texto_origem`): `informada_pelo_usuario` → "NÃO conferido (informada pelo usuário)"; `sugerida_pelo_mapa` → "NÃO conferido (sugerida pelo mapa do Plano Diretor; outras zonas por perto: SC-X, SC-Y)" (ou "nenhuma"). O relatório HTML herda o texto; não diz mais "sem origem informada".
2. **Pilotos intactos:** `anotada_a_mao`/`oficial`/`teste` não mudaram; `test_motor.py` passa (linha de base 0.8.1 pelo sha e monotonia iguais).
3. **Caso novo em `test_estudar.py`:** confere `incertezas[0]` do lote sugerido (25297, ponto + auto) e do informado (25297 + SC-Z1), e que "sem origem" não aparece no `relatorio.html` de nenhum dos três lotes novos (inclui 8697). `test_estudar.py` passa.
4. Sem commit: `motor.py`, `test_estudar.py` e este relatório (mais os arquivos soltos da tarefa 16 e de outras frentes).
