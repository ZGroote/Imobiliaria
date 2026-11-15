# Tarefa 22 do Motor: o conferir.py trava o teste do visual no Windows

**Quem:** Claude Code (Motor).
**Galho:** `viabilidade/lote-livre`.
**Onde mexer:** só `viabilidade/conferir.py`.
**Não fazer:** não commitar; não tocar no visual, no terreno nem no motor.

## Por quê

`rodar_visual()` sobe `python -m http.server` com `stdout=PIPE, stderr=STDOUT` e só lê a primeira linha (a da porta). O http.server escreve uma linha de registro por pedido no stderr; no Windows o cano enche, o servidor trava e o `page.goto` do `testar.cjs` estoura 30 s (`TimeoutError`). No Linux (CI) o cano é maior e passa. A central conferiu: com o servidor sem registro (`2>/dev/null`), `node viabilidade/visual/testar.cjs` sai com exit 0 no Windows.

## O que fazer

1. Mandar o stderr do servidor para `subprocess.DEVNULL` (a linha da porta vem no stdout; confira isso no Python instalado). Se a linha da porta vier no stderr nessa versão, ache outro jeito simples (por exemplo, escolher a porta antes) e diga.
2. Rodar `python -I -X utf8 viabilidade/conferir.py` duas vezes no Windows: as 8 frentes têm que sair APROVADO, e o `git status` de `viabilidade/visual/evidencias` tem que ficar limpo no fim.

## Relatório

`viabilidade/motor/RELATORIO-22.md`, até 5 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 22 pronta"`.
