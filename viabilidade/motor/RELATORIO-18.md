# Relatório do Motor, tarefa 18: premissas de produto no comando único
1. **`estudar.py`:** `--apto-m2` (`area_privativa_por_unidade_m2`, 20 a 400), `--comum-m2` (`area_comum_por_pavimento_m2`, 0 a 400) e `--laje-min-m2` (`laje_minima_m2`, 20 a 1000). A laje mínima já era premissa; não mexi no motor. Entram em `estudo.premissas` e saem de `padrao`. Fora da faixa ou junto da mesma chave em `--premissas`: erro 2, sem pasta.
2. **`resumo.txt`:** linha "Premissas do usuário: apto 35 m²; comum por pavimento 0 m²; …" (inclui as do JSON), só quando houver.
3. **Prova no 75902** (`--ponto "-22.0175, -47.8908" --zona auto`): padrão = só C (12 un.); com `--apto-m2 35` = **A** (2 un., 2 pav.), **B** (4 un., 2 pav.) e **C** (24 un.); D continua ausente (laje de 67,4 m² < 80). As opções passam por `confere()` do `test_motor.py` (CA, TO, permeabilidade, recuos, altura): nada passa da lei.
4. **Testes:** `test_estudar.py` ganhou o caso (g): 75902 padrão × 35 m², `confere`, resumo, 5 recusas pela linha de comando. `test_estudar.py` e `test_motor.py` passam (pilotos e linha de base iguais, `motor.py` intacto).
5. Sem commit: `estudar.py`, `test_estudar.py`, este relatório.
