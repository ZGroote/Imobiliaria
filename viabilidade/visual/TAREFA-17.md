# Tarefa 17 do Visual: abrir na tela o estudo de um lote novo

**Quem:** Codex (Visual).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/visual/`.
**Não fazer:**
- não commitar;
- não tocar em `motor/` nem em `terreno/` (estão sendo mexidos).

## Problema

`motor/estudar.py` (veja `motor/RELATORIO-13.md`) grava numa pasta: `lote.json`, `estudo.json`, `relatorio.html` e `resumo.txt`.

A tela já abre um estudo por `?estudo=<caminho>` (por volta da linha 375). Mas o link "Relatório para imprimir" só aparece para os pilotos conhecidos (linhas 196 a 198). Num estudo novo, ele some.

## O que fazer

1. **Achar o relatório.** Quando o estudo vier por `?estudo=.../estudo.json`, procure `relatorio.html` **na mesma pasta**.
   - Confira a revisão pelo `<meta name="estudo-sha256">`, com o mesmo mecanismo da tarefa 6.
   - Se bater, mostre o link.
   - Se não bater, mostre o aviso "relatório desatualizado para esta revisão".
   - Se não existir, esconda o link.
   - Os pilotos continuam como hoje.
2. **Segurança do `?estudo=`.** Só aceite caminho relativo, na mesma origem da página.
   - Recuse URL absoluta de outro domínio, `javascript:` e `data:`, com mensagem clara.
   - Confira se isso já acontece hoje. Se já acontecer, só cubra com teste.
3. **Teste em `testar.cjs`.**
   - Gere uma pasta com `python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 8697 --zona SC-Z4 --pasta <tmp dentro da worktree, apagada no fim>`.
   - Abra por `?estudo=` e confira:
     - o link do relatório e a revisão igual;
     - o rótulo "zona informada … não conferida";
     - um relatório adulterado (cópia com um byte trocado no estudo) gera o aviso;
     - `?estudo=https://exemplo.com/x.json` é recusado.

Rode `node --check viabilidade/visual/testar.cjs`. O Chrome a central roda.

## Relatório

`viabilidade/visual/RELATORIO-17.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 17 pronta"`.
