# Tarefa 23 do Motor: expectativas do test_estudar depois da tarefa 17 do Terreno

**Quem:** Claude Code (Visual), emprestado ao motor; é efeito direto da sua tarefa 17.
**Galho:** `viabilidade/lote-livre` (PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** só `viabilidade/motor/test_estudar.py`.
**Não fazer:** não commitar; não tocar no código do motor nem do terreno.

## Por quê

A tarefa 17 trocou o posicionamento dos anexos (afim direta por 21 cruzamentos). Com isso, `conferir.py` deu 7/8: o `estudar` falha só por expectativa velha, conforme o `terreno/RELATORIO-17.md`.

## O que fazer

1. Linhas ~188-189 (recusa `divisa`, lote 22421): alternativas passam a ser `SC-Z1, SC-EIXO` (sai a Z2), nas duas mensagens.
2. Caso (h), lote 59281: usar `"SC-Z2"` no lugar de `"auto"` (a zona auto agora recusa por divisa; o caso testa a frente, não a zona).
3. Caso (i), lote 92058: usar `"SC-Z4"` no lugar de `"auto"`, pelo mesmo motivo.
4. Confira com o mapa do Anexo 02 que SC-Z2 e SC-Z4 são de fato as zonas desses dois lotes (ou a alternativa mais provável). Se não forem, diga qual é e use essa.

## Testes

- `python -I -X utf8 viabilidade/motor/test_estudar.py`
- `python -I -X utf8 viabilidade/conferir.py`: 8/8

## Relatório

`viabilidade/motor/RELATORIO-23.md`, até 6 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 23 pronta"`.
