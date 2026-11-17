# Revisão 9: T19 e T24 no galho pós-merge

**Quem:** Revisor.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** nada de código. O Terreno (T21) e o Motor (T26) estão trabalhando nesta worktree, então rode tudo numa **cópia temporária fora do repositório**, feita com `git worktree add` ou `git archive` do commit `e9541362`. Só o relatório entra aqui.
**Não fazer:** não commitar; não mexer nos arquivos soltos de `terreno/` (são da T21, em andamento).

## O que revisar

`git diff 633ddaeb..e9541362 -- '*.py' '*.json'`:

1. **T19 (Terreno, b236fec4):**
   - `reconferencia` gravada só em `dados/anotacoes-zonas.json`;
   - `preparar_zonas.py` não leva o campo ao lote;
   - `testar_pilotos.py` confere o campo e manteve `ORIGINAIS`.

   Pergunta: o campo pode vazar para o lote por outro caminho? E as distâncias de "antes e depois" batem com o `RELATORIO-18.md`?
2. **T24 (Motor, e3ecfafd):** premissa `acrescimo_topo_m`, padrão 1,5 m, só quando o gabarito vem de área especial. Confira:
   - lote com altura de zona menor que o gabarito: a premissa não pode entrar;
   - lote com duas áreas especiais de altura diferente;
   - `acrescimo_topo_m` informado pelo usuário num lote sem gabarito: o que acontece? Deve ser ignorado ou dar erro claro, nunca mudar a conta;
   - o texto do alerta com folga negativa ou zero;
   - a citação do COE (Lei 19.950/2020, art. 3º-IV) em `RELATORIO-24.md`: o texto bate com a lei?
3. Rode os testes na cópia: `test_motor.py`, `test_estudar.py`, `test_varrer.py`, `testar_pilotos.py` (com e sem `--reproduzir`) e `conferir.py`.

## Relatório

`viabilidade/revisao/REVISAO-9.md`, com os achados por gravidade (ALTA, MÉDIA, BAIXA), cada um com arquivo:linha, o comando e a saída. Depois: `maestri ask "Claude Code" "Revisor tarefa 9 pronta"`.
