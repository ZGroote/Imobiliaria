# T30 — teste da divisa com uma candidata só (16/11)

A T25 do Terreno (solta na worktree, ainda sem commit) tirou a divisa falsa de "parque" na borda da rua, e o lote 75352–75354 passou a ser aceito em Z2 pelo `--zona auto`. O teste em `motor/test_estudar.py` (linhas ~327–334) usava esse lote como exemplo de "divisa com uma candidata só, recusa sem pasta" e agora reprova (`AssertionError: divisa com uma candidata só devia recusar`).

1. Troque o lote do teste pelo **68491** (Z1 colado ao campus, com frente). O Terreno conferiu: `estudar.estudar("completo", [68491], "auto", ...)` recusa com "Zona automática recusada … Rode de novo com --zona SC-XX, uma destas: SC-Z1." e não cria pasta. Confira você também.
2. Procure em `motor/` outros testes ou exemplos que contem com o 75352–75354 recusado pelo `auto` (os pilotos usam zona informada e não mudam; confirme com `test_8b`).
3. Rode `test_estudar.py`, `test_motor.py`, `test_varrer.py` e `conferir.py`, que tem que voltar a 8/8 com a T25 solta como está.

Só `motor/`. Não commite. Relato curto em `motor/RELATORIO-30.md`. Ao terminar: `maestri ask "Claude Code" "Motor tarefa 30 pronta"`.
