# Tarefa 7 do Visual — relatório e tela com estudo sem opções (AUDITORIA-5, BAIXA 2)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/` e `viabilidade/relatorio/`. Não commite. O motor está sendo mexido em paralelo: não toque em `viabilidade/motor/`.

## Problema (da `viabilidade/auditoria/AUDITORIA-5.md`)

`relatorio.gerar_html` gera, mas `test_relatorio.validar_html_contra_json` falha com `Campo obrigatório do JSON ausente no HTML: 'zona.parametros.altura_max_m'` em estudos com `opcoes == []` e em casos v4 com campos opcionais ausentes:
- `viabilidade/auditoria/casos/audit5-saida-impossivel-falso-13x40.json`, `audit5-saida-impossivel-falso-d-cega.json`;
- `saida-minusculo-150m2.json`, `saida-area-especial-gabarito.json`, `saida-sem-ca-cone-90m.json`.

## O que fazer

1. Descubra se o erro é do **validador** (exige campo que o estudo não tem) ou do **relatório** (deixa de mostrar campo que existe). Corrija no lugar certo: campo ausente no JSON = o relatório mostra "não informado", e o validador aceita isso.
2. Estudo sem opções: o relatório e a tela mostram com clareza que **nenhuma opção coube** e listam as `opcoes_ausentes` com os motivos. Nada de página quebrada ou tabela vazia sem explicação.
3. Teste: um teste em `test_relatorio.py` que gera e valida o relatório para **todos** os `saida-*.json` e `audit5-saida-*.json` de `viabilidade/auditoria/casos/` que tenham `lote` (pule os registros de erro antigos sem `lote`, contando quantos pulou). Em `testar.cjs`: carregar um estudo sem opções e conferir a mensagem.

`python -I -X utf8 viabilidade/relatorio/test_relatorio.py` e `node --check viabilidade/visual/testar.cjs`. O Chrome a central roda.

## Relatório

`viabilidade/visual/RELATORIO-7.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 7 pronta"`.
