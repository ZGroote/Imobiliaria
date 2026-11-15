# Tarefa 15 do Motor: o comando único aceita ponto e zona automática

**Quem:** Motor.
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/motor/`.
**Não fazer:**
- não commitar;
- não mexer no `terreno/` nem no `visual/`.

## Por quê

O Terreno já faz, no `novo_lote.py`:
- `--ponto "lat, lon"` (tarefa 7);
- `--zona auto` (tarefa 5);
- áreas especiais automáticas (tarefa 6).

O `estudar.py` (tarefa 13) só aceita `--indices` e uma zona explícita.

## O que fazer

1. **`estudar.py` aceita `--ponto` no lugar de `--indices` e `--zona auto`**, repassando ao `Cadastro` com as mesmas regras e mensagens. Não duplique a lógica do terreno.
   - `python -I -X utf8 viabilidade/motor/estudar.py --base completo --ponto "-22.0175, -47.8908" --zona auto --pasta <destino>`
2. **`resumo.txt` mostra:**
   - a origem da zona (informada / sugerida, não conferida) e, se sugerida, as alternativas;
   - as áreas especiais encontradas e as "não verificadas", em uma linha cada.
3. **Recusa do terreno** (ponto na rua, zona duvidosa): a mensagem sai inteira e não fica pasta criada. Para zona duvidosa, diga como continuar: "rode de novo com `--zona SC-XX`, uma destas: …".
4. **`test_estudar.py`.** Acrescente:
   - ponto + auto num lote que o Terreno já testou como "concorda", por exemplo o centroide do 25297 → Z1;
   - ponto na rua → recusa sem pasta;
   - auto recusado por divisa (22421) → recusa sem pasta, com as alternativas na mensagem.

Rode `test_estudar.py`.

## Relatório

`viabilidade/motor/RELATORIO-15.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 15 pronta"`.
